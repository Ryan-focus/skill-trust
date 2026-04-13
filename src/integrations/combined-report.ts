/**
 * Combined report generator — merges skill-trust verification results
 * with external scanner outputs (Cisco, Aguara) into a unified report.
 */

import chalk from "chalk";
import type { VerificationResult } from "../types.js";
import type { ExternalScanResult, CombinedReport } from "./types.js";

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Merge a skill-trust verification result with external scan results
 * into a single combined report.
 */
export function createCombinedReport(
  trustResult: VerificationResult,
  externalScans: ExternalScanResult[]
): CombinedReport {
  const totalExternalFindings = externalScans.reduce(
    (sum, s) => sum + s.findings.length,
    0
  );
  const criticalFindings = externalScans.reduce(
    (sum, s) => sum + s.findings.filter((f) => f.severity === "critical").length,
    0
  );
  const highFindings = externalScans.reduce(
    (sum, s) => sum + s.findings.filter((f) => f.severity === "high").length,
    0
  );

  const overallRisk = computeOverallRisk(trustResult, externalScans);

  return {
    skill: trustResult.skill,
    timestamp: new Date().toISOString(),
    trustVerification: trustResult,
    externalScans,
    overallRisk,
    summary: {
      trustLevel: trustResult.level,
      totalExternalFindings,
      criticalFindings,
      highFindings,
    },
  };
}

// ---------------------------------------------------------------------------
// Risk computation
// ---------------------------------------------------------------------------

const RISK_ORDER = ["low", "medium", "high", "critical"] as const;
type RiskLevel = (typeof RISK_ORDER)[number];

function computeOverallRisk(
  trustResult: VerificationResult,
  externalScans: ExternalScanResult[]
): RiskLevel {
  // Start with trust level mapping
  let maxRisk: RiskLevel = "low";

  if (trustResult.level === "INCONSISTENT") maxRisk = "high";
  else if (trustResult.level === "UNDECLARED") maxRisk = "medium";
  else if (trustResult.level === "PARTIAL") maxRisk = "low";

  // Incorporate external scan risks
  for (const scan of externalScans) {
    if (scan.risk !== "unknown") {
      const scanRisk = scan.risk as RiskLevel;
      if (RISK_ORDER.indexOf(scanRisk) > RISK_ORDER.indexOf(maxRisk)) {
        maxRisk = scanRisk;
      }
    }
  }

  // Critical external findings always escalate
  const hasCritical = externalScans.some((s) =>
    s.findings.some((f) => f.severity === "critical")
  );
  if (hasCritical) maxRisk = "critical";

  return maxRisk;
}

// ---------------------------------------------------------------------------
// Terminal output
// ---------------------------------------------------------------------------

/**
 * Strip terminal control characters from untrusted strings
 * to prevent terminal escape sequence injection.
 */
function stripControl(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

const RISK_COLOR: Record<string, (s: string) => string> = {
  low: chalk.green,
  medium: chalk.yellow,
  high: chalk.red,
  critical: chalk.bgRed.white,
};

/**
 * Print a combined report to the terminal.
 */
export function printCombinedReport(report: CombinedReport): void {
  const border = "─".repeat(60);

  console.log();
  console.log(`┌${border}┐`);
  console.log(`│  ${"COMBINED SECURITY REPORT".padEnd(58)}│`);
  console.log(`│  Skill: ${stripControl(report.skill).padEnd(50)}│`);
  console.log(`├${border}┤`);

  // Trust verification section
  const trustColor =
    report.trustVerification.level === "VERIFIED"
      ? chalk.green
      : report.trustVerification.level === "PARTIAL"
        ? chalk.yellow
        : chalk.red;
  console.log(
    `│  Trust Verification: ${trustColor(report.trustVerification.level).padEnd(48)}│`
  );

  const { errors, warnings } = report.trustVerification.summary;
  if (errors > 0 || warnings > 0) {
    const parts: string[] = [];
    if (errors > 0) parts.push(chalk.red(`${errors} error(s)`));
    if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning(s)`));
    console.log(`│    ${parts.join(", ")}`);
  }

  // External scans section
  if (report.externalScans.length > 0) {
    console.log(`├${border}┤`);
    console.log(`│  ${"External Scans:".padEnd(58)}│`);

    for (const scan of report.externalScans) {
      const riskFn = RISK_COLOR[scan.risk] ?? chalk.gray;
      console.log(
        `│    ${scan.scanner}: ${riskFn(scan.risk.toUpperCase())} (${scan.findings.length} finding(s))`
      );

      // Show top findings
      const top = scan.findings.slice(0, 3);
      for (const f of top) {
        const sevColor =
          f.severity === "critical" || f.severity === "high"
            ? chalk.red
            : f.severity === "medium"
              ? chalk.yellow
              : chalk.gray;
        const loc = f.file ? ` (${stripControl(f.file)}${f.line ? `:${f.line}` : ""})` : "";
        console.log(`│      ${sevColor(f.severity.toUpperCase())} ${stripControl(f.title)}${loc}`);
      }
      if (scan.findings.length > 3) {
        console.log(
          `│      ... and ${scan.findings.length - 3} more finding(s)`
        );
      }
    }
  }

  // Overall risk
  console.log(`├${border}┤`);
  const riskFn = RISK_COLOR[report.overallRisk] ?? chalk.gray;
  console.log(
    `│  Overall Risk: ${riskFn(report.overallRisk.toUpperCase())}`
  );
  console.log(`└${border}┘`);
  console.log();
}

/**
 * Format the combined report as JSON.
 */
export function combinedReportToJson(report: CombinedReport): string {
  return JSON.stringify(report, null, 2);
}
