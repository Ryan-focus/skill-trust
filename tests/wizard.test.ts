import { describe, it, expect } from "vitest";
import { generateSkillMd } from "../src/wizard.js";

// ---------------------------------------------------------------------------
// generateSkillMd (non-interactive — tests the YAML generation)
// ---------------------------------------------------------------------------

describe("generateSkillMd", () => {
  it("generates minimal SKILL.md with all fields set to false/none", () => {
    const content = generateSkillMd({
      name: "test-skill",
      description: "A minimal test skill",
      network: false,
      fsRead: false,
      fsWrite: false,
      fsScope: "outputs",
      shell: false,
      environment: false,
      exfiltration: "none",
      endpoints: [],
      runtimeDeps: [],
      packages: [],
      boundaries: [],
    });

    expect(content).toContain('name: "test-skill"');
    expect(content).toContain('description: "A minimal test skill"');
    expect(content).toContain("network: false");
    expect(content).toContain("read: false");
    expect(content).toContain("write: false");
    expect(content).toContain('scope: "outputs"');
    expect(content).toContain("shell: false");
    expect(content).toContain("environment: false");
    expect(content).toContain('exfiltration: "none"');
    expect(content).toContain("---");
    expect(content).toContain("# test-skill");
  });

  it("generates SKILL.md with all permissions enabled", () => {
    const content = generateSkillMd({
      name: "full-access-skill",
      description: "Does everything",
      network: true,
      fsRead: true,
      fsWrite: true,
      fsScope: "system",
      shell: true,
      environment: true,
      exfiltration: "endpoints",
      endpoints: [
        { target: "https://api.example.com", purpose: "Upload results", data: "Reports" },
      ],
      runtimeDeps: ["python3", "jq"],
      packages: [
        { name: "requests", registry: "pypi" },
        { name: "axios", registry: "npm" },
      ],
      boundaries: ["Never modifies input files", "Only reads CSV files"],
    });

    expect(content).toContain("network: true");
    expect(content).toContain("shell: true");
    expect(content).toContain("environment: true");
    expect(content).toContain('scope: "system"');
    expect(content).toContain("exfiltration:");
    expect(content).toContain('target: "https://api.example.com"');
    expect(content).toContain('purpose: "Upload results"');
    expect(content).toContain('data: "Reports"');
    expect(content).toContain("runtime:");
    expect(content).toContain('"python3"');
    expect(content).toContain('"jq"');
    expect(content).toContain("packages:");
    expect(content).toContain('"requests"');
    expect(content).toContain('"pypi"');
    expect(content).toContain("boundaries:");
    expect(content).toContain('"Never modifies input files"');
  });

  it("escapes special YAML characters", () => {
    const content = generateSkillMd({
      name: 'skill-with-"quotes"',
      description: "A skill with \\ backslashes",
      network: false,
      fsRead: false,
      fsWrite: false,
      fsScope: "outputs",
      shell: false,
      environment: false,
      exfiltration: "none",
      endpoints: [],
      runtimeDeps: [],
      packages: [],
      boundaries: [],
    });

    expect(content).toContain('\\"quotes\\"');
    expect(content).toContain("\\\\ backslashes");
  });

  it("omits dependencies section when empty", () => {
    const content = generateSkillMd({
      name: "simple",
      description: "Simple skill",
      network: false,
      fsRead: false,
      fsWrite: false,
      fsScope: "outputs",
      shell: false,
      environment: false,
      exfiltration: "none",
      endpoints: [],
      runtimeDeps: [],
      packages: [],
      boundaries: [],
    });

    expect(content).not.toContain("dependencies:");
    expect(content).not.toContain("runtime:");
    expect(content).not.toContain("packages:");
  });

  it("omits boundaries section when empty", () => {
    const content = generateSkillMd({
      name: "simple",
      description: "Simple skill",
      network: false,
      fsRead: false,
      fsWrite: false,
      fsScope: "outputs",
      shell: false,
      environment: false,
      exfiltration: "none",
      endpoints: [],
      runtimeDeps: [],
      packages: [],
      boundaries: [],
    });

    expect(content).not.toContain("boundaries:");
  });
});
