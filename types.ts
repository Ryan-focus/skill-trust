/**
 * Trust declaration types for Agent Skills.
 */

// --- Trust Declaration Schema ---

export interface TrustDeclaration {
  permissions: TrustPermissions;
  "data-flow": TrustDataFlow;
  dependencies?: TrustDependencies;
  boundaries?: string[];
}

export interface TrustPermissions {
  network: boolean;
  filesystem: {
    read: boolean;
    write: boolean;
    scope: "outputs" | "workspace" | "system";
  };
  shell: boolean;
  environment: boolean;
}

export interface TrustDataFlow {
  exfiltration: "none" | TrustEndpoint[];
}

export interface TrustEndpoint {
  target: string;
  purpose: string;
  data: string;
}

export interface TrustDependencies {
  runtime?: string[];
  packages?: TrustPackage[];
}

export interface TrustPackage {
  name: string;
  registry: "npm" | "pypi" | "crates" | string;
}

// --- Verification Results ---

export type TrustLevel = "VERIFIED" | "PARTIAL" | "UNDECLARED" | "INCONSISTENT";

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
  rule: string;
  severity: FindingSeverity;
  message: string;
  file?: string;
  line?: number;
  declared?: string;
  actual?: string;
}

export interface VerificationResult {
  skill: string;
  level: TrustLevel;
  findings: Finding[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    passed: number;
  };
}

// --- Parsed Skill ---

export interface ParsedSkill {
  name: string;
  description: string;
  trust?: TrustDeclaration;
  skillPath: string;
  files: SkillFile[];
}

export interface SkillFile {
  path: string;
  relativePath: string;
  content: string;
  language: "python" | "javascript" | "typescript" | "bash" | "unknown";
}

// --- Rule Engine ---

export interface Rule {
  id: string;
  name: string;
  description: string;
  check(skill: ParsedSkill): Finding[];
}

// --- Reporter ---

export type OutputFormat = "terminal" | "json" | "sarif";

export interface ReporterOptions {
  format: OutputFormat;
  strict: boolean;
  verbose: boolean;
}
