/**
 * Code context analysis — strips comments and string literals from source code.
 *
 * Replaces non-code content with spaces while preserving line structure,
 * enabling regex pattern matching that only targets actual executable code
 * and avoids false positives from comments and string literals.
 */

import type { SkillFile } from "../types.js";

type Language = SkillFile["language"];

/**
 * Strip comments and string literals from source code.
 * Non-code characters are replaced with spaces; newlines are preserved
 * so that line numbers remain valid for pattern matching.
 *
 * @param content - Raw file content.
 * @param language - Source language for syntax-aware stripping.
 * @returns Content with only executable code; non-code replaced by spaces.
 */
export function stripNonCode(content: string, language: Language): string {
  switch (language) {
    case "javascript":
    case "typescript":
      return stripJsTs(content);
    case "python":
      return stripPython(content);
    case "bash":
      return stripBash(content);
    default:
      return content;
  }
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript
// ---------------------------------------------------------------------------

function stripJsTs(content: string): string {
  const chars = content.split("");
  const len = chars.length;
  let i = 0;

  while (i < len) {
    const ch = chars[i];
    const next = i + 1 < len ? chars[i + 1] : "";

    // Single-line comment: //
    if (ch === "/" && next === "/") {
      while (i < len && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    // Multi-line comment: /* ... */
    if (ch === "/" && next === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < len) {
        if (chars[i] === "*" && i + 1 < len && chars[i + 1] === "/") {
          chars[i] = " ";
          chars[i + 1] = " ";
          i += 2;
          break;
        }
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      continue;
    }

    // Template literal: `...`
    if (ch === "`") {
      chars[i] = " ";
      i++;
      while (i < len && chars[i] !== "`") {
        // Escape sequence
        if (chars[i] === "\\") {
          chars[i] = " ";
          i++;
          if (i < len) {
            if (chars[i] !== "\n") chars[i] = " ";
            i++;
          }
          continue;
        }
        // Template expression ${...} — keep code inside
        if (chars[i] === "$" && i + 1 < len && chars[i + 1] === "{") {
          i += 2; // keep ${ as-is
          let depth = 1;
          while (i < len && depth > 0) {
            if (chars[i] === "{") depth++;
            if (chars[i] === "}") depth--;
            if (depth > 0) i++;
            else { i++; break; }
          }
          continue;
        }
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      if (i < len) { chars[i] = " "; i++; }
      continue;
    }

    // String literals: '...' or "..."
    if (ch === "'" || ch === '"') {
      const quote = ch;
      chars[i] = " ";
      i++;
      while (i < len && chars[i] !== quote) {
        if (chars[i] === "\\") {
          chars[i] = " ";
          i++;
          if (i < len) {
            if (chars[i] !== "\n") chars[i] = " ";
            i++;
          }
          continue;
        }
        if (chars[i] === "\n") break; // unterminated
        chars[i] = " ";
        i++;
      }
      if (i < len && chars[i] === quote) { chars[i] = " "; i++; }
      continue;
    }

    i++;
  }

  return chars.join("");
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function stripPython(content: string): string {
  const chars = content.split("");
  const len = chars.length;
  let i = 0;

  while (i < len) {
    const ch = chars[i];

    // Triple-quoted strings: """ or '''
    if (
      (ch === '"' || ch === "'") &&
      i + 2 < len &&
      chars[i + 1] === ch &&
      chars[i + 2] === ch
    ) {
      const quote3 = ch + ch + ch;
      chars[i] = " "; chars[i + 1] = " "; chars[i + 2] = " ";
      i += 3;
      while (i < len) {
        if (
          chars[i] === quote3[0] &&
          i + 2 < len &&
          chars[i + 1] === quote3[0] &&
          chars[i + 2] === quote3[0]
        ) {
          chars[i] = " "; chars[i + 1] = " "; chars[i + 2] = " ";
          i += 3;
          break;
        }
        if (chars[i] === "\\" && i + 1 < len) {
          chars[i] = " ";
          i++;
          if (chars[i] !== "\n") chars[i] = " ";
          i++;
          continue;
        }
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      continue;
    }

    // Single-line comment: #
    if (ch === "#") {
      while (i < len && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    // String literals: '...' or "..."
    if (ch === "'" || ch === '"') {
      const quote = ch;
      chars[i] = " ";
      i++;
      while (i < len && chars[i] !== quote) {
        if (chars[i] === "\\") {
          chars[i] = " ";
          i++;
          if (i < len) {
            if (chars[i] !== "\n") chars[i] = " ";
            i++;
          }
          continue;
        }
        if (chars[i] === "\n") break;
        chars[i] = " ";
        i++;
      }
      if (i < len && chars[i] === quote) { chars[i] = " "; i++; }
      continue;
    }

    i++;
  }

  return chars.join("");
}

// ---------------------------------------------------------------------------
// Bash
// ---------------------------------------------------------------------------

function stripBash(content: string): string {
  const chars = content.split("");
  const len = chars.length;
  let i = 0;

  while (i < len) {
    const ch = chars[i];

    // Single-line comment: # (but not #! shebang on first line)
    if (ch === "#" && !(i === 0 || (i === 0 && chars[1] === "!"))) {
      // Don't strip shebang
      if (i > 0 || chars[1] !== "!") {
        while (i < len && chars[i] !== "\n") {
          chars[i] = " ";
          i++;
        }
        continue;
      }
    }

    // Single-quoted strings: '...' (no escapes in bash single quotes)
    if (ch === "'") {
      chars[i] = " ";
      i++;
      while (i < len && chars[i] !== "'") {
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      if (i < len) { chars[i] = " "; i++; }
      continue;
    }

    // Double-quoted strings: "..." (with escape handling)
    if (ch === '"') {
      chars[i] = " ";
      i++;
      while (i < len && chars[i] !== '"') {
        if (chars[i] === "\\") {
          chars[i] = " ";
          i++;
          if (i < len) {
            if (chars[i] !== "\n") chars[i] = " ";
            i++;
          }
          continue;
        }
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      if (i < len) { chars[i] = " "; i++; }
      continue;
    }

    // Heredoc: <<EOF ... EOF (simplified — handles common cases)
    if (ch === "<" && i + 1 < len && chars[i + 1] === "<") {
      // Find delimiter: <<[-]'?WORD'?
      let j = i + 2;
      if (j < len && chars[j] === "-") j++;
      // Skip whitespace
      while (j < len && chars[j] === " ") j++;
      // Strip optional quotes around delimiter
      let quoteChar = "";
      if (j < len && (chars[j] === "'" || chars[j] === '"')) {
        quoteChar = chars[j];
        j++;
      }
      // Extract delimiter word
      let delimiter = "";
      while (j < len && /\w/.test(chars[j])) {
        delimiter += chars[j];
        j++;
      }
      if (quoteChar && j < len && chars[j] === quoteChar) j++;

      if (delimiter) {
        // Skip to next line
        while (j < len && chars[j] !== "\n") j++;
        if (j < len) j++; // skip the newline

        // Find end delimiter on its own line
        while (j < len) {
          const lineStart = j;
          let line = "";
          while (j < len && chars[j] !== "\n") {
            line += chars[j];
            j++;
          }
          if (j < len) j++; // skip newline

          if (line.trim() === delimiter) {
            // Blank out heredoc content
            for (let k = i; k < lineStart; k++) {
              if (chars[k] !== "\n") chars[k] = " ";
            }
            i = j;
            break;
          }
        }
        if (j >= len) {
          // Unterminated heredoc — blank rest
          for (let k = i; k < len; k++) {
            if (chars[k] !== "\n") chars[k] = " ";
          }
          i = len;
        }
        continue;
      }
    }

    i++;
  }

  return chars.join("");
}
