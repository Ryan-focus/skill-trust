import type { Rule, ParsedSkill, Finding } from "../types.js";
import { scanContent, type PatternDef } from "./utils.js";

const SHELL_PATTERNS: PatternDef[] = [
  // Python
  { regex: /\bimport\s+subprocess\b/, id: "import-subprocess", label: "import subprocess" },
  { regex: /\bfrom\s+subprocess\b/, id: "from-subprocess", label: "from subprocess import" },
  { regex: /\bsubprocess\.(run|call|Popen|check_output|check_call)\s*\(/, id: "subprocess-call", label: "subprocess call" },
  { regex: /\bos\.system\s*\(/, id: "os-system", label: "os.system()" },
  { regex: /\bos\.popen\s*\(/, id: "os-popen", label: "os.popen()" },
  { regex: /\bos\.exec\w*\s*\(/, id: "os-exec", label: "os.exec*()" },
  // Node.js
  { regex: /\brequire\s*\(\s*['"]child_process['"]/, id: "require-child-process", label: "require('child_process')" },
  { regex: /\bchild_process\b/, id: "child-process", label: "child_process usage" },
  { regex: /\bexecSync\s*\(/, id: "execSync", label: "execSync()" },
  { regex: /\bexecFile\s*\(/, id: "execFile", label: "execFile()" },
  { regex: /\bspawn\s*\(/, id: "spawn", label: "spawn()" },
  // General
  { regex: /\beval\s*\(/, id: "eval", label: "eval() call" },
  { regex: /\bpopen\s*\(/, id: "popen", label: "popen()" },
];

export const shellRule: Rule = {
  id: "shell",
  name: "Shell Consistency",
  description:
    "Checks that skills declaring shell=false do not contain shell execution patterns",

  check(skill: ParsedSkill): Finding[] {
    const trust = skill.trust;
    if (!trust) return [];

    if (trust.permissions.shell) return [];

    const findings: Finding[] = [];

    for (const file of skill.files) {
      const matches = scanContent(file.content, SHELL_PATTERNS, file.language);
      if (matches.length > 0) {
        const first = matches[0];
        const details = matches
          .slice(0, 3)
          .map((m) => `line ${m.line}: ${m.label}`)
          .join(", ");
        const more = matches.length > 3 ? ` (+${matches.length - 3} more)` : "";

        findings.push({
          rule: "shell",
          severity: "error",
          message: `Shell execution detected but permissions.shell is declared as false (${details}${more})`,
          file: file.relativePath,
          line: first.line,
          declared: "false",
          actual: `${matches.length} shell pattern(s) found`,
        });
      }
    }

    return findings;
  },
};
