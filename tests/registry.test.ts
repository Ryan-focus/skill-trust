import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  lookupSkill,
  publishResult,
  getRegistryUrl,
  RegistryApiError,
} from "../src/registry.js";
import type { VerificationResult } from "../src/types.js";

// ---------------------------------------------------------------------------
// getRegistryUrl
// ---------------------------------------------------------------------------

describe("getRegistryUrl", () => {
  const originalEnv = process.env.AGENT_SKILLS_REGISTRY_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENT_SKILLS_REGISTRY_URL;
    } else {
      process.env.AGENT_SKILLS_REGISTRY_URL = originalEnv;
    }
  });

  it("returns default URL when env is not set", () => {
    delete process.env.AGENT_SKILLS_REGISTRY_URL;
    expect(getRegistryUrl()).toBe("https://registry.agentskills.io");
  });

  it("returns custom URL from env", () => {
    process.env.AGENT_SKILLS_REGISTRY_URL = "https://custom.registry.io";
    expect(getRegistryUrl()).toBe("https://custom.registry.io");
  });

  it("strips trailing slashes", () => {
    process.env.AGENT_SKILLS_REGISTRY_URL = "https://custom.registry.io///";
    expect(getRegistryUrl()).toBe("https://custom.registry.io");
  });
});

// ---------------------------------------------------------------------------
// lookupSkill
// ---------------------------------------------------------------------------

describe("lookupSkill", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns skill info on success", async () => {
    const skillInfo = {
      name: "csv-analyzer",
      description: "Analyze CSV files",
      repository: "https://github.com/example/csv-analyzer",
      version: "1.0.0",
      trust: { permissions: { network: false } },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => skillInfo,
    });

    const result = await lookupSkill("csv-analyzer");
    expect(result).toEqual(skillInfo);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/skills/csv-analyzer"),
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("throws RegistryApiError on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "skill not found",
    });

    await expect(lookupSkill("nonexistent")).rejects.toThrow(RegistryApiError);
    await expect(lookupSkill("nonexistent")).rejects.toThrow(/404/);
  });
});

// ---------------------------------------------------------------------------
// publishResult
// ---------------------------------------------------------------------------

describe("publishResult", () => {
  const mockFetch = vi.fn();
  const originalToken = process.env.AGENT_SKILLS_REGISTRY_TOKEN;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env.AGENT_SKILLS_REGISTRY_TOKEN;
    } else {
      process.env.AGENT_SKILLS_REGISTRY_TOKEN = originalToken;
    }
  });

  const mockResult: VerificationResult = {
    skill: "csv-analyzer",
    level: "VERIFIED",
    findings: [],
    summary: { errors: 0, warnings: 0, info: 0, passed: 6 },
  };

  it("throws if AGENT_SKILLS_REGISTRY_TOKEN is missing", async () => {
    delete process.env.AGENT_SKILLS_REGISTRY_TOKEN;
    await expect(
      publishResult("csv-analyzer", mockResult, "1.0.0"),
    ).rejects.toThrow("AGENT_SKILLS_REGISTRY_TOKEN");
  });

  it("sends POST request with correct payload", async () => {
    process.env.AGENT_SKILLS_REGISTRY_TOKEN = "test-token-123";
    mockFetch.mockResolvedValueOnce({ ok: true });

    await publishResult("csv-analyzer", mockResult, "1.0.0");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v1/skills/csv-analyzer/trust");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token-123");

    const body = JSON.parse(init.body);
    expect(body.skill).toBe("csv-analyzer");
    expect(body.level).toBe("VERIFIED");
    expect(body.version).toBe("1.0.0");
    expect(body.timestamp).toBeDefined();
  });

  it("throws RegistryApiError on failure", async () => {
    process.env.AGENT_SKILLS_REGISTRY_TOKEN = "test-token-123";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "invalid token",
    });

    await expect(
      publishResult("csv-analyzer", mockResult, "1.0.0"),
    ).rejects.toThrow(RegistryApiError);
  });
});
