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

/**
 * Strip ANSI/terminal control characters from untrusted strings
 * to prevent terminal escape sequence injection.
 * Preserves normal printable characters, spaces, and common whitespace.
 */
function stripControl(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

function reportTerminal(
  result: VerificationResult,
  verbose: boolean
): void {
  const border = "─".repeat(50);

  console.log();
  console.log(`┌${border}┐`);
  console.log(`│  ${"skill-trust verification report".padEnd(48)}│`);
  console.log(`│  Skill: ${stripControl(result.skill).padEnd(40)}│`);
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
      const loc = f.file ? ` (${stripControl(f.file)}${f.line ? `:${f.line}` : ""})` : "";
      console.log(`│  ${icon}  ${stripControl(f.message)}${loc}`);
      if (verbose && f.declared) {
        console.log(`│        declared=${stripControl(f.declared)}, actual=${stripControl(f.actual ?? "")}`);
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
 * Build a SARIF 2.1.0 log object from the verification result.
 * https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */
function buildSarif(result: VerificationResult): object {
  const severityToLevel: Record<Finding["severity"], string> = {
    error: "error",
    warning: "warning",
    info: "note",
  };

  // Collect unique rule IDs
  const ruleIds = [...new Set(result.findings.map((f) => f.rule))];
  const rules = ruleIds.map((id) => ({
    id,
    shortDescription: { text: id },
  }));

  const results = result.findings.map((f) => {
    const sarifResult: Record<string, unknown> = {
      ruleId: f.rule,
      level: severityToLevel[f.severity],
      message: { text: f.message },
    };

    if (f.file) {
      sarifResult.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: f.file },
            ...(f.line
              ? { region: { startLine: f.line } }
              : {}),
          },
        },
      ];
    }

    return sarifResult;
  });

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "skill-trust",
            version: "0.1.0",
            informationUri: "https://github.com/Ryan-focus/skill-trust",
            rules,
          },
        },
        results,
      },
    ],
  };
}

function reportSarif(result: VerificationResult): void {
  console.log(JSON.stringify(buildSarif(result), null, 2));
}

export { buildSarif };

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
    case "sarif":
      reportSarif(result);
      break;
    case "terminal":
    default:
      reportTerminal(result, verbose);
      break;
  }
}
