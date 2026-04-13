import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { discoverSkills, verifyAll } from "../src/monorepo.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempMonorepo(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trust-mono-"));

  // Skill A — valid
  const skillA = path.join(tmpDir, "skills", "skill-a");
  fs.mkdirSync(skillA, { recursive: true });
  fs.writeFileSync(
    path.join(skillA, "SKILL.md"),
    `---
name: "skill-a"
description: "A test skill"
trust:
  permissions:
    network: false
    filesystem:
      read: false
      write: false
      scope: "outputs"
    shell: false
    environment: false
  data-flow:
    exfiltration: "none"
---
# Skill A
`,
    "utf-8"
  );
  fs.writeFileSync(path.join(skillA, "main.py"), 'print("hello")\n', "utf-8");

  // Skill B — no trust block
  const skillB = path.join(tmpDir, "skills", "skill-b");
  fs.mkdirSync(skillB, { recursive: true });
  fs.writeFileSync(
    path.join(skillB, "SKILL.md"),
    `---
name: "skill-b"
description: "Another test skill"
---
# Skill B
`,
    "utf-8"
  );

  // Skill C — nested deeper
  const skillC = path.join(tmpDir, "packages", "core", "skill-c");
  fs.mkdirSync(skillC, { recursive: true });
  fs.writeFileSync(
    path.join(skillC, "SKILL.md"),
    `---
name: "skill-c"
description: "Nested skill"
trust:
  permissions:
    network: false
    filesystem:
      read: false
      write: false
      scope: "outputs"
    shell: false
    environment: false
  data-flow:
    exfiltration: "none"
---
# Skill C
`,
    "utf-8"
  );
  fs.writeFileSync(path.join(skillC, "index.js"), 'console.log("ok")\n', "utf-8");

  return tmpDir;
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("discoverSkills", () => {
  it("finds all SKILL.md files recursively", async () => {
    const tmpDir = createTempMonorepo();
    try {
      const skills = await discoverSkills(tmpDir);
      expect(skills).toHaveLength(3);
      const names = skills.map((s) => path.basename(s));
      expect(names).toContain("skill-a");
      expect(names).toContain("skill-b");
      expect(names).toContain("skill-c");
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns empty array when no skills found", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trust-empty-"));
    try {
      const skills = await discoverSkills(tmpDir);
      expect(skills).toHaveLength(0);
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe("verifyAll", () => {
  it("verifies all skills and returns aggregated result", async () => {
    const tmpDir = createTempMonorepo();
    try {
      const result = await verifyAll(tmpDir);

      expect(result.skills).toHaveLength(3);
      expect(result.summary.total).toBe(3);

      // skill-a should be VERIFIED
      const skillA = result.skills.find((s) => s.result?.skill === "skill-a");
      expect(skillA?.result?.level).toBe("VERIFIED");

      // skill-b has no trust block — UNDECLARED
      const skillB = result.skills.find((s) => s.result?.skill === "skill-b");
      expect(skillB?.result?.level).toBe("UNDECLARED");

      // skill-c should be VERIFIED
      const skillC = result.skills.find((s) => s.result?.skill === "skill-c");
      expect(skillC?.result?.level).toBe("VERIFIED");
    } finally {
      cleanup(tmpDir);
    }
  });

  it("captures parse errors without aborting", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trust-err-"));
    const badSkill = path.join(tmpDir, "bad-skill");
    fs.mkdirSync(badSkill, { recursive: true });
    fs.writeFileSync(
      path.join(badSkill, "SKILL.md"),
      `---
name: "bad"
description: "Bad skill"
trust:
  permissions:
    network: "not-a-boolean"
---
`,
      "utf-8"
    );

    try {
      const result = await verifyAll(tmpDir);
      expect(result.summary.errored).toBe(1);
      expect(result.skills[0].error).toBeTruthy();
    } finally {
      cleanup(tmpDir);
    }
  });
});
