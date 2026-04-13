/**
 * Cisco Skill Scanner integration — fetches threat scan results
 * from the Cisco Skill Scanner API and normalizes them into
 * a common ExternalScanResult format.
 */

import type { ExternalScanResult, ExternalFinding } from "./types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CISCO_API = "https://skillscanner.cisco.com/api/v1";

export interface CiscoScannerOptions {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface CiscoScanResponse {
  scan_id: string;
  status: "completed" | "pending" | "failed";
  risk_level: "low" | "medium" | "high" | "critical";
  findings: CiscoFinding[];
  scanned_at: string;
  scanner_version: string;
}

interface CiscoFinding {
  id: string;
  category: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  file_path?: string;
  line_number?: number;
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// Scanner client
// ---------------------------------------------------------------------------

/**
 * Submit a skill directory for scanning by Cisco Skill Scanner.
 *
 * @param skillName - Name of the skill to scan.
 * @param opts - Scanner options (API URL, key, etc.).
 * @returns Normalized external scan result.
 */
export async function scanWithCisco(
  skillName: string,
  opts: CiscoScannerOptions = {}
): Promise<ExternalScanResult> {
  const apiUrl = opts.apiUrl ?? process.env.CISCO_SCANNER_API_URL ?? DEFAULT_CISCO_API;
  const apiKey = opts.apiKey ?? process.env.CISCO_SCANNER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Cisco Skill Scanner API key is required. Set CISCO_SCANNER_API_KEY environment variable."
    );
  }

  validateUrl(apiUrl);

  const response = await fetch(`${apiUrl}/scans/${encodeURIComponent(skillName)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(opts.timeout ?? 30_000),
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(
      `Cisco Skill Scanner API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  const validated = validateCiscoResponse(data);
  return normalizeCiscoResult(validated);
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCiscoResponse(data: unknown): CiscoScanResponse {
  if (!isObject(data)) {
    throw new Error("Invalid Cisco API response: expected an object");
  }
  if (typeof data.scan_id !== "string") {
    throw new Error("Invalid Cisco API response: missing scan_id");
  }
  if (typeof data.status !== "string") {
    throw new Error("Invalid Cisco API response: missing status");
  }
  if (typeof data.risk_level !== "string") {
    throw new Error("Invalid Cisco API response: missing risk_level");
  }
  if (!Array.isArray(data.findings)) {
    throw new Error("Invalid Cisco API response: missing findings array");
  }
  // Validate each finding is an object with expected string fields
  const findings: CiscoFinding[] = data.findings.map((f: unknown, i: number) => {
    if (!isObject(f)) {
      throw new Error(`Invalid Cisco API response: findings[${i}] is not an object`);
    }
    return {
      id: typeof f.id === "string" ? f.id : "",
      category: typeof f.category === "string" ? f.category : "",
      severity: typeof f.severity === "string" ? f.severity : "info",
      title: typeof f.title === "string" ? f.title : "",
      description: typeof f.description === "string" ? f.description : "",
      file_path: typeof f.file_path === "string" ? f.file_path : undefined,
      line_number: typeof f.line_number === "number" ? f.line_number : undefined,
      recommendation: typeof f.recommendation === "string" ? f.recommendation : undefined,
    } as CiscoFinding;
  });

  return {
    scan_id: data.scan_id as string,
    status: data.status as CiscoScanResponse["status"],
    risk_level: data.risk_level as CiscoScanResponse["risk_level"],
    findings,
    scanned_at: typeof data.scanned_at === "string" ? data.scanned_at : "",
    scanner_version: typeof data.scanner_version === "string" ? data.scanner_version : "",
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeCiscoResult(data: CiscoScanResponse): ExternalScanResult {
  const findings: ExternalFinding[] = data.findings.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    description: f.description,
    category: f.category,
    file: f.file_path,
    line: f.line_number,
    recommendation: f.recommendation,
  }));

  return {
    scanner: "Cisco Skill Scanner",
    version: data.scanner_version,
    timestamp: data.scanned_at,
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
    throw new Error(`Invalid Cisco API URL: ${urlStr}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Cisco API URL must use HTTPS");
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
    throw new Error("Cisco API URL must not point to a private address");
  }
}
