import matter from "gray-matter";
import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import type {
  ParsedSkill,
  SkillFile,
  TrustDeclaration,
  TrustEndpoint,
} from "./types.js";

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXT_LANG_MAP: Record<string, SkillFile["language"]> = {
  ".py": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".sh": "bash",
  ".bash": "bash",
};

function detectLanguage(filePath: string): SkillFile["language"] {
  const ext = path.extname(filePath).toLowerCase();
  if (EXT_LANG_MAP[ext]) return EXT_LANG_MAP[ext];

  // Fall back to shebang detection
  try {
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 256);
    const firstLine = head.split("\n")[0];
    if (/python/.test(firstLine)) return "python";
    if (/node|deno|bun/.test(firstLine)) return "javascript";
    if (/bash|sh/.test(firstLine)) return "bash";
  } catch {
    // Unreadable — leave as unknown
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateEndpoint(ep: unknown, idx: number): TrustEndpoint {
  if (!isObject(ep)) {
    throw new ParseError(
      `trust.data-flow.exfiltration[${idx}] must be an object`
    );
  }
  if (typeof ep.target !== "string" || ep.target.length === 0) {
    throw new ParseError(
      `trust.data-flow.exfiltration[${idx}].target must be a non-empty string`
    );
  }
  if (typeof ep.purpose !== "string" || ep.purpose.length === 0) {
    throw new ParseError(
      `trust.data-flow.exfiltration[${idx}].purpose must be a non-empty string`
    );
  }
  if (typeof ep.data !== "string" || ep.data.length === 0) {
    throw new ParseError(
      `trust.data-flow.exfiltration[${idx}].data must be a non-empty string`
    );
  }
  return { target: ep.target, purpose: ep.purpose, data: ep.data };
}

function validatePermissions(raw: unknown): TrustDeclaration["permissions"] {
  if (!isObject(raw)) throw new ParseError("trust.permissions must be an object");

  if (typeof raw.network !== "boolean")
    throw new ParseError("trust.permissions.network must be a boolean");
  if (typeof raw.shell !== "boolean")
    throw new ParseError("trust.permissions.shell must be a boolean");
  if (typeof raw.environment !== "boolean")
    throw new ParseError("trust.permissions.environment must be a boolean");

  if (!isObject(raw.filesystem))
    throw new ParseError("trust.permissions.filesystem must be an object");

  const fs = raw.filesystem;
  if (typeof fs.read !== "boolean")
    throw new ParseError("trust.permissions.filesystem.read must be a boolean");
  if (typeof fs.write !== "boolean")
    throw new ParseError("trust.permissions.filesystem.write must be a boolean");

  const validScopes = ["outputs", "workspace", "system"] as const;
  if (typeof fs.scope !== "string" || !(validScopes as readonly string[]).includes(fs.scope))
    throw new ParseError(
      `trust.permissions.filesystem.scope must be one of: ${validScopes.join(", ")}`
    );

  return {
    network: raw.network,
    shell: raw.shell,
    environment: raw.environment,
    filesystem: {
      read: fs.read,
      write: fs.write,
      scope: fs.scope as "outputs" | "workspace" | "system",
    },
  };
}

function validateDataFlow(raw: unknown): TrustDeclaration["data-flow"] {
  if (!isObject(raw)) throw new ParseError("trust.data-flow must be an object");

  const exf = raw.exfiltration;
  if (exf === "none") return { exfiltration: "none" };

  if (Array.isArray(exf)) {
    return { exfiltration: exf.map((ep, i) => validateEndpoint(ep, i)) };
  }

  throw new ParseError(
    'trust.data-flow.exfiltration must be "none" or an array of endpoints'
  );
}

function validateDependencies(
  raw: unknown
): TrustDeclaration["dependencies"] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObject(raw)) throw new ParseError("trust.dependencies must be an object");

  const result: NonNullable<TrustDeclaration["dependencies"]> = {};

  if (raw.runtime !== undefined) {
    if (!Array.isArray(raw.runtime) || !raw.runtime.every((r) => typeof r === "string"))
      throw new ParseError("trust.dependencies.runtime must be a string array");
    result.runtime = raw.runtime;
  }

  if (raw.packages !== undefined) {
    if (!Array.isArray(raw.packages))
      throw new ParseError("trust.dependencies.packages must be an array");
    result.packages = raw.packages.map((pkg, i) => {
      if (!isObject(pkg))
        throw new ParseError(`trust.dependencies.packages[${i}] must be an object`);
      if (typeof pkg.name !== "string" || pkg.name.length === 0)
        throw new ParseError(
          `trust.dependencies.packages[${i}].name must be a non-empty string`
        );
      if (typeof pkg.registry !== "string" || pkg.registry.length === 0)
        throw new ParseError(
          `trust.dependencies.packages[${i}].registry must be a non-empty string`
        );
      return { name: pkg.name, registry: pkg.registry };
    });
  }

  return result;
}

