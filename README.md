# skill-trust

**Transparency verifier for Agent Skills — verify that skills declare their behavior honestly.**

> Don't just scan for threats — demand transparency.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

## What is skill-trust?

When you install an AI Agent Skill from a public registry, you're trusting code you haven't reviewed. Existing security scanners (Cisco Skill Scanner, Aguara, Snyk Agent Scan, etc.) look for **known attack patterns** — but they can't tell you whether a skill is being **transparent about what it does**.

**skill-trust** takes a fundamentally different approach:

- Skill authors add a `trust` block to their `SKILL.md`, declaring what the skill accesses (network, filesystem, shell, environment) and where data flows
- `skill-trust verify` scans the actual code and compares behavior against these declarations
- Inconsistencies are flagged — not as malware, but as **broken transparency contracts**

Think of it like Android's permission manifest or a `package.json` `engines` field — not a virus scanner, but a behavioral contract between skill authors and users.

## Why does this matter?

Threat scanners answer: *"Is this code doing something known-bad?"*

skill-trust answers: *"Is this code doing what the author says it does?"*

A skill might not contain any malware, yet still:
- Access the network without telling you
- Write files outside its declared scope
- Read environment variables (potential credentials) silently
- Use obfuscation techniques that hide intent

**skill-trust catches these transparency gaps** — it's a trust layer that works alongside (not instead of) traditional security scanners.

## Quick demo

```
$ npx skill-trust verify ./my-skill

  skill-trust v0.1.0

  ✅ Network:      declared=false  found=0 matches
  ✅ Shell:        declared=true   found=3 matches
  ⚠  Filesystem:  declared="outputs" but writes to "/tmp"
  ✅ Data flow:    no undeclared endpoints
  ✅ Obfuscation:  none detected

  Result: PARTIAL (1 warning)
```

## Quick start

### As a CLI tool

```bash
# Verify a local skill
npx skill-trust verify ./path/to/skill

# Strict mode — warnings become errors (useful in CI)
npx skill-trust verify ./path/to/skill --strict

# Output as JSON for programmatic use
npx skill-trust verify ./path/to/skill --format json

# Output as SARIF for GitHub Code Scanning
npx skill-trust verify ./path/to/skill --format sarif

# Generate a trust badge
npx skill-trust badge ./path/to/skill > badge.svg

# Look up a skill in the registry
npx skill-trust lookup csv-analyzer
```

### As a GitHub Action

```yaml
# .github/workflows/skill-trust.yml
name: Skill Trust Check
on:
  pull_request:
    paths:
      - '**/SKILL.md'
      - '**/scripts/**'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Ryan-focus/skill-trust@v1
        with:
          skill_path: ./my-skill
          strict: false
```

The action posts a markdown summary to your PR and exports `result`, `warnings`, and `failures` as outputs.

## How to declare trust

Add a `trust` block to your `SKILL.md` frontmatter:

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files.
trust:
  permissions:
    network: false
    filesystem:
      read: true
      write: true
      scope: "outputs"        # "outputs" | "workspace" | "system"
    shell: true
    environment: false
  data-flow:
    exfiltration: none         # "none" | list of declared endpoints
  dependencies:
    runtime:
      - python3
    packages:
      - name: pdfplumber
        registry: pypi
  boundaries:
    - "Does not access files outside the output directory"
    - "Does not transmit any data externally"
