/**
 * AST-based code analysis module.
 *
 * Provides context-aware code analysis that goes beyond simple regex
 * pattern matching by understanding comments, string literals, and
 * code structure.
 */

export { stripNonCode } from "./context.js";
export {
  analyzeFile,
  analyzeSkillFiles,
  type ImportInfo,
  type FunctionCallInfo,
  type FileAnalysis,
} from "./analyzer.js";
