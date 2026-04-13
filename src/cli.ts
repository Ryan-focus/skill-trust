#!/usr/bin/env node
import { Command } from "commander";
import { parseSkill, ParseError } from "./parser.js";
import { verify } from "./verifier.js";
import { report } from "./reporter.js";
import type { OutputFormat } from "./types.js";

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
    "Output format: terminal, json",
    "terminal"
  )
  .option("--verbose", "Show detailed output including declared vs actual values", false)
  .action(async (skillPath: string, options: { strict: boolean; format: string; verbose: boolean }) => {
    try {
      const skill = await parseSkill(skillPath);
      const result = verify(skill);

      report(result, {
        format: options.format as OutputFormat,
        verbose: options.verbose,
        strict: options.strict,
      });

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

program.parse();
