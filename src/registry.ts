/**
 * Integration with the Agent Skills registry.
 *
 * Provides helpers for:
 * 1. Looking up a skill by name from the registry (fetch SKILL.md metadata).
 * 2. Publishing a verification result back to the registry.
 *
 * The registry base URL defaults to https://registry.agentskills.io but can be
 * overridden with the AGENT_SKILLS_REGISTRY_URL environment variable.
 */

import type { VerificationResult } from "./types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_URL = "https://registry.agentskills.io";

/** Maximum length of response body included in error messages. */
const MAX_ERROR_BODY_LEN = 256;

/**
 * Validate and return the registry URL.
 * Only https:// URLs are accepted to prevent SSRF against internal services.
 */
export function getRegistryUrl(): string {
  const raw =
    process.env.AGENT_SKILLS_REGISTRY_URL?.replace(/\/+$/, "") ||
    DEFAULT_REGISTRY_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid registry URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `Registry URL must use https:// (got ${parsed.protocol}). ` +
        "Set AGENT_SKILLS_REGISTRY_URL to a valid https:// URL.",
    );
  }

  // Block private / link-local IPs to prevent SSRF
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error(
      `Registry URL must not point to a private/internal address (got ${host}).`,
    );
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrySkillInfo {
  name: string;
  description: string;
  repository: string;
  version: string;
  trust?: Record<string, unknown>;
}

export interface PublishPayload {
  skill: string;
  level: string;
  version: string;
  summary: VerificationResult["summary"];
  timestamp: string;
}

export interface RegistryError {
  status: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate that a parsed JSON response matches the RegistrySkillInfo schema.
 * Prevents prototype pollution and unexpected property injection.
 */
function validateSkillInfo(data: unknown): RegistrySkillInfo {
  if (!isObject(data)) {
    throw new RegistryApiError(0, "Invalid registry response: expected an object");
  }
  if (typeof data.name !== "string" || !data.name) {
    throw new RegistryApiError(0, "Invalid registry response: missing 'name'");
  }
  if (typeof data.description !== "string") {
    throw new RegistryApiError(0, "Invalid registry response: missing 'description'");
  }
  if (typeof data.repository !== "string") {
    throw new RegistryApiError(0, "Invalid registry response: missing 'repository'");
  }
  if (typeof data.version !== "string") {
    throw new RegistryApiError(0, "Invalid registry response: missing 'version'");
  }

  const result: RegistrySkillInfo = {
    name: data.name,
    description: data.description,
    repository: data.repository,
    version: data.version,
  };

  if (isObject(data.trust)) {
    result.trust = data.trust;
  }

  return result;
}

/**
 * Truncate and sanitize a response body for safe inclusion in error messages.
 */
function sanitizeErrorBody(body: string): string {
  return body.slice(0, MAX_ERROR_BODY_LEN).replace(/[\x00-\x1f]/g, "");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Look up a skill by name from the Agent Skills registry.
 *
 * GET {registry}/api/v1/skills/{name}
 */
export async function lookupSkill(
  name: string,
): Promise<RegistrySkillInfo> {
  const url = `${getRegistryUrl()}/api/v1/skills/${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });

  if (!res.ok) {
    const body = sanitizeErrorBody(await res.text().catch(() => ""));
    throw new RegistryApiError(
      res.status,
      `Failed to look up skill '${name}': ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
    );
  }

  const json: unknown = await res.json();
  return validateSkillInfo(json);
}

/**
 * Publish a verification result to the Agent Skills registry.
 *
 * POST {registry}/api/v1/skills/{name}/trust
 *
 * Requires an API token passed via the AGENT_SKILLS_REGISTRY_TOKEN environment
 * variable.
 */
export async function publishResult(
  skillName: string,
  result: VerificationResult,
  version: string,
): Promise<void> {
  const token = process.env.AGENT_SKILLS_REGISTRY_TOKEN;
  if (!token) {
    throw new Error(
      "AGENT_SKILLS_REGISTRY_TOKEN environment variable is required to publish results",
    );
  }

  const url = `${getRegistryUrl()}/api/v1/skills/${encodeURIComponent(skillName)}/trust`;

  const payload: PublishPayload = {
    skill: skillName,
    level: result.level,
    version,
    summary: result.summary,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    redirect: "error",
  });

  if (!res.ok) {
    const body = sanitizeErrorBody(await res.text().catch(() => ""));
    throw new RegistryApiError(
      res.status,
      `Failed to publish result for '${skillName}': ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class RegistryApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RegistryApiError";
    this.status = status;
  }
}
