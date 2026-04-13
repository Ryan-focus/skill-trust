import { describe, it, expect } from "vitest";
import { createCombinedReport, combinedReportToJson } from "../src/integrations/combined-report.js";
import type { VerificationResult } from "../src/types.js";
import type { ExternalScanResult } from "../src/integrations/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVerificationResult(
  overrides: Partial<VerificationResult> = {}
): VerificationResult {
  return {
    skill: "test-skill",
    level: "VERIFIED",
    findings: [],
    summary: { errors: 0, warnings: 0, info: 0, passed: 6 },
    ...overrides,
  };
}

function makeCiscoScan(
  overrides: Partial<ExternalScanResult> = {}
): ExternalScanResult {
  return {
    scanner: "Cisco Skill Scanner",
    version: "2.0.0",
    timestamp: "2026-01-01T00:00:00Z",
    risk: "low",
    findings: [],
    ...overrides,
  };
}

function makeAguaraScan(
  overrides: Partial<ExternalScanResult> = {}
): ExternalScanResult {
  return {
    scanner: "Aguara",
    version: "1.5.0",
    timestamp: "2026-01-01T00:00:00Z",
    risk: "low",
    findings: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createCombinedReport", () => {
  it("creates a combined report with no external findings", () => {
    const trust = makeVerificationResult();
    const report = createCombinedReport(trust, []);

    expect(report.skill).toBe("test-skill");
    expect(report.trustVerification.level).toBe("VERIFIED");
    expect(report.externalScans).toHaveLength(0);
    expect(report.overallRisk).toBe("low");
    expect(report.summary.totalExternalFindings).toBe(0);
  });

  it("incorporates Cisco scan results", () => {
    const trust = makeVerificationResult();
    const cisco = makeCiscoScan({
      risk: "medium",
      findings: [
        {
          id: "CISCO-001",
          title: "Unvalidated input",
          severity: "medium",
          description: "Input not validated before use",
        },
      ],
    });

    const report = createCombinedReport(trust, [cisco]);
    expect(report.externalScans).toHaveLength(1);
    expect(report.summary.totalExternalFindings).toBe(1);
    expect(report.overallRisk).toBe("medium");
  });

  it("incorporates Aguara scan results", () => {
    const trust = makeVerificationResult();
    const aguara = makeAguaraScan({
      risk: "high",
      findings: [
        {
          id: "AG-001",
          title: "Suspicious data flow",
          severity: "high",
          description: "Data sent to unknown endpoint",
        },
      ],
    });

    const report = createCombinedReport(trust, [aguara]);
    expect(report.overallRisk).toBe("high");
    expect(report.summary.highFindings).toBe(1);
  });

  it("escalates to critical when critical findings exist", () => {
    const trust = makeVerificationResult();
    const cisco = makeCiscoScan({
      risk: "high",
      findings: [
        {
          id: "CISCO-CRIT",
          title: "RCE vulnerability",
          severity: "critical",
          description: "Remote code execution possible",
        },
      ],
    });

    const report = createCombinedReport(trust, [cisco]);
    expect(report.overallRisk).toBe("critical");
    expect(report.summary.criticalFindings).toBe(1);
  });

  it("combines trust INCONSISTENT with external scans", () => {
    const trust = makeVerificationResult({
      level: "INCONSISTENT",
      summary: { errors: 2, warnings: 0, info: 0, passed: 4 },
    });
    const cisco = makeCiscoScan({ risk: "low" });

    const report = createCombinedReport(trust, [cisco]);
    // INCONSISTENT maps to "high", which is higher than "low"
    expect(report.overallRisk).toBe("high");
  });

  it("merges multiple external scans", () => {
    const trust = makeVerificationResult();
    const cisco = makeCiscoScan({
      findings: [
        { id: "C1", title: "Issue 1", severity: "low", description: "Low issue" },
      ],
    });
    const aguara = makeAguaraScan({
      findings: [
        { id: "A1", title: "Issue 2", severity: "medium", description: "Medium issue" },
        { id: "A2", title: "Issue 3", severity: "high", description: "High issue" },
      ],
    });

    const report = createCombinedReport(trust, [cisco, aguara]);
    expect(report.externalScans).toHaveLength(2);
    expect(report.summary.totalExternalFindings).toBe(3);
    expect(report.summary.highFindings).toBe(1);
  });
});

describe("combinedReportToJson", () => {
  it("produces valid JSON", () => {
    const trust = makeVerificationResult();
    const report = createCombinedReport(trust, []);
    const json = combinedReportToJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.skill).toBe("test-skill");
    expect(parsed.overallRisk).toBe("low");
    expect(parsed.trustVerification).toBeDefined();
  });
});