---
```

See the full [Trust Declaration Specification](./TRUST-SPEC.md) for all fields and details.

## Trust levels

Based on verification results, each skill receives a trust level:

| Level | Meaning | When |
|-------|---------|------|
| 🟢 **Verified** | All checks pass | Declarations are present and match actual code behavior |
| 🟡 **Partial** | Warnings exist | Minor inconsistencies detected (e.g., filesystem scope drift) |
| ⚪ **Undeclared** | No trust block | Skill hasn't opted into transparency (not necessarily malicious) |
| 🔴 **Inconsistent** | Checks fail | Code directly contradicts declared behavior |

## Verification rules

| Rule | What it checks | Severity |
|------|---------------|----------|
| **Network consistency** | `network: false` but code contains `curl`, `fetch`, `requests`, `axios`, URLs | Error |
| **Filesystem scope** | Declared write scope vs. actual file write paths | Error / Warning |
| **Shell consistency** | `shell: false` but code uses `subprocess`, `exec`, `spawn`, `popen` | Error |
| **Environment access** | `environment: false` but code reads `process.env`, `os.environ`, `$ENV` | Error |
| **Data flow** | `exfiltration: none` but code has undeclared URLs or endpoints | Error |
| **Obfuscation** | base64 commands, `eval` with dynamic strings, hex-encoded payloads | Warning |
| **Missing declaration** | No `trust` field in SKILL.md frontmatter | Info |

## How skill-trust fits in the ecosystem

skill-trust is **complementary** to existing security tools — it addresses a gap that threat scanners don't cover.

| | skill-trust | Threat Scanners (Cisco, Aguara, Snyk, etc.) |
|---|---|---|
| **Approach** | Declaration verification | Threat / vulnerability detection |
| **Question answered** | "Is this skill honest about what it does?" | "Does this skill contain known-bad patterns?" |
| **Requires author opt-in** | Yes — `trust` block in SKILL.md | No |
| **Developer-facing** | ✅ Self-check in CI before publish | Mostly post-install / post-hoc scanning |
| **Catches** | Undeclared network access, hidden file writes, scope violations, obfuscation | Prompt injection, malware payloads, CVEs, supply chain attacks |
| **Best used** | By skill authors during development | By users / security teams after install |

**Recommended workflow**: Use skill-trust during development to ensure your skill is transparent, then pass it through a threat scanner (Cisco Skill Scanner, Aguara, Snyk Agent Scan) before publishing.

## Output formats

| Format | Use case | Flag |
|--------|----------|------|
| **Terminal** | Human-readable with colors | `--format terminal` (default) |
| **JSON** | Programmatic processing, CI pipelines | `--format json` |
| **SARIF** | GitHub Code Scanning integration | `--format sarif` |

## Project structure

```
skill-trust/
├── src/
│   ├── cli.ts                # CLI entry point (verify, badge, lookup)
│   ├── parser.ts             # SKILL.md frontmatter parser & validator
│   ├── verifier.ts           # Core verification engine
│   ├── reporter.ts           # Output formatting (terminal, JSON, SARIF)
│   ├── badge.ts              # Trust badge SVG generator
│   ├── registry.ts           # Agent Skills registry integration
│   ├── types.ts              # TypeScript type definitions
│   ├── action/
│   │   └── index.ts          # GitHub Action entry point
│   └── rules/                # Verification rule implementations
│       ├── network.ts        # Network access consistency
│       ├── filesystem.ts     # File write scope validation
│       ├── shell.ts          # Shell execution consistency
│       ├── environment.ts    # Environment variable access
│       ├── data-flow.ts      # Data exfiltration endpoints
│       └── obfuscation.ts    # Obfuscation technique detection
├── tests/                    # Vitest test suite
├── examples/
│   ├── trusted-skill/        # Example: CSV analyzer with proper declarations
│   └── untrusted-skill/      # Example: text formatter with intentional violations
├── action.yml                # GitHub Action metadata
├── TRUST-SPEC.md             # Trust declaration specification (v0.1.0)
├── CONTRIBUTING.md           # Contribution guidelines
└── package.json
```

## Roadmap

- [x] Trust declaration specification (TRUST-SPEC.md)
- [x] Core verification engine with 7 rules
- [x] CLI tool (`npx skill-trust verify`)
- [x] GitHub Action with PR summaries
- [x] SARIF output for GitHub Code Scanning
- [x] Trust badge SVG generator
- [x] Agent Skills registry integration
- [ ] AST-based analysis (beyond regex pattern matching)
- [ ] Monorepo support (multiple skills per repo)
- [ ] Interactive wizard for generating trust declarations
- [ ] Integration with Cisco Skill Scanner & Aguara for combined reports

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](./LICENSE) for details.

---

Built by [Raven](https://github.com/Ryan-focus) — an independent developer who believes Agent Skills deserve the same transparency standards as the code we already write.
