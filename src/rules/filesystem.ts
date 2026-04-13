import type { Rule, ParsedSkill, Finding } from "../types.js";
import { scanContent, type PatternDef } from "./utils.js";

const WRITE_PATTERNS: PatternDef[] = [
  // Python
  { regex: /open\s*\([^)]*['"][wa]['"]/, id: "py-open-write", label: "open() in write mode" },
  { regex: /\.write\s*\(/, id: "py-write", label: ".write() call" },
  { regex: /os\.makedirs\s*\(/, id: "py-makedirs", label: "os.makedirs()" },
  // Node.js
  { regex: /writeFileSync\s*\(/, id: "node-writeFileSync", label: "writeFileSync()" },
  { regex: /writeFile\s*\(/, id: "node-writeFile", label: "writeFile()" },
  { regex: /fs\.write\b/, id: "node-fs-write", label: "fs.write()" },
  { regex: /fs\.mkdirSync\s*\(/, id: "node-mkdirSync", label: "fs.mkdirSync()" },
  { regex: /fs\.mkdir\s*\(/, id: "node-mkdir", label: "fs.mkdir()" },
  // Shell
  { regex: /\bmkdir\s/, id: "sh-mkdir", label: "mkdir command" },
];

/**
 * Patterns that indicate writing to paths outside the declared scope.
 * We look for absolute paths that aren't relative output paths.
 */
const SYSTEM_PATH_REGEX = /["'](\/tmp|\/etc|\/var|\/usr|\/root|\/home)\b[^"']{0,256}/g;
const PARENT_TRAVERSAL_REGEX = /\.\.\//;

export const filesystemRule: Rule = {
  id: "filesystem",
  name: "Filesystem Consistency",
  description:
    "Checks filesystem write declarations and scope boundaries",

  check(skill: ParsedSkill): Finding[] {
    const trust = skill.trust;
    if (!trust) return [];

    const findings: Finding[] = [];
    const { write, scope } = trust.permissions.filesystem;

    for (const file of skill.files) {
      // Check write=false
      if (!write) {
        const matches = scanContent(file.content, WRITE_PATTERNS, file.language);
        if (matches.length > 0) {
          const first = matches[0];
          findings.push({
            rule: "filesystem",
            severity: "error",
            message: `File write operation detected but permissions.filesystem.write is declared as false: ${first.label} at line ${first.line}`,
            file: file.relativePath,
            line: first.line,
            declared: "write=false",
            actual: `${matches.length} write operation(s) found`,
          });
        }
      }

      // Check scope violations
      if (scope === "outputs" || scope === "workspace") {
        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check for absolute system paths
          const sysMatches = line.matchAll(SYSTEM_PATH_REGEX);
          for (const match of sysMatches) {
            const pathFound = match[0].replace(/^["']/, "");
            findings.push({
              rule: "filesystem",
              severity: scope === "outputs" ? "error" : "warning",
              message: `Write to '${pathFound}' is outside declared scope '${scope}'`,
              file: file.relativePath,
              line: i + 1,
              declared: `scope=${scope}`,
              actual: pathFound,
            });
          }

          // Check for parent traversal
          if (PARENT_TRAVERSAL_REGEX.test(line) && /open|write|mkdir|>>?/.test(line)) {
            findings.push({
              rule: "filesystem",
              severity: "warning",
              message: `Path traversal ('..') detected in write context at line ${i + 1}`,
              file: file.relativePath,
              line: i + 1,
              declared: `scope=${scope}`,
              actual: lines[i].trim(),
            });
          }
        }
      }
    }

    return findings;
  },
};
