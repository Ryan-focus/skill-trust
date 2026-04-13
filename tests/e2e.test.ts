import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { parseSkill } from "../src/parser.js";
import { verify } from "../src/verifier.js";

const examples = (name: string) =>
  path.resolve(__dirname, "..", "examples", name);

// ---------------------------------------------------------------------------
// End-to-end: trusted skill (csv-analyzer)
// ---------------------------------------------------------------------------

describe("e2e: trusted skill (csv-analyzer)", () => {
  it("parses and verifies as VERIFIED with 0 findings", async () => {
    const skill = await parseSkill(examples("trusted-skill"));
    const result = verify(skill);

    expect(result.skill).toBe("csv-analyzer");
    expect(result.level).toBe("VERIFIED");
    expect(result.findings).toEqual([]);
    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.summary.passed).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: untrusted skill (text-formatter)
// ---------------------------------------------------------------------------

describe("e2e: untrusted skill (text-formatter)", () => {
  it("parses and verifies as INCONSISTENT", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    expect(result.skill).toBe("text-formatter");
    expect(result.level).toBe("INCONSISTENT");
  });

  it("produces exactly 5 findings", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    expect(result.findings).toHaveLength(5);
  });

  it("detects network violation (network=false but uses requests)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const networkFindings = result.findings.filter((f) => f.rule === "network");
    expect(networkFindings).toHaveLength(1);
    expect(networkFindings[0].severity).toBe("error");
    expect(networkFindings[0].message).toContain("permissions.network is declared as false");
  });

  it("detects filesystem scope violation (scope=outputs but writes to /tmp)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const fsFindings = result.findings.filter((f) => f.rule === "filesystem");
    expect(fsFindings).toHaveLength(1);
    expect(fsFindings[0].severity).toBe("error");
    expect(fsFindings[0].message).toContain("/tmp");
    expect(fsFindings[0].message).toContain("outside declared scope");
  });

  it("detects shell violation (shell=false but uses subprocess)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const shellFindings = result.findings.filter((f) => f.rule === "shell");
    expect(shellFindings).toHaveLength(1);
    expect(shellFindings[0].severity).toBe("error");
    expect(shellFindings[0].message).toContain("permissions.shell is declared as false");
  });

  it("detects data-flow violation (exfiltration=none but sends data)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const dfFindings = result.findings.filter((f) => f.rule === "data-flow");
    expect(dfFindings).toHaveLength(1);
    expect(dfFindings[0].severity).toBe("error");
    expect(dfFindings[0].message).toContain("exfiltration is declared as 'none'");
  });

  it("detects undeclared dependency (requests not in packages)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const depFindings = result.findings.filter((f) => f.rule === "dependency");
    expect(depFindings).toHaveLength(1);
    expect(depFindings[0].severity).toBe("warning");
    expect(depFindings[0].message).toContain("requests");
  });

  it("correctly counts 4 errors and 1 warning", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    expect(result.summary.errors).toBe(4);
    expect(result.summary.warnings).toBe(1);
  });

  it("environment and obfuscation rules pass (no violations)", async () => {
    const skill = await parseSkill(examples("untrusted-skill"));
    const result = verify(skill);

    const envFindings = result.findings.filter((f) => f.rule === "environment");
    const obfFindings = result.findings.filter((f) => f.rule === "obfuscation");
    expect(envFindings).toHaveLength(0);
    expect(obfFindings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: skill with no trust declaration
// ---------------------------------------------------------------------------

describe("e2e: skill with no trust declaration", () => {
  it("produces UNDECLARED level", async () => {
    const fixtureDir = path.resolve(__dirname, "fixtures", "no-trust-skill");
    const skill = await parseSkill(fixtureDir);
    const result = verify(skill);

    expect(result.level).toBe("UNDECLARED");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].rule).toBe("trust-declaration");
    expect(result.findings[0].severity).toBe("info");
  });
});
