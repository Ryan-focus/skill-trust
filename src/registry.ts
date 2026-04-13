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

export function getRegistryUrl(): string {
  return (
    process.env.AGENT_SKILLS_REGISTRY_URL?.replace(/\/+$/, "") ||
    DEFAULT_REGISTRY_URL
  );
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
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RegistryApiError(
      res.status,
      `Failed to look up skill '${name}': ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
    );
  }

  return (await res.json()) as RegistrySkillInfo;
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
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
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
