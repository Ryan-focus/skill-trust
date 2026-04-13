/**
 * skill-trust — Transparency verifier for Agent Skills.
 *
 * Public API for programmatic usage:
 *
 * ```ts
 * import { parseSkill, verify, report, generateBadgeSvg } from "skill-trust";
 * ```
 */

export { parseSkill, ParseError } from "./parser.js";
export { verify } from "./verifier.js";
export { report, buildSarif } from "./reporter.js";
export { generateBadgeSvg } from "./badge.js";
export {
  lookupSkill,
  publishResult,
  getRegistryUrl,
  RegistryApiError,
} from "./registry.js";
export type {
  RegistrySkillInfo,
  PublishPayload,
} from "./registry.js";
export type {
  TrustDeclaration,
  TrustPermissions,
  TrustDataFlow,
  TrustEndpoint,
  TrustDependencies,
  TrustPackage,
  TrustLevel,
  Finding,
  FindingSeverity,
  VerificationResult,
  ParsedSkill,
  SkillFile,
  Rule,
  OutputFormat,
  ReporterOptions,
} from "./types.js";

// AST-based analysis
export { stripNonCode, analyzeFile, analyzeSkillFiles } from "./ast/index.js";
export type { ImportInfo, FunctionCallInfo, FileAnalysis } from "./ast/index.js";

// Monorepo support
export { discoverSkills, verifyAll } from "./monorepo.js";
export type { MonorepoResult, MonorepoSkillResult } from "./monorepo.js";

// Interactive wizard
export { runWizard, generateSkillMd } from "./wizard.js";

// External scanner integrations
export {
  scanWithCisco,
  scanWithAguara,
  createCombinedReport,
  printCombinedReport,
  combinedReportToJson,
} from "./integrations/index.js";
export type {
  ExternalScanResult,
  ExternalFinding,
  CombinedReport,
  CiscoScannerOptions,
  AguaraOptions,
} from "./integrations/index.js";
