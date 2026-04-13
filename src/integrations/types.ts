/**
 * Shared types for external scanner integrations.
 */

import type { VerificationResult } from "../types.js";

export interface ExternalFinding {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  description: string;
  category?: string;
  file?: string;
  line?: number;
  recommendation?: string;
}

export interface ExternalScanResult {
  scanner: string;
  version?: string;
  timestamp: string;
  risk: "low" | "medium" | "high" | "critical" | "unknown";
  findings: ExternalFinding[];
}

export interface CombinedReport {
  skill: string;
  timestamp: string;
  trustVerification: VerificationResult;
  externalScans: ExternalScanResult[];
  overallRisk: "low" | "medium" | "high" | "critical";
  summary: {
    trustLevel: string;
    totalExternalFindings: number;
    criticalFindings: number;
    highFindings: number;
  };
}
