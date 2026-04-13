import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { parseSkill, validateTrust, ParseError } from "../src/parser.js";

const fixture = (name: string) =>
  path.resolve(__dirname, "fixtures", name);

// ---------------------------------------------------------------------------
// parseSkill – happy paths
// ---------------------------------------------------------------------------

describe("parseSkill", () => {
  it("parses a valid skill with full trust declaration", async () => {
    const skill = await parseSkill(fixture("valid-skill"));

    expect(skill.name).toBe("csv-analyzer");
    expect(skill.description).toBe(
      "Analyze CSV files and generate summary statistics."
    );
    expect(skill.skillPath).toBe(fixture("valid-skill"));

    // Trust block
    expect(skill.trust).toBeDefined();
    expect(skill.trust!.permissions.network).toBe(false);
    expect(skill.trust!.permissions.filesystem.read).toBe(true);
    expect(skill.trust!.permissions.filesystem.write).toBe(true);
    expect(skill.trust!.permissions.filesystem.scope).toBe("outputs");
    expect(skill.trust!.permissions.shell).toBe(false);
    expect(skill.trust!.permissions.environment).toBe(false);

    expect(skill.trust!["data-flow"].exfiltration).toBe("none");

    expect(skill.trust!.dependencies?.runtime).toEqual(["python3"]);
    expect(skill.trust!.dependencies?.packages).toEqual([
      { name: "pandas", registry: "pypi" },
    ]);

    expect(skill.trust!.boundaries).toEqual([
      "Only reads CSV files specified by the user",
      "Does not execute any shell commands",
    ]);
  });

  it("collects script files from the skill directory", async () => {
    const skill = await parseSkill(fixture("valid-skill"));

    expect(skill.files.length).toBe(2);

    const py = skill.files.find((f) => f.relativePath === "scripts/analyze.py");
    expect(py).toBeDefined();
    expect(py!.language).toBe("python");
    expect(py!.content).toContain("pandas");

    const sh = skill.files.find((f) => f.relativePath === "scripts/helpers.sh");
    expect(sh).toBeDefined();
    expect(sh!.language).toBe("bash");
  });

  it("parses a skill with no trust block (UNDECLARED)", async () => {
    const skill = await parseSkill(fixture("no-trust-skill"));

    expect(skill.name).toBe("simple-skill");
    expect(skill.trust).toBeUndefined();
    expect(skill.files).toEqual([]);
  });

  it("parses a skill with exfiltration endpoints", async () => {
    const skill = await parseSkill(fixture("with-endpoints"));

    expect(skill.trust).toBeDefined();
    expect(skill.trust!.permissions.network).toBe(true);

    const exf = skill.trust!["data-flow"].exfiltration;
    expect(Array.isArray(exf)).toBe(true);
    expect(exf).toHaveLength(1);
    expect((exf as any[])[0]).toEqual({
      target: "https://api.example.com/reports",
      purpose: "Upload generated report",
      data: "output files only",
    });

    // Should find the JS file
    const js = skill.files.find((f) => f.relativePath === "scripts/upload.js");
    expect(js).toBeDefined();
    expect(js!.language).toBe("javascript");
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  it("throws when SKILL.md is missing", async () => {
    await expect(parseSkill(fixture("no-skillmd"))).rejects.toThrow(ParseError);
    await expect(parseSkill(fixture("no-skillmd"))).rejects.toThrow(
      /SKILL\.md not found/
    );
  });

  it("throws when trust block is invalid", async () => {
    await expect(parseSkill(fixture("invalid-trust-skill"))).rejects.toThrow(
      ParseError
    );
    await expect(parseSkill(fixture("invalid-trust-skill"))).rejects.toThrow(
      /network must be a boolean/
    );
  });
});

// ---------------------------------------------------------------------------
// validateTrust – unit tests
// ---------------------------------------------------------------------------

describe("validateTrust", () => {
  const minimal = () => ({
    permissions: {
      network: false,
      filesystem: { read: false, write: false, scope: "outputs" },
      shell: false,
      environment: false,
    },
    "data-flow": { exfiltration: "none" },
  });

  it("accepts a minimal valid trust object", () => {
    const result = validateTrust(minimal());
    expect(result.permissions.network).toBe(false);
    expect(result["data-flow"].exfiltration).toBe("none");
    expect(result.dependencies).toBeUndefined();
    expect(result.boundaries).toBeUndefined();
  });

  it("rejects non-object trust", () => {
    expect(() => validateTrust("string")).toThrow(ParseError);
    expect(() => validateTrust(null)).toThrow(ParseError);
    expect(() => validateTrust(42)).toThrow(ParseError);
  });

  it("rejects missing permissions", () => {
    expect(() =>
      validateTrust({ "data-flow": { exfiltration: "none" } })
    ).toThrow(/permissions must be an object/);
  });

  it("rejects missing data-flow", () => {
    const raw = minimal();
    delete (raw as any)["data-flow"];
    expect(() => validateTrust(raw)).toThrow(/data-flow must be an object/);
  });

  it("rejects invalid filesystem scope", () => {
    const raw = minimal();
    (raw.permissions.filesystem as any).scope = "everywhere";
    expect(() => validateTrust(raw)).toThrow(/scope must be one of/);
  });

  it("rejects invalid exfiltration value", () => {
    const raw = minimal();
    (raw as any)["data-flow"].exfiltration = "yes";
    expect(() => validateTrust(raw)).toThrow(/exfiltration must be "none" or an array/);
  });

  it("rejects endpoint with missing fields", () => {
    const raw = minimal();
    (raw as any)["data-flow"].exfiltration = [{ target: "https://x.com" }];
    expect(() => validateTrust(raw)).toThrow(/purpose must be a non-empty string/);
  });

  it("validates dependencies.runtime as string array", () => {
    const raw: any = minimal();
    raw.dependencies = { runtime: [123] };
    expect(() => validateTrust(raw)).toThrow(/runtime must be a string array/);
  });

  it("validates dependencies.packages entries", () => {
    const raw: any = minimal();
    raw.dependencies = { packages: [{ name: "foo" }] };
    expect(() => validateTrust(raw)).toThrow(/registry must be a non-empty string/);
  });

  it("validates boundaries as string array", () => {
    const raw: any = minimal();
    raw.boundaries = [1, 2, 3];
    expect(() => validateTrust(raw)).toThrow(/boundaries must be a string array/);
  });
});
