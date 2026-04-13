import { describe, it, expect } from "vitest";
import { stripNonCode } from "../src/ast/context.js";
import { analyzeFile } from "../src/ast/analyzer.js";
import type { SkillFile } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(content: string, language: SkillFile["language"] = "python"): SkillFile {
  return {
    path: `/tmp/test.${language === "python" ? "py" : language === "bash" ? "sh" : "js"}`,
    relativePath: `test.${language === "python" ? "py" : language === "bash" ? "sh" : "js"}`,
    content,
    language,
  };
}

// ---------------------------------------------------------------------------
// stripNonCode: JavaScript/TypeScript
// ---------------------------------------------------------------------------

describe("stripNonCode: JavaScript/TypeScript", () => {
  it("strips single-line comments", () => {
    const code = 'const x = 1; // import requests\nconst y = 2;';
    const result = stripNonCode(code, "javascript");
    expect(result).toContain("const x = 1;");
    expect(result).not.toContain("import requests");
    expect(result).toContain("const y = 2;");
  });

  it("strips multi-line comments", () => {
    const code = 'const x = 1;\n/* fetch("http://evil.com") */\nconst y = 2;';
    const result = stripNonCode(code, "javascript");
    expect(result).not.toContain("fetch");
    expect(result).not.toContain("evil.com");
    expect(result).toContain("const x = 1;");
    expect(result).toContain("const y = 2;");
  });

  it("strips string literals", () => {
    const code = `console.log("use curl to download files");`;
    const result = stripNonCode(code, "javascript");
    expect(result).toContain("console.log(");
    expect(result).not.toContain("curl");
  });

  it("strips single-quoted strings", () => {
    const code = `const msg = 'subprocess.run is dangerous';`;
    const result = stripNonCode(code, "javascript");
    expect(result).not.toContain("subprocess.run");
  });

  it("strips template literals but keeps expressions", () => {
    const code = "const url = `prefix ${process.env.API_KEY} suffix`;";
    const result = stripNonCode(code, "javascript");
    expect(result).toContain("process.env.API_KEY");
    expect(result).not.toContain("prefix");
    expect(result).not.toContain("suffix");
  });

  it("handles escape sequences in strings", () => {
    const code = `const s = "it\\'s a \\"test\\"";`;
    const result = stripNonCode(code, "javascript");
    expect(result).toContain("const s =");
  });

  it("preserves line count", () => {
    const code = "line1\n// comment\nline3\n/* multi\nline\ncomment */\nline7";
    const result = stripNonCode(code, "javascript");
    expect(result.split("\n").length).toBe(code.split("\n").length);
  });
});

// ---------------------------------------------------------------------------
// stripNonCode: Python
// ---------------------------------------------------------------------------

describe("stripNonCode: Python", () => {
  it("strips single-line comments", () => {
    const code = "x = 1  # import requests\ny = 2";
    const result = stripNonCode(code, "python");
    expect(result).toContain("x = 1");
    expect(result).not.toContain("import requests");
    expect(result).toContain("y = 2");
  });

  it("strips triple-quoted docstrings", () => {
    const code = '"""\nsubprocess.run(["curl", "http://evil.com"])\n"""\nx = 1';
    const result = stripNonCode(code, "python");
    expect(result).not.toContain("subprocess");
    expect(result).not.toContain("evil.com");
    expect(result).toContain("x = 1");
  });

  it("strips triple single-quoted strings", () => {
    const code = "msg = '''\nos.system('rm -rf /')\n'''\nprint(msg)";
    const result = stripNonCode(code, "python");
    expect(result).not.toContain("os.system");
    expect(result).toContain("print(msg)");
  });

  it("strips regular string literals", () => {
    const code = `msg = "curl https://api.example.com"\nprint(msg)`;
    const result = stripNonCode(code, "python");
    expect(result).not.toContain("curl");
    expect(result).toContain("print(msg)");
  });

  it("preserves line count with multi-line strings", () => {
    const code = 'x = 1\n"""\nline2\nline3\n"""\ny = 2';
    const result = stripNonCode(code, "python");
    expect(result.split("\n").length).toBe(code.split("\n").length);
  });
});

