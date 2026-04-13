#!/usr/bin/env node
/**
 * GitHub Action entry point for skill-trust.
 *
 * Reads inputs from environment variables (INPUT_*), runs the verifier,
 * and writes outputs + summary using GITHUB_OUTPUT / GITHUB_STEP_SUMMARY.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseSkill } from "../parser.js";
import { verify } from "../verifier.js";
import { report } from "../reporter.js";
import type { OutputFormat, VerificationResult } from "../types.js";

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

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    // Fallback for local testing
    console.log(`::set-output name=${name}::${value}`);
  }
}

function writeSummary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, markdown + "\n");
  }
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

  lines.push(`## ${emoji} skill-trust: ${result.level}`);
  lines.push("");
  lines.push(`**Skill:** ${result.skill}`);
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("All checks passed!");
  } else {
    lines.push("| Severity | Rule | Message | Location |");
    lines.push("|----------|------|---------|----------|");
    for (const f of result.findings) {
      const icon = f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️" : "ℹ️";
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "-";
      lines.push(`| ${icon} ${f.severity} | ${f.rule} | ${f.message} | ${loc} |`);
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
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    const skillPath = getInput("skill_path", true);
    const strict = getInput("strict") === "true";
    const format = (getInput("format") || "terminal") as OutputFormat;

    const resolvedPath = path.resolve(skillPath);
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
    console.error(`::error::${message}`);
    process.exitCode = 1;
  }
}

run();
