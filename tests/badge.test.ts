import { describe, it, expect } from "vitest";
import { generateBadgeSvg } from "../src/badge.js";
import type { TrustLevel } from "../src/types.js";

describe("generateBadgeSvg", () => {
  const levels: TrustLevel[] = ["VERIFIED", "PARTIAL", "UNDECLARED", "INCONSISTENT"];

  for (const level of levels) {
    it(`generates valid SVG for ${level}`, () => {
      const svg = generateBadgeSvg(level);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("skill-trust");
      expect(svg).toContain(level.toLowerCase());
    });
  }

  it("uses green color for VERIFIED", () => {
    const svg = generateBadgeSvg("VERIFIED");
    expect(svg).toContain("#22c55e");
  });

  it("uses red color for INCONSISTENT", () => {
    const svg = generateBadgeSvg("INCONSISTENT");
    expect(svg).toContain("#ef4444");
  });

  it("uses yellow color for PARTIAL", () => {
    const svg = generateBadgeSvg("PARTIAL");
    expect(svg).toContain("#eab308");
  });

  it("uses gray color for UNDECLARED", () => {
    const svg = generateBadgeSvg("UNDECLARED");
    expect(svg).toContain("#9ca3af");
  });

  it("includes accessible title and aria-label", () => {
    const svg = generateBadgeSvg("VERIFIED");
    expect(svg).toContain('aria-label="skill-trust: verified"');
    expect(svg).toContain("<title>skill-trust: verified</title>");
  });
});
