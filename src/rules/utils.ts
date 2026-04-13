import type { SkillFile, Finding } from "../types.js";
import { stripNonCode } from "../ast/context.js";

/**
 * A single pattern definition used by rules to scan file content.
 */
export interface PatternDef {
  regex: RegExp;
  id: string;
  label: string;
}

/**
 * A match found while scanning a file.
 */
export interface PatternMatch {
  line: number;
  text: string;
  patternId: string;
  label: string;
}

/**
 * Scan file content line-by-line against a list of patterns.
 * Returns all matches with line numbers.
 *
 * When a language is provided, comments and string literals are stripped
 * before matching (AST-aware scanning), reducing false positives.
 */
export function scanContent(
  content: string,
  patterns: PatternDef[],
  language?: SkillFile["language"]
): PatternMatch[] {
  const effective = language ? stripNonCode(content, language) : content;
  const originalLines = content.split("\n");
  const lines = effective.split("\n");
  const matches: PatternMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { regex, id, label } of patterns) {
      if (regex.test(line)) {
        matches.push({
          line: i + 1,
          text: originalLines[i].trim(),
          patternId: id,
          label,
        });
      }
    }
  }
  return matches;
}

/**
 * Scan all files in a skill with the given patterns.
 * Uses AST-aware scanning by default (strips comments and strings).
 * Returns findings grouped by file.
 */
export function scanFiles(
  files: SkillFile[],
  patterns: PatternDef[],
  opts: { rule: string; severity: Finding["severity"]; messagePrefix: string }
): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const matches = scanContent(file.content, patterns, file.language);
    if (matches.length > 0) {
      const first = matches[0];
      const others =
        matches.length > 1
          ? ` (+${matches.length - 1} more)`
          : "";
      findings.push({
        rule: opts.rule,
        severity: opts.severity,
        message: `${opts.messagePrefix}: ${first.label} at line ${first.line}${others}`,
        file: file.relativePath,
        line: first.line,
      });
    }
  }

  return findings;
}
