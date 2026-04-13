#!/usr/bin/env node
/**
 * GitHub Action entry point for skill-trust.
 *
 * Reads inputs from environment variables (INPUT_*), runs the verifier,
 * and writes outputs + summary using GITHUB_OUTPUT / GITHUB_STEP_SUMMARY.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parseSkill } from "../parser.js";
import { verify } from "../verifier.js";
import { report } from "../reporter.js";
import type { OutputFormat, VerificationResult } from "../types.js";

const VALID_FORMATS: readonly string[] = ["terminal", "json", "sarif"];

// ---------------------------------------------------------------------------
// GitHub Actions helpers
// ---------------------------------------------------------------------------

function getInput(name: string, required = false): string {
  const val = process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`] ?? "";
  if (required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}

/**
 * Set an output variable using the delimiter-based multiline-safe format.
 * https://github.com/actions/toolkit/issues/403
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
    fs.appendFileSync(
      outputFile,
      `${name}<<${delimiter}\n${value}\n${delimiter}\n`,
    );
  }
}

function writeSummary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, markdown + "\n");
  }
}

/**
 * Escape a string for safe inclusion in a GitHub Markdown table cell.
 * Prevents Markdown/HTML injection.
 */
function escapeMd(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}

function formatSummaryMarkdown(result: VerificationResult): string {
  const levelEmoji: Record<string, string> = {
    VERIFIED: "🟢",
    PARTIAL: "🟡",
    UNDECLARED: "⚪",
    INCONSISTENT: "🔴",
  };

  const emoji = levelEmoji[result.level] ?? "❓";
  const lines: string[] = [];

  lines.push(`## ${emoji} skill-trust: ${escapeMd(result.level)}`);
  lines.push("");
  lines.push(`**Skill:** ${escapeMd(result.skill)}`);
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("All checks passed!");
  } else {
    lines.push("| Severity | Rule | Message | Location |");
    lines.push("|----------|------|---------|----------|");
    for (const f of result.findings) {
      const icon = f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️" : "ℹ️";
      const loc = f.file ? `${escapeMd(f.file)}${f.line ? `:${f.line}` : ""}` : "-";
      lines.push(`| ${icon} ${escapeMd(f.severity)} | ${escapeMd(f.rule)} | ${escapeMd(f.message)} | ${loc} |`);
    }
  }

  lines.push("");
  const { errors, warnings, info, passed } = result.summary;
  const parts: string[] = [];
  if (passed > 0) parts.push(`${passed} passed`);
  if (errors > 0) parts.push(`${errors} error(s)`);
  if (warnings > 0) parts.push(`${warnings} warning(s)`);
  if (info > 0) parts.push(`${info} info`);
  lines.push(`**Summary:** ${parts.join(", ")}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/**
 * Validate that the resolved skill path is within the repository root
 * (defaults to GITHUB_WORKSPACE or cwd).
 */
function validateSkillPath(resolvedPath: string): void {
  const repoRoot = path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
  if (!resolvedPath.startsWith(repoRoot + path.sep) && resolvedPath !== repoRoot) {
    throw new Error(
      `skill_path must be within the repository (${repoRoot}), got: ${resolvedPath}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    const skillPath = getInput("skill_path", true);
    const strict = getInput("strict") === "true";
    const formatRaw = getInput("format") || "terminal";

    if (!VALID_FORMATS.includes(formatRaw)) {
      throw new Error(
        `Invalid format '${formatRaw}'. Must be one of: ${VALID_FORMATS.join(", ")}`,
      );
    }
    const format = formatRaw as OutputFormat;

    const resolvedPath = path.resolve(skillPath);
    validateSkillPath(resolvedPath);

    const skill = await parseSkill(resolvedPath);
    const result = verify(skill);

    // Print report to Action log
    report(result, { format, verbose: false, strict });

    // Set outputs
    setOutput("result", result.level);
    setOutput("warnings", String(result.summary.warnings));
    setOutput("failures", String(result.summary.errors));

    // Write job summary
    writeSummary(formatSummaryMarkdown(result));

    // Exit code
    if (result.summary.errors > 0) {
      process.exitCode = 1;
    } else if (strict && result.summary.warnings > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Sanitize error output — strip control characters
    const safe = message.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    console.error(`::error::${safe}`);
    process.exitCode = 1;
  }
}

run();
