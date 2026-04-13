import type { Rule, ParsedSkill, Finding, TrustEndpoint } from "../types.js";

/**
 * Extract all URLs from file content, returning line numbers.
 */
function extractUrls(
  content: string
): { url: string; line: number }[] {
  const lines = content.split("\n");
  const results: { url: string; line: number }[] = [];
  const urlRegex = /https?:\/\/[^\s'")\]>,]+/g;

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(lines[i])) !== null) {
      results.push({ url: match[0], line: i + 1 });
    }
  }
  return results;
}

export const dataFlowRule: Rule = {
  id: "data-flow",
  name: "Data Flow Consistency",
  description:
    "Checks that data exfiltration declarations match actual network egress patterns",

  check(skill: ParsedSkill): Finding[] {
    const trust = skill.trust;
    if (!trust) return [];

    const exfiltration = trust["data-flow"].exfiltration;
    const findings: Finding[] = [];

    if (exfiltration === "none") {
      // Flag any outgoing URL / network egress
      for (const file of skill.files) {
        const urls = extractUrls(file.content);
        if (urls.length > 0) {
          const first = urls[0];
          findings.push({
            rule: "data-flow",
            severity: "error",
            message: `Data sent to '${first.url}' but exfiltration is declared as 'none'`,
            file: file.relativePath,
            line: first.line,
            declared: "none",
            actual: first.url,
          });
        }
      }
    } else {
      // Endpoints are declared — flag any URL not matching a declared target
      const declared = exfiltration as TrustEndpoint[];
      const declaredHosts = declared.map((ep) => {
        try {
          return new URL(ep.target).hostname;
        } catch {
          return ep.target;
        }
      });

      for (const file of skill.files) {
        const urls = extractUrls(file.content);
        for (const { url, line } of urls) {
          let hostname: string;
          try {
            hostname = new URL(url).hostname;
          } catch {
            continue;
          }
          if (!declaredHosts.includes(hostname)) {
            findings.push({
              rule: "data-flow",
              severity: "error",
              message: `URL '${url}' does not match any declared exfiltration endpoint`,
              file: file.relativePath,
              line,
              declared: declaredHosts.join(", "),
              actual: url,
            });
          }
        }
      }
    }

    return findings;
  },
};
