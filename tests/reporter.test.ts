import { describe, it, expect } from "vitest";
import { buildSarif } from "../src/reporter.js";
import type { VerificationResult } from "../src/types.js";

// ---------------------------------------------------------------------------
// SARIF output
// ---------------------------------------------------------------------------

describe("buildSarif", () => {
  it("produces a valid SARIF 2.1.0 structure", () => {
    const result: VerificationResult = {
      skill: "test-skill",
      level: "VERIFIED",
      findings: [],
      summary: { errors: 0, warnings: 0, info: 0, passed: 6 },
    };

    const sarif = buildSarif(result) as Record<string, unknown>;
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif-schema-2.1.0");
    expect(Array.isArray(sarif.runs)).toBe(true);

    const runs = sarif.runs as Record<string, unknown>[];
    expect(runs).toHaveLength(1);

    const run = runs[0];
    const tool = run.tool as Record<string, unknown>;
    const driver = tool.driver as Record<string, unknown>;
    expect(driver.name).toBe("skill-trust");
    expect(driver.rules).toEqual([]);

    const results = run.results as unknown[];
    expect(results).toEqual([]);
  });

  it("maps findings to SARIF results with locations", () => {
    const result: VerificationResult = {
      skill: "test-skill",
      level: "INCONSISTENT",
      findings: [
        {
          rule: "network",
          severity: "error",
          message: "Network access detected",
          file: "scripts/run.py",
          line: 10,
        },
        {
          rule: "obfuscation",
          severity: "warning",
          message: "Base64 usage detected",
          file: "scripts/utils.py",
          line: 5,
        },
        {
          rule: "trust-declaration",
          severity: "info",
          message: "Missing trust block",
        },
      ],
      summary: { errors: 1, warnings: 1, info: 1, passed: 3 },
    };

    const sarif = buildSarif(result) as Record<string, unknown>;
    const runs = sarif.runs as Record<string, unknown>[];
    const run = runs[0];
    const sarifResults = run.results as Record<string, unknown>[];

    expect(sarifResults).toHaveLength(3);

    // Error => "error"
    expect(sarifResults[0].ruleId).toBe("network");
    expect(sarifResults[0].level).toBe("error");
    expect(sarifResults[0].locations).toBeDefined();

    // Warning => "warning"
    expect(sarifResults[1].ruleId).toBe("obfuscation");
    expect(sarifResults[1].level).toBe("warning");

    // Info => "note"
    expect(sarifResults[2].ruleId).toBe("trust-declaration");
    expect(sarifResults[2].level).toBe("note");
    expect(sarifResults[2].locations).toBeUndefined();
  });

  it("deduplicates rule definitions", () => {
    const result: VerificationResult = {
      skill: "test-skill",
      level: "INCONSISTENT",
      findings: [
        { rule: "network", severity: "error", message: "A", file: "a.py", line: 1 },
        { rule: "network", severity: "error", message: "B", file: "b.py", line: 2 },
      ],
      summary: { errors: 2, warnings: 0, info: 0, passed: 4 },
    };

    const sarif = buildSarif(result) as Record<string, unknown>;
    const runs = sarif.runs as Record<string, unknown>[];
    const driver = (runs[0].tool as Record<string, unknown>).driver as Record<string, unknown>;
    const rules = driver.rules as unknown[];
    expect(rules).toHaveLength(1);
  });
});