function validateBoundaries(
  raw: unknown
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || !raw.every((b) => typeof b === "string"))
    throw new ParseError("trust.boundaries must be a string array");
  return raw;
}

/**
 * Validate a raw trust object parsed from YAML frontmatter against the
 * TrustDeclaration schema. Throws ParseError on invalid input.
 */
export function validateTrust(raw: unknown): TrustDeclaration {
  if (!isObject(raw)) throw new ParseError("trust must be an object");

  const permissions = validatePermissions(raw.permissions);
  const dataFlow = validateDataFlow(raw["data-flow"]);
  const dependencies = validateDependencies(raw.dependencies);
  const boundaries = validateBoundaries(raw.boundaries);

  const result: TrustDeclaration = {
    permissions,
    "data-flow": dataFlow,
  };

  if (dependencies) result.dependencies = dependencies;
  if (boundaries) result.boundaries = boundaries;

  return result;
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

const CODE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
  ".sh",
  ".bash",
]);

/**
 * Collect all script / code files from the skill directory.
 * Scans recursively, skipping node_modules, .git, and dist directories.
 */
async function scanFiles(skillDir: string): Promise<SkillFile[]> {
  const patterns = ["**/*.py", "**/*.js", "**/*.mjs", "**/*.cjs", "**/*.ts", "**/*.mts", "**/*.cts", "**/*.sh", "**/*.bash"];
  const ignore = ["**/node_modules/**", "**/.git/**", "**/dist/**"];

  const matches = await glob(patterns, {
    cwd: skillDir,
    nodir: true,
    ignore,
  });

  const files: SkillFile[] = [];
  for (const rel of matches.sort()) {
    const abs = path.join(skillDir, rel);
    const content = fs.readFileSync(abs, "utf-8");
    files.push({
      path: abs,
      relativePath: rel,
      content,
      language: detectLanguage(abs),
    });
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a skill directory. Reads SKILL.md, validates the trust declaration
 * (if present), and collects all script files.
 *
 * @param skillDir - Absolute or relative path to the skill directory.
 * @returns The parsed skill representation.
 * @throws ParseError if SKILL.md is missing or the trust block is invalid.
 */
export async function parseSkill(skillDir: string): Promise<ParsedSkill> {
  const resolvedDir = path.resolve(skillDir);
  const skillMdPath = path.join(resolvedDir, "SKILL.md");

  if (!fs.existsSync(skillMdPath)) {
    throw new ParseError(`SKILL.md not found in ${resolvedDir}`);
  }

  const raw = fs.readFileSync(skillMdPath, "utf-8");
  const { data: frontmatter } = matter(raw);

  const name = typeof frontmatter.name === "string" ? frontmatter.name : "";
  const description =
    typeof frontmatter.description === "string" ? frontmatter.description : "";

  if (!name) throw new ParseError("SKILL.md frontmatter must include a 'name' field");
  if (!description)
    throw new ParseError("SKILL.md frontmatter must include a 'description' field");

  let trust: TrustDeclaration | undefined;
  if (frontmatter.trust !== undefined) {
    trust = validateTrust(frontmatter.trust);
  }

  const files = await scanFiles(resolvedDir);

  return {
    name,
    description,
    trust,
    skillPath: resolvedDir,
    files,
  };
}
