#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import { parseSkill, ParseError } from "./parser.js";
import { verify } from "./verifier.js";
import { report } from "./reporter.js";
import { generateBadgeSvg } from "./badge.js";
import { lookupSkill, publishResult, RegistryApiError } from "./registry.js";
import { verifyAll } from "./monorepo.js";
import { runWizard } from "./wizard.js";
import {
  scanWithCisco,
  scanWithAguara,
  createCombinedReport,
  printCombinedReport,
  combinedReportToJson,
} from "./integrations/index.js";
import type { ExternalScanResult } from "./integrations/types.js";
import type { OutputFormat } from "./types.js";

const VALID_FORMATS: readonly string[] = ["terminal", "json", "sarif"];

const program = new Command();

program
  .name("skill-trust")
  .description(
    "Transparency verifier for Agent Skills — verify that skills declare their behavior honestly."
  )
  .version("0.1.0");

program
  .command("verify <path>")
  .description("Verify trust declarations for a skill directory")
  .option("--strict", "Treat warnings as errors (exit 1 on warnings)", false)
  .option(
    "--format <format>",
    "Output format: terminal, json, sarif",
    "terminal"
  )
  .option("--verbose", "Show detailed output including declared vs actual values", false)
  .option("--publish", "Publish verification result to the Agent Skills registry", false)
  .option("--version-tag <version>", "Version tag when publishing to registry", "0.0.0")
  .option("--scan <scanners>", "Run external scanners (cisco, aguara, or both comma-separated)")
  .action(async (skillPath: string, options: {
    strict: boolean; format: string; verbose: boolean;
    publish: boolean; versionTag: string; scan?: string;
  }) => {
    try {
      if (!VALID_FORMATS.includes(options.format)) {
        console.error(`Error: Invalid format '${options.format}'. Must be one of: ${VALID_FORMATS.join(", ")}`);
        process.exit(2);
      }

      const skill = await parseSkill(skillPath);
      const result = verify(skill);

      // Run external scanners if requested
      if (options.scan) {
        const scanners = options.scan.split(",").map((s) => s.trim().toLowerCase());
        const externalScans: ExternalScanResult[] = [];

        for (const scanner of scanners) {
          try {
            if (scanner === "cisco") {
              const ciscoResult = await scanWithCisco(skill.name);
              externalScans.push(ciscoResult);
            } else if (scanner === "aguara") {
              const aguaraResult = await scanWithAguara(skill.name);
              externalScans.push(aguaraResult);
            } else {
              console.error(`Unknown scanner: ${scanner}. Available: cisco, aguara`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Scanner '${scanner}' failed: ${msg}`);
          }
        }

        if (externalScans.length > 0) {
          const combined = createCombinedReport(result, externalScans);
          if (options.format === "json") {
            console.log(combinedReportToJson(combined));
          } else {
            printCombinedReport(combined);
          }

          if (result.summary.errors > 0) process.exit(1);
          if (options.strict && result.summary.warnings > 0) process.exit(1);
          return;
        }
      }

      report(result, {
        format: options.format as OutputFormat,
        verbose: options.verbose,
        strict: options.strict,
      });

      // Publish to registry if requested
      if (options.publish) {
        try {
          await publishResult(skill.name, result, options.versionTag);
          console.log(`Published verification result for '${skill.name}' to registry.`);
        } catch (pubErr) {
          const msg = pubErr instanceof Error ? pubErr.message : String(pubErr);
          console.error(`Failed to publish: ${msg}`);
          process.exit(3);
        }
      }

      // Exit code logic
      if (result.summary.errors > 0) {
        process.exit(1);
      }
      if (options.strict && result.summary.warnings > 0) {
        process.exit(1);
      }
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
      }
      throw err;
    }
  });

program
  .command("verify-all <path>")
  .description("Verify all skills in a monorepo (recursively finds SKILL.md files)")
  .option("--strict", "Treat warnings as errors", false)
  .option(
    "--format <format>",
    "Output format: terminal, json",
    "terminal"
  )
  .action(async (rootPath: string, options: { strict: boolean; format: string }) => {
    try {
      const result = await verifyAll(rootPath);

      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Terminal output
      console.log();
      console.log(`  Monorepo Verification: ${path.resolve(rootPath)}`);
      console.log(`  ${"=".repeat(50)}`);
      console.log(`  Found ${result.summary.total} skill(s)\n`);

      for (const skill of result.skills) {
        if (skill.error) {
          console.log(`  [ERROR] ${skill.relativePath}: ${skill.error}`);
        } else if (skill.result) {
          const level = skill.result.level;
          const icon = level === "VERIFIED" ? "[PASS]"
            : level === "PARTIAL" ? "[WARN]"
              : level === "UNDECLARED" ? "[----]"
                : "[FAIL]";
          console.log(`  ${icon} ${skill.relativePath} (${skill.result.skill}): ${level}`);
        }
      }

      console.log();
      console.log(`  Summary: ${result.summary.verified} verified, ${result.summary.partial} partial, ${result.summary.undeclared} undeclared, ${result.summary.inconsistent} inconsistent, ${result.summary.errored} error(s)`);
      console.log();

      // Exit code
      if (result.summary.inconsistent > 0 || result.summary.errored > 0) {
        process.exit(1);
      }
      if (options.strict && result.summary.partial > 0) {
        process.exit(1);
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
      }
      throw err;
    }
  });

program
  .command("init [path]")
  .description("Interactive wizard to generate a SKILL.md trust declaration")
  .action(async (targetPath?: string) => {
    try {
      await runWizard(targetPath ?? ".");
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
      }
      throw err;
    }
  });

program
  .command("lookup <name>")
  .description("Look up a skill in the Agent Skills registry")
  .action(async (name: string) => {
    try {
      const info = await lookupSkill(name);
      console.log(JSON.stringify(info, null, 2));
    } catch (err) {
      if (err instanceof RegistryApiError) {
        console.error(`Registry error: ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  });

program
  .command("badge <path>")
  .description("Generate a trust badge SVG for a skill directory")
  .option("-o, --output <file>", "Write SVG to file instead of stdout")
  .action(async (skillPath: string, options: { output?: string }) => {
    try {
      const skill = await parseSkill(skillPath);
      const result = verify(skill);
      const svg = generateBadgeSvg(result.level);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const cwd = process.cwd();
        if (!outputPath.startsWith(cwd + path.sep) && outputPath !== cwd) {
          console.error(`Error: Output path must be within the current directory (${cwd}).`);
          process.exit(2);
        }
        fs.writeFileSync(outputPath, svg, "utf-8");
        console.log(`Badge written to ${outputPath}`);
      } else {
        console.log(svg);
      }
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
      }
      throw err;
    }
  });

program.parse();
