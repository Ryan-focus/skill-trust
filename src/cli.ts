#!/usr/bin/env node
import * as fs from "node:fs";
import { Command } from "commander";
import { parseSkill, ParseError } from "./parser.js";
import { verify } from "./verifier.js";
import { report } from "./reporter.js";
import { generateBadgeSvg } from "./badge.js";
import { lookupSkill, publishResult, RegistryApiError } from "./registry.js";
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
    "Output format: terminal, json, sarif",
    "terminal"
  )
  .option("--verbose", "Show detailed output including declared vs actual values", false)
  .option("--publish", "Publish verification result to the Agent Skills registry", false)
  .option("--version-tag <version>", "Version tag when publishing to registry", "0.0.0")
  .action(async (skillPath: string, options: { strict: boolean; format: string; verbose: boolean; publish: boolean; versionTag: string }) => {
    try {
      const skill = await parseSkill(skillPath);
      const result = verify(skill);

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
        fs.writeFileSync(options.output, svg, "utf-8");
        console.log(`Badge written to ${options.output}`);
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
