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
  });

  if (!response.ok) {
    throw new Error(
      `Cisco Skill Scanner API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as CiscoScanResponse;
  return normalizeCiscoResult(data);
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

  // Block private IPs
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host === "::1"
  ) {
    throw new Error("Cisco API URL must not point to a private address");
  }
}
