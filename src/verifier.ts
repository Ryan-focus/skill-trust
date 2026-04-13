import type {
  ParsedSkill,
  VerificationResult,
  TrustLevel,
  Finding,
} from "./types.js";
import { allRules } from "./rules/index.js";

/**
 * Known package-to-import mapping for dependency verification.
 * Keys are import names found in code; values are the canonical package names.
 */
const KNOWN_PACKAGES: Record<string, string> = {
  requests: "requests",
  axios: "axios",
  "node-fetch": "node-fetch",
  lodash: "lodash",
  pandas: "pandas",
  numpy: "numpy",
  flask: "flask",
  django: "django",
  express: "express",
  dotenv: "dotenv",
};

/**
 * Detect imported packages from file content and check against declared deps.
 */
function checkDependencies(skill: ParsedSkill): Finding[] {
  if (!skill.trust?.dependencies?.packages) return [];

  const declaredNames = new Set(
    skill.trust.dependencies.packages.map((p) => p.name)
  );

  const findings: Finding[] = [];
  const alreadyReported = new Set<string>();

  // Python imports: `import <pkg>` or `from <pkg> import ...`
  const pyImportRegex = /^\s*(?:import|from)\s+(\w+)/;
  // Node requires: `require('<pkg>')`
  const nodeRequireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/;
  // ES imports: `import ... from '<pkg>'`
  const esImportRegex = /import\s+.*\s+from\s+['"]([^'"./][^'"]*)['"]/;

  for (const file of skill.files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const regex of [pyImportRegex, nodeRequireRegex, esImportRegex]) {
        const match = regex.exec(line);
        if (!match) continue;

        const pkgName = match[1].split("/")[0]; // handle scoped-like refs

        // Only flag known packages that should be declared
        if (
          KNOWN_PACKAGES[pkgName] &&
          !declaredNames.has(pkgName) &&
          !alreadyReported.has(pkgName)
        ) {
          alreadyReported.add(pkgName);
          findings.push({
            rule: "dependency",
            severity: "warning",
            message: `Package '${pkgName}' is imported but not listed in trust.dependencies.packages`,
            file: file.relativePath,
            line: i + 1,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Run all verification rules against a parsed skill and return the result.
 */
export function verify(skill: ParsedSkill): VerificationResult {
  // Handle undeclared trust
  if (!skill.trust) {
    return {
      skill: skill.name,
      level: "UNDECLARED",
      findings: [
        {
          rule: "trust-declaration",
          severity: "info",
          message: "No trust declaration found in SKILL.md",
        },
      ],
      summary: { errors: 0, warnings: 0, info: 1, passed: 0 },
    };
  }

  const findings: Finding[] = [];
  let passed = 0;

  // Run each rule
  for (const rule of allRules) {
    const ruleFindings = rule.check(skill);
    if (ruleFindings.length === 0) {
      passed++;
    }
    findings.push(...ruleFindings);
  }

  // Run dependency check
  const depFindings = checkDependencies(skill);
  findings.push(...depFindings);

  // Calculate summary
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;

  // Determine trust level
  let level: TrustLevel;
  if (errors > 0) {
    level = "INCONSISTENT";
  } else if (warnings > 0) {
    level = "PARTIAL";
  } else {
    level = "VERIFIED";
  }

  return {
    skill: skill.name,
    level,
    findings,
    summary: { errors, warnings, info, passed },
  };
}
