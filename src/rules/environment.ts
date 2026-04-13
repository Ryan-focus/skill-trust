import type { Rule, ParsedSkill, Finding } from "../types.js";
import { scanContent, type PatternDef } from "./utils.js";

const ENV_PATTERNS: PatternDef[] = [
  // Node.js
  { regex: /\bprocess\.env\b/, id: "process-env", label: "process.env" },
  // Python
  { regex: /\bos\.environ\b/, id: "os-environ", label: "os.environ" },
  { regex: /\bos\.getenv\s*\(/, id: "os-getenv", label: "os.getenv()" },
  // Shell
  { regex: /\$ENV\b/, id: "env-var", label: "$ENV variable" },
  { regex: /\$\{[A-Z_][A-Z0-9_]*\}/, id: "shell-var", label: "shell variable expansion" },
  // dotenv
  { regex: /\brequire\s*\(\s*['"]dotenv['"]/, id: "require-dotenv", label: "require('dotenv')" },
  { regex: /\bimport\s+dotenv\b/, id: "import-dotenv", label: "import dotenv" },
  { regex: /\bdotenv\.config\s*\(/, id: "dotenv-config", label: "dotenv.config()" },
  { regex: /\bload_dotenv\s*\(/, id: "load-dotenv", label: "load_dotenv()" },
];

export const environmentRule: Rule = {
  id: "environment",
  name: "Environment Consistency",
  description:
    "Checks that skills declaring environment=false do not access environment variables",

  check(skill: ParsedSkill): Finding[] {
    const trust = skill.trust;
    if (!trust) return [];

    if (trust.permissions.environment) return [];

    const findings: Finding[] = [];

    for (const file of skill.files) {
      const matches = scanContent(file.content, ENV_PATTERNS, file.language);
      if (matches.length > 0) {
        const first = matches[0];
        const details = matches
          .slice(0, 3)
          .map((m) => `line ${m.line}: ${m.label}`)
          .join(", ");
        const more = matches.length > 3 ? ` (+${matches.length - 3} more)` : "";

        findings.push({
          rule: "environment",
          severity: "error",
          message: `Environment variable access detected but permissions.environment is declared as false (${details}${more})`,
          file: file.relativePath,
          line: first.line,
          declared: "false",
          actual: `${matches.length} env access pattern(s) found`,
        });
      }
    }

    return findings;
  },
};
