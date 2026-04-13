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
      redirect: "error",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Aguara API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  const validated = validateAguaraResponse(data);
  return normalizeAguaraResult(validated);
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateAguaraResponse(data: unknown): AguaraAnalysisResponse {
  if (!isObject(data)) {
    throw new Error("Invalid Aguara API response: expected an object");
  }
  if (typeof data.analysis_id !== "string") {
    throw new Error("Invalid Aguara API response: missing analysis_id");
  }
  if (typeof data.status !== "string") {
    throw new Error("Invalid Aguara API response: missing status");
  }
  if (typeof data.risk_score !== "number") {
    throw new Error("Invalid Aguara API response: missing risk_score");
  }
  if (typeof data.risk_level !== "string") {
    throw new Error("Invalid Aguara API response: missing risk_level");
  }
  if (!Array.isArray(data.issues)) {
    throw new Error("Invalid Aguara API response: missing issues array");
  }
  const issues: AguaraIssue[] = data.issues.map((issue: unknown, i: number) => {
    if (!isObject(issue)) {
      throw new Error(`Invalid Aguara API response: issues[${i}] is not an object`);
    }
    const location = isObject(issue.location)
      ? {
          file: typeof issue.location.file === "string" ? issue.location.file : "",
          line: typeof issue.location.line === "number" ? issue.location.line : undefined,
        }
      : undefined;
    return {
      issue_id: typeof issue.issue_id === "string" ? issue.issue_id : "",
      type: typeof issue.type === "string" ? issue.type : "",
      severity: typeof issue.severity === "string" ? issue.severity : "info",
      summary: typeof issue.summary === "string" ? issue.summary : "",
      detail: typeof issue.detail === "string" ? issue.detail : "",
      location,
      fix_suggestion: typeof issue.fix_suggestion === "string" ? issue.fix_suggestion : undefined,
    } as AguaraIssue;
  });

  return {
    analysis_id: data.analysis_id as string,
    status: data.status as AguaraAnalysisResponse["status"],
    risk_score: data.risk_score as number,
    risk_level: data.risk_level as AguaraAnalysisResponse["risk_level"],
    issues,
    analyzed_at: typeof data.analyzed_at === "string" ? data.analyzed_at : "",
    engine_version: typeof data.engine_version === "string" ? data.engine_version : "",
  };
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

  // Block private / link-local IPs to prevent SSRF
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Aguara API URL must not point to a private address");
  }
}
