/**
 * Structured code analysis — extracts imports, function calls, and other
 * semantic information from source code using context-aware parsing.
 *
 * This goes beyond regex pattern matching by understanding code structure
 * after comments and strings have been stripped.
 */

import type { SkillFile } from "../types.js";
import { stripNonCode } from "./context.js";

// ---------------------------------------------------------------------------
// Analysis result types
// ---------------------------------------------------------------------------

export interface ImportInfo {
  module: string;
  names?: string[];
  line: number;
  type: "import" | "require" | "from";
}

export interface FunctionCallInfo {
  name: string;
  line: number;
}

export interface FileAnalysis {
  imports: ImportInfo[];
  calls: FunctionCallInfo[];
  codeContent: string;
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

const PY_IMPORT = /^\s*import\s+(\w[\w.]*)/;
const PY_FROM_IMPORT = /^\s*from\s+(\w[\w.]*)\s+import\s+([\w,\s*]+)/;

const JS_IMPORT_FROM = /\bimport\s+(?:(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?['"]([^'"./][^'"]*)['"]/;
const JS_REQUIRE = /\brequire\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/;
const JS_DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/;

/**
 * Extract imports from raw content but validate that the import keyword
 * actually exists in code (not inside a comment or string).
 *
 * Import module specifiers are themselves strings (e.g., `from 'fs'`),
 * so we extract from raw content and cross-check with stripped content
 * to filter out imports that appear only in comments/docstrings.
 */
function extractImports(
  rawContent: string,
  codeContent: string,
  language: SkillFile["language"]
): ImportInfo[] {
  const rawLines = rawContent.split("\n");
  const codeLines = codeContent.split("\n");
  const imports: ImportInfo[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const codeLine = codeLines[i] ?? "";

    if (language === "python") {
      const pyImport = PY_IMPORT.exec(rawLine);
      if (pyImport && /^\s*import\s/.test(codeLine)) {
        imports.push({ module: pyImport[1], line: i + 1, type: "import" });
        continue;
      }
      const pyFrom = PY_FROM_IMPORT.exec(rawLine);
      if (pyFrom && /^\s*from\s/.test(codeLine)) {
        const names = pyFrom[2].split(",").map((n) => n.trim()).filter(Boolean);
        imports.push({ module: pyFrom[1], names, line: i + 1, type: "from" });
        continue;
      }
    }

    if (language === "javascript" || language === "typescript") {
      // Check that the import/require keyword is in actual code
      const jsImport = JS_IMPORT_FROM.exec(rawLine);
      if (jsImport && /\bimport\b/.test(codeLine)) {
        imports.push({ module: jsImport[1], line: i + 1, type: "import" });
        continue;
      }
      const jsRequire = JS_REQUIRE.exec(rawLine);
      if (jsRequire && /\brequire\b/.test(codeLine)) {
        imports.push({ module: jsRequire[1], line: i + 1, type: "require" });
        continue;
      }
      const jsDynamic = JS_DYNAMIC_IMPORT.exec(rawLine);
      if (jsDynamic && /\bimport\b/.test(codeLine)) {
        imports.push({ module: jsDynamic[1], line: i + 1, type: "import" });
        continue;
      }
    }

    if (language === "bash") {
      const bashSource = /^\s*(?:source|\.)\s+(\S+)/.exec(rawLine);
      if (bashSource && /^\s*(?:source|\.)\s/.test(codeLine)) {
        imports.push({ module: bashSource[1], line: i + 1, type: "import" });
      }
    }
  }

  return imports;
}

// ---------------------------------------------------------------------------
// Function call extraction
// ---------------------------------------------------------------------------

const CALL_PATTERNS: Record<string, RegExp[]> = {
  python: [
    /\b(subprocess\.(?:run|call|Popen|check_output|check_call))\s*\(/g,
    /\b(os\.(?:system|popen|exec\w*|makedirs|getenv))\s*\(/g,
    /\b(requests\.(?:get|post|put|delete|patch|head|request))\s*\(/g,
    /\b(open)\s*\(/g,
    /\b(urllib\.request\.\w+)\s*\(/g,
    /\b(eval)\s*\(/g,
    /\b(exec)\s*\(/g,
    /\b(load_dotenv)\s*\(/g,
  ],
  javascript: [
    /\b(fetch)\s*\(/g,
    /\b(eval)\s*\(/g,
    /\b(execSync|execFile|spawn)\s*\(/g,
    /\b(writeFileSync|writeFile)\s*\(/g,
    /\b(fs\.(?:write\w*|mkdir\w*|readFileSync|readFile))\s*\(/g,
    /\b(http\.(?:get|request))\s*\(/g,
    /\b(axios[\s.]?\w*)\s*\(/g,
    /\b(dotenv\.config)\s*\(/g,
  ],
  bash: [
    /\b(curl)\s+/g,
    /\b(wget)\s+/g,
    /\b(eval)\s+/g,
    /\b(mkdir)\s+/g,
  ],
};

// Share JS patterns for TS
CALL_PATTERNS.typescript = CALL_PATTERNS.javascript;

function extractCalls(codeContent: string, language: SkillFile["language"]): FunctionCallInfo[] {
  const patterns = CALL_PATTERNS[language] ?? [];
  const lines = codeContent.split("\n");
  const calls: FunctionCallInfo[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const key = `${match[1]}:${i + 1}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({ name: match[1], line: i + 1 });
        }
      }
    }
  }

  return calls;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a single source file, extracting structured code information.
 * The analysis operates on code-only content (comments and strings stripped).
 */
export function analyzeFile(file: SkillFile): FileAnalysis {
  const codeContent = stripNonCode(file.content, file.language);
  return {
    imports: extractImports(file.content, codeContent, file.language),
    calls: extractCalls(codeContent, file.language),
    codeContent,
  };
}

/**
 * Analyze all files in a skill, returning per-file analysis results.
 */
export function analyzeSkillFiles(files: SkillFile[]): Map<string, FileAnalysis> {
  const results = new Map<string, FileAnalysis>();
  for (const file of files) {
    results.set(file.relativePath, analyzeFile(file));
  }
  return results;
}
