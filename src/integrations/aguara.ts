/**
 * Aguara integration — fetches behavioral analysis results
 * from the Aguara scanning API and normalizes them into
 * a common ExternalScanResult format.
 */

import type { ExternalScanResult, ExternalFinding } from "./types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_AGUARA_API = "https://api.aguara.io/v1";

export interface AguaraOptions {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface AguaraAnalysisResponse {
  analysis_id: string;
  status: "complete" | "in_progress" | "error";
  risk_score: number; // 0-100
  risk_level: "low" | "medium" | "high" | "critical";
  issues: AguaraIssue[];
  analyzed_at: string;
  engine_version: string;
}

interface AguaraIssue {
  issue_id: string;
  type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  summary: string;
  detail: string;
  location?: {
    file: string;
    line?: number;
  };
  fix_suggestion?: string;
}

// ---------------------------------------------------------------------------
// Scanner client
// ---------------------------------------------------------------------------

/**
 * Fetch behavioral analysis results from Aguara.
 *
 * @param skillName - Name of the skill to look up.
 * @param opts - Aguara options (API URL, key, etc.).
 * @returns Normalized external scan result.
 */
export async function scanWithAguara(
  skillName: string,
  opts: AguaraOptions = {}
): Promise<ExternalScanResult> {
  const apiUrl = opts.apiUrl ?? process.env.AGUARA_API_URL ?? DEFAULT_AGUARA_API;
  const apiKey = opts.apiKey ?? process.env.AGUARA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Aguara API key is required. Set AGUARA_API_KEY environment variable."
    );
  }

  validateUrl(apiUrl);

  const response = await fetch(
    `${apiUrl}/analysis/${encodeURIComponent(skillName)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(opts.timeout ?? 30_000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Aguara API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as AguaraAnalysisResponse;
  return normalizeAguaraResult(data);
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeAguaraResult(data: AguaraAnalysisResponse): ExternalScanResult {
  const findings: ExternalFinding[] = data.issues.map((issue) => ({
    id: issue.issue_id,
    title: issue.summary,
    severity: issue.severity,
    description: issue.detail,
    category: issue.type,
    file: issue.location?.file,
    line: issue.location?.line,
    recommendation: issue.fix_suggestion,
  }));

  return {
    scanner: "Aguara",
    version: data.engine_version,
    timestamp: data.analyzed_at,
    risk: data.risk_level,
    findings,
  };
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

function validateUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid Aguara API URL: ${urlStr}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Aguara API URL must use HTTPS");
  }

  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host === "::1"
  ) {
    throw new Error("Aguara API URL must not point to a private address");
  }
}
