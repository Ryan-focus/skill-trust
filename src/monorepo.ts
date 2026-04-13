/**
 * Monorepo support — discover and verify multiple skills within a single
 * repository or directory tree.
 */

import * as path from "node:path";
import { glob } from "glob";
import { parseSkill, ParseError } from "./parser.js";
import { verify } from "./verifier.js";
import type { VerificationResult } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonorepoResult {
  root: string;
  skills: MonorepoSkillResult[];
  summary: {
    total: number;
    verified: number;
    partial: number;
    undeclared: number;
    inconsistent: number;
    errored: number;
  };
}

export interface MonorepoSkillResult {
  path: string;
  relativePath: string;
  result?: VerificationResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover all SKILL.md files in a directory tree.
 * Skips node_modules, .git, and dist directories.
 *
 * @param rootDir - Root directory to search from.
 * @returns Array of directory paths containing SKILL.md files.
 */
export async function discoverSkills(rootDir: string): Promise<string[]> {
  const resolvedRoot = path.resolve(rootDir);
  const matches = await glob("**/SKILL.md", {
    cwd: resolvedRoot,
    nodir: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  });

  return matches
    .sort()
    .map((match) => path.dirname(path.join(resolvedRoot, match)));
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify all skills discovered in a monorepo.
 *
 * Each skill is parsed and verified independently. Parse/validation
 * errors are captured per-skill rather than aborting the entire run.
 *
 * @param rootDir - Root directory to search from.
 * @returns Aggregated monorepo verification result.
 */
export async function verifyAll(rootDir: string): Promise<MonorepoResult> {
  const resolvedRoot = path.resolve(rootDir);
  const skillDirs = await discoverSkills(resolvedRoot);

  const skills: MonorepoSkillResult[] = [];

  for (const skillDir of skillDirs) {
    const relativePath = path.relative(resolvedRoot, skillDir) || ".";

    try {
      const parsed = await parseSkill(skillDir);
      const result = verify(parsed);
      skills.push({ path: skillDir, relativePath, result });
    } catch (err) {
      const message = err instanceof ParseError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
      skills.push({ path: skillDir, relativePath, error: message });
    }
  }

  const summary = {
    total: skills.length,
    verified: skills.filter((s) => s.result?.level === "VERIFIED").length,
    partial: skills.filter((s) => s.result?.level === "PARTIAL").length,
    undeclared: skills.filter((s) => s.result?.level === "UNDECLARED").length,
    inconsistent: skills.filter((s) => s.result?.level === "INCONSISTENT").length,
    errored: skills.filter((s) => s.error !== undefined).length,
  };

  return { root: resolvedRoot, skills, summary };
}
