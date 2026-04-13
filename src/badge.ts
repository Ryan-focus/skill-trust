import type { TrustLevel } from "./types.js";

/**
 * Badge colour per trust level.
 */
const LEVEL_COLOR: Record<TrustLevel, string> = {
  VERIFIED: "#22c55e",     // green
  PARTIAL: "#eab308",      // yellow
  UNDECLARED: "#9ca3af",   // gray
  INCONSISTENT: "#ef4444", // red
};

const LEVEL_LABEL: Record<TrustLevel, string> = {
  VERIFIED: "verified",
  PARTIAL: "partial",
  UNDECLARED: "undeclared",
  INCONSISTENT: "inconsistent",
};

/**
 * Escape a string for safe embedding in XML/SVG attributes and text nodes.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate a shields.io-style SVG badge for a trust level.
 *
 * The SVG is self-contained with no external dependencies and follows
 * the flat style used by shields.io badges.
 */
export function generateBadgeSvg(level: TrustLevel): string {
  const label = "skill-trust";
  const value = LEVEL_LABEL[level];
  const color = LEVEL_COLOR[level];

  if (!value || !color) {
    throw new Error(`Unknown trust level: ${String(level)}`);
  }

  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);

  // Approximate character widths (monospace-ish) for sizing
  const labelWidth = label.length * 6.8 + 12;
  const valueWidth = value.length * 6.8 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${safeLabel}</text>
    <text x="${labelWidth / 2}" y="14">${safeLabel}</text>
    <text aria-hidden="true" x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${safeValue}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${safeValue}</text>
  </g>
</svg>`;
}
