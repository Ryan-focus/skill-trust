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
