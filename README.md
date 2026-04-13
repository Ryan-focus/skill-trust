# skill-trust

**Transparency verifier for Agent Skills.**

> Don't just scan for threats — demand transparency.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## The problem

Agent Skills are powerful — they extend AI agents with specialized capabilities. But when you install a skill from a public registry, you're trusting code you haven't reviewed.

Existing security scanners look for known attack patterns. But what about skills that simply **don't tell you what they do**?

`skill-trust` takes a different approach: it verifies that **skills declare their behavior honestly**.

## How it works

1. Skill authors add a `trust` block to their SKILL.md frontmatter, declaring what the skill accesses (network, filesystem, shell, environment variables) and where data flows
2. `skill-trust verify` scans the skill's code and compares actual behavior against these declarations
3. Inconsistencies are flagged — not as malware, but as broken transparency contracts

```
$ npx skill-trust verify ./my-skill

  skill-trust v0.1.0

  ✅ Network:    declared=false  found=0 matches
  ✅ Shell:      declared=true   found=3 matches
  ⚠  Filesystem: declared="outputs" but writes to "/tmp"
  ✅ Data flow:  no undeclared endpoints
  ✅ Obfuscation: none detected

  Result: PARTIAL (1 warning)
```

## Quick start

### As a CLI

```bash
# Verify a local skill
npx skill-trust verify ./path/to/skill

# Verify with strict mode (warnings become errors)
npx skill-trust verify ./path/to/skill --strict

# Output as JSON (for CI integration)
npx skill-trust verify ./path/to/skill --format json
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
      - uses: anthropic-skills/skill-trust@v1
        with:
          skill_path: ./my-skill
          strict: false
```

## Trust declarations

Add a `trust` block to your SKILL.md frontmatter:

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
      scope: "outputs"
    shell: true
    environment: false
  data-flow:
    exfiltration: none
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

See the full [Trust Declaration Specification](./TRUST-SPEC.md) for details.

## Trust levels

| Level | Badge | Meaning |
|-------|-------|---------|
| 🟢 **Verified** | All checks pass | Declarations match actual code |
| 🟡 **Partial** | Warnings exist | Minor inconsistencies found |
| ⚪ **Undeclared** | No trust block | Skill hasn't opted into transparency |
| 🔴 **Inconsistent** | Checks fail | Code contradicts declarations |

## Verification rules

| Rule | What it checks |
|------|---------------|
| Network consistency | `network: false` but code contains `curl`, `fetch`, `requests`, etc. |
| Filesystem scope | Declared scope vs actual file write paths |
| Shell consistency | `shell: false` but code uses `subprocess`, `exec`, `spawn`, etc. |
| Environment access | `environment: false` but code reads `process.env`, `os.environ`, etc. |
| Data flow | Undeclared URLs or endpoints in code |
| Obfuscation | Base64 commands, eval with dynamic strings, hex-encoded payloads |
| Missing declaration | No `trust` field in SKILL.md frontmatter |

## Comparison with existing tools

| | skill-trust | Cisco skill-scanner | Aguara | ClawSecure |
|---|---|---|---|---|
| **Approach** | Declaration verification | Threat detection | Static analysis | Multi-layer audit |
| **Goal** | Ensure transparency | Find vulnerabilities | Find vulnerabilities | Security scoring |
| **Requires declarations** | Yes (or flags as undeclared) | No | No | No |
| **Developer-facing** | ✅ Self-check in CI | ❌ Post-hoc scan | ❌ Post-hoc scan | ❌ Post-hoc scan |
| **Open source** | ✅ MIT | ✅ Apache 2.0 | ✅ | ❌ Proprietary |
| **Zero dependencies** | ✅ | ❌ (LLM optional) | ✅ | ❌ (Cloud) |

## Project structure

```
skill-trust/
├── src/
│   ├── cli.ts                # CLI entry point (verify, badge, lookup)
│   ├── parser.ts             # SKILL.md frontmatter parser
│   ├── verifier.ts           # Core verification engine
│   ├── rules/
│   │   ├── index.ts          # Rule registry
│   │   ├── network.ts        # Network consistency rule
│   │   ├── filesystem.ts     # Filesystem scope rule
│   │   ├── shell.ts          # Shell consistency rule
│   │   ├── environment.ts    # Environment access rule
│   │   ├── data-flow.ts      # Data exfiltration rule
│   │   ├── obfuscation.ts    # Obfuscation detection rule
│   │   └── utils.ts          # Shared rule utilities
│   ├── reporter.ts           # Output formatting (terminal, JSON, SARIF)
│   ├── badge.ts              # Trust badge SVG generator
│   ├── registry.ts           # Agent Skills registry integration
│   ├── action/
│   │   └── index.ts          # GitHub Action entry point
│   └── types.ts              # TypeScript type definitions
├── action.yml                # GitHub Action metadata
├── examples/
│   ├── trusted-skill/        # Example skill with trust declarations
│   └── untrusted-skill/      # Example skill without declarations
├── tests/
├── TRUST-SPEC.md             # Trust declaration specification
├── package.json
├── tsconfig.json
└── README.md
```

## Roadmap

- [x] Trust declaration specification
- [x] Core verification engine
- [x] CLI tool (`npx skill-trust verify`)
- [x] GitHub Action
- [x] SARIF output for GitHub Code Scanning
- [x] Trust badge generator
- [x] Integration with Agent Skills registry

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

This project follows the [Agent Skills specification](https://agentskills.io/specification) and aims to complement — not compete with — existing security tools.

## License

MIT — see [LICENSE](./LICENSE) for details.

---

Built by [Raven](https://github.com/Ryan-focus) — an independent developer who believes Agent Skills deserve the same transparency standards as the code we already write.
