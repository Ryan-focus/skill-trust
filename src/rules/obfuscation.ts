import type { Rule, ParsedSkill, Finding } from "../types.js";
import { scanContent, type PatternDef } from "./utils.js";

const OBFUSCATION_PATTERNS: PatternDef[] = [
  // base64
  { regex: /\bbase64\b/, id: "base64", label: "base64 usage" },
  { regex: /\batob\s*\(/, id: "atob", label: "atob() call" },
  { regex: /\bbtoa\s*\(/, id: "btoa", label: "btoa() call" },
  { regex: /\bb64decode\b/, id: "b64decode", label: "b64decode usage" },
  { regex: /\bb64encode\b/, id: "b64encode", label: "b64encode usage" },
  {
    regex: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]/,
    id: "buffer-base64",
    label: "Buffer.from(..., 'base64')",
  },
  // eval with dynamic strings (not just eval alone — that's in shell rule)
  {
    regex: /\beval\s*\(\s*[^"')\s]/,
    id: "eval-dynamic",
    label: "eval() with dynamic argument",
  },
  // hex-encoded strings
  {
    regex: /\\x[0-9a-fA-F]{2}.*\\x[0-9a-fA-F]{2}/,
    id: "hex-string",
    label: "hex-encoded string",
  },
  // unicode escape sequences (potential obfuscation)
  {
    regex: /\\u[0-9a-fA-F]{4}.*\\u[0-9a-fA-F]{4}/,
    id: "unicode-escape",
    label: "unicode-escaped string",
  },
  // String char-code construction
  {
    regex: /String\.fromCharCode\s*\(/,
    id: "fromCharCode",
    label: "String.fromCharCode()",
  },
  { regex: /\bchr\s*\(\s*\d+\s*\)/, id: "chr", label: "chr() call" },
];

export const obfuscationRule: Rule = {
  id: "obfuscation",
  name: "Obfuscation Detection",
  description:
    "Detects common obfuscation techniques regardless of declarations",

  check(skill: ParsedSkill): Finding[] {
    // This rule fires regardless of trust declarations
    const findings: Finding[] = [];

    for (const file of skill.files) {
      const matches = scanContent(file.content, OBFUSCATION_PATTERNS);
      if (matches.length > 0) {
        const first = matches[0];
        const details = matches
          .slice(0, 3)
          .map((m) => `line ${m.line}: ${m.label}`)
          .join(", ");
        const more = matches.length > 3 ? ` (+${matches.length - 3} more)` : "";

        findings.push({
          rule: "obfuscation",
          severity: "warning",
          message: `Potential obfuscation detected (${details}${more})`,
          file: file.relativePath,
          line: first.line,
        });
      }
    }

    return findings;
  },
};