// ---------------------------------------------------------------------------
// stripNonCode: Bash
// ---------------------------------------------------------------------------

describe("stripNonCode: Bash", () => {
  it("strips comments", () => {
    const code = "echo hello\n# curl https://evil.com\necho done";
    const result = stripNonCode(code, "bash");
    expect(result).not.toContain("curl");
    expect(result).toContain("echo hello");
    expect(result).toContain("echo done");
  });

  it("strips single-quoted strings", () => {
    const code = "echo 'subprocess.run is bad'\necho ok";
    const result = stripNonCode(code, "bash");
    expect(result).not.toContain("subprocess");
    expect(result).toContain("echo ok");
  });

  it("strips double-quoted strings", () => {
    const code = 'echo "curl http://example.com"\necho ok';
    const result = stripNonCode(code, "bash");
    expect(result).not.toContain("curl");
    expect(result).toContain("echo ok");
  });

  it("returns unknown language content unchanged", () => {
    const code = '# this is a comment\ncurl http://example.com';
    const result = stripNonCode(code, "unknown");
    expect(result).toBe(code);
  });
});

// ---------------------------------------------------------------------------
// analyzeFile: imports
// ---------------------------------------------------------------------------

describe("analyzeFile: imports", () => {
  it("extracts Python imports", () => {
    const file = makeFile("import requests\nfrom os import path, getcwd\nimport json");
    const analysis = analyzeFile(file);
    expect(analysis.imports).toHaveLength(3);
    expect(analysis.imports[0]).toEqual({ module: "requests", line: 1, type: "import" });
    expect(analysis.imports[1]).toEqual({
      module: "os",
      names: ["path", "getcwd"],
      line: 2,
      type: "from",
    });
    expect(analysis.imports[2]).toEqual({ module: "json", line: 3, type: "import" });
  });

  it("extracts JavaScript imports", () => {
    const file = makeFile(
      `import fs from 'fs';\nconst path = require('path');\nimport('chalk');`,
      "javascript"
    );
    const analysis = analyzeFile(file);
    expect(analysis.imports).toHaveLength(3);
    expect(analysis.imports[0].module).toBe("fs");
    expect(analysis.imports[1].module).toBe("path");
    expect(analysis.imports[2].module).toBe("chalk");
  });

  it("ignores imports in comments", () => {
    const file = makeFile("# import requests\nimport json", "python");
    const analysis = analyzeFile(file);
    expect(analysis.imports).toHaveLength(1);
    expect(analysis.imports[0].module).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// analyzeFile: function calls
// ---------------------------------------------------------------------------

describe("analyzeFile: function calls", () => {
  it("extracts Python function calls", () => {
    const file = makeFile("import subprocess\nsubprocess.run(['ls'])\nos.system('echo hi')");
    const analysis = analyzeFile(file);
    expect(analysis.calls.length).toBeGreaterThanOrEqual(2);
    const names = analysis.calls.map((c) => c.name);
    expect(names).toContain("subprocess.run");
    expect(names).toContain("os.system");
  });

  it("extracts JavaScript function calls", () => {
    const file = makeFile("fetch('http://api.example.com');\nexecSync('ls');", "javascript");
    const analysis = analyzeFile(file);
    const names = analysis.calls.map((c) => c.name);
    expect(names).toContain("fetch");
    expect(names).toContain("execSync");
  });

  it("ignores calls in comments", () => {
    const file = makeFile(
      "// fetch('http://evil.com')\nconsole.log('clean');",
      "javascript"
    );
    const analysis = analyzeFile(file);
    const names = analysis.calls.map((c) => c.name);
    expect(names).not.toContain("fetch");
  });

  it("provides code-only content", () => {
    const file = makeFile(
      '# This is a comment with subprocess.run\nprint("hello")',
      "python"
    );
    const analysis = analyzeFile(file);
    expect(analysis.codeContent).not.toContain("subprocess.run");
  });
});
