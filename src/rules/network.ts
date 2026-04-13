import type { Rule, ParsedSkill, Finding } from "../types.js";
import { scanContent, type PatternDef } from "./utils.js";

const NETWORK_PATTERNS: PatternDef[] = [
  // Commands
  { regex: /\bcurl\s/, id: "curl", label: "curl command" },
  { regex: /\bwget\s/, id: "wget", label: "wget command" },
  // Function calls
  { regex: /\bfetch\s*\(/, id: "fetch", label: "fetch() call" },
  { regex: /\bhttp\.get\s*\(/, id: "http.get", label: "http.get() call" },
  { regex: /\bhttp\.request\s*\(/, id: "http.request", label: "http.request() call" },
  {
    regex: /\brequests\.(get|post|put|delete|patch|head|request)\s*\(/,
    id: "requests-call",
    label: "requests library call",
  },
  { regex: /\baxios[\s.(]/, id: "axios", label: "axios usage" },
  { regex: /\burllib\.request/, id: "urllib", label: "urllib usage" },
  // Imports
  { regex: /\bimport\s+requests\b/, id: "import-requests", label: "import requests" },
  { regex: /\bfrom\s+requests\b/, id: "from-requests", label: "from requests import" },
  { regex: /\brequire\s*\(\s*['"]axios['"]/, id: "require-axios", label: "require('axios')" },
  { regex: /\bimport\s+urllib\b/, id: "import-urllib", label: "import urllib" },
  { regex: /\bfrom\s+urllib\b/, id: "from-urllib", label: "from urllib import" },
  {
    regex: /\brequire\s*\(\s*['"]https?['"]\)/,
    id: "require-http",
    label: "require('http'/'https')",
  },
  {
    regex: /\brequire\s*\(\s*['"]node-fetch['"]\)/,
    id: "require-node-fetch",
    label: "require('node-fetch')",
  },
  // URL patterns
  { regex: /https?:\/\/[^\s'")\]>]+/, id: "url", label: "URL pattern" },
];

export const networkRule: Rule = {
  id: "network",
  name: "Network Consistency",
  description:
    "Checks that skills declaring network=false do not contain network access patterns",

  check(skill: ParsedSkill): Finding[] {
    const trust = skill.trust;
    if (!trust) return [];

    // Only check if network is declared as false
    if (trust.permissions.network) return [];

    const findings: Finding[] = [];

    for (const file of skill.files) {
      const matches = scanContent(file.content, NETWORK_PATTERNS, file.language);
      if (matches.length > 0) {
        const first = matches[0];
        const details = matches
          .slice(0, 3)
          .map((m) => `line ${m.line}: ${m.label}`)
          .join(", ");
        const more = matches.length > 3 ? ` (+${matches.length - 3} more)` : "";

        findings.push({
          rule: "network",
          severity: "error",
          message: `Network access detected but permissions.network is declared as false (${details}${more})`,
          file: file.relativePath,
          line: first.line,
          declared: "false",
          actual: `${matches.length} network pattern(s) found`,
        });
      }
    }

    return findings;
  },
};
