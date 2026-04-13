import chalk from "chalk";
import type {
  VerificationResult,
  Finding,
  TrustLevel,
  ReporterOptions,
} from "./types.js";

const LEVEL_BADGE: Record<TrustLevel, string> = {
  VERIFIED: chalk.green("VERIFIED"),
  PARTIAL: chalk.yellow("PARTIAL"),
  UNDECLARED: chalk.white("UNDECLARED"),
  INCONSISTENT: chalk.red("INCONSISTENT"),
};

const SEVERITY_ICON: Record<Finding["severity"], string> = {
  error: chalk.red("FAIL"),
  warning: chalk.yellow("WARN"),
  info: chalk.blue("INFO"),
};

function reportTerminal(
  result: VerificationResult,
  verbose: boolean
): void {
  const border = "─".repeat(50);

  console.log();
  console.log(`┌${border}┐`);
  console.log(`│  ${"skill-trust verification report".padEnd(48)}│`);
  console.log(`│  Skill: ${result.skill.padEnd(40)}│`);
  console.log(
    `│  Status: ${LEVEL_BADGE[result.level]}${" ".repeat(
      Math.max(0, 39 - result.level.length)
    )}│`
  );
  console.log(`├${border}┤`);

  if (result.findings.length === 0) {
    console.log(`│  ${chalk.green("✅ All checks passed!").padEnd(48)}│`);
  } else {
    for (const f of result.findings) {
      const icon = SEVERITY_ICON[f.severity];
      const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : "";
      console.log(`│  ${icon}  ${f.message}${loc}`);
      if (verbose && f.declared) {
        console.log(`│        declared=${f.declared}, actual=${f.actual}`);
      }
    }
  }

  console.log(`├${border}┤`);
  const { errors, warnings, info, passed } = result.summary;
  const summaryParts: string[] = [];
  if (passed > 0) summaryParts.push(chalk.green(`${passed} passed`));
  if (errors > 0) summaryParts.push(chalk.red(`${errors} error(s)`));
  if (warnings > 0) summaryParts.push(chalk.yellow(`${warnings} warning(s)`));
  if (info > 0) summaryParts.push(chalk.blue(`${info} info`));
  console.log(`│  ${summaryParts.join(", ")}`);
  console.log(`└${border}┘`);
  console.log();
}

function reportJson(result: VerificationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Output the verification result in the requested format.
 */
export function report(
  result: VerificationResult,
  options: Partial<ReporterOptions> = {}
): void {
  const format = options.format ?? "terminal";
  const verbose = options.verbose ?? false;

  switch (format) {
    case "json":
      reportJson(result);
      break;
    case "terminal":
    default:
      reportTerminal(result, verbose);
      break;
  }
}
