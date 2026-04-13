# skill-trust: Trust Declaration Specification

> Version 0.1.0 (Draft)

## Overview

This specification defines a set of **trust declaration fields** that Agent Skill authors can add to their `SKILL.md` frontmatter. These fields declare the skill's intended behavior boundaries — what it accesses, what it sends, and what it executes.

The `skill-trust` verifier then **compares these declarations against the skill's actual code** to detect inconsistencies.

## Philosophy

> "Trust is not about scanning for malice — it's about demanding transparency."

Existing tools (Cisco skill-scanner, Aguara, ClawSecure) scan skills for known attack patterns. `skill-trust` takes a fundamentally different approach:

1. **Declaration-first**: Skill authors explicitly state what their skill does
2. **Verification**: Automated tooling checks if the code matches the declarations
3. **Transparency**: Users can read the trust declarations before installing

This is analogous to Android's permission manifest or npm's `engines` field — not a virus scanner, but a contract.

## Trust Declaration Fields

Added under a `trust` key in SKILL.md frontmatter:

```yaml
---
name: my-skill
description: A skill that does X.
trust:
  # What does this skill access?
  permissions:
    network: false          # Does it make network requests?
    filesystem:
      read: true            # Does it read files?
      write: true           # Does it write/create files?
      scope: "outputs"      # Where? "outputs" | "workspace" | "system"
    shell: true             # Does it execute shell commands?
    environment: false      # Does it read environment variables?

  # Where does data flow?
  data-flow:
    exfiltration: none      # "none" | list of declared endpoints
    # Example with endpoints:
    # exfiltration:
    #   - target: "https://api.example.com"
    #     purpose: "Upload generated report"
    #     data: "output files only"

  # What external dependencies are used?
  dependencies:
    runtime:                # Required runtime tools
      - python3
      - jq
    packages:               # Package dependencies
      - name: requests
        registry: pypi
      - name: lodash
        registry: npm

  # Behavioral boundaries (what the skill promises NOT to do)
  boundaries:
    - "Does not modify files outside the output directory"
    - "Does not access or transmit API keys or credentials"
    - "Does not install system-level packages"
---
```

## Field Reference

### `trust.permissions`

Declares what system capabilities the skill uses.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `network` | `boolean` | `false` | Whether the skill makes any network requests (HTTP, curl, wget, fetch, etc.) |
| `filesystem.read` | `boolean` | `false` | Whether the skill reads files from disk |
| `filesystem.write` | `boolean` | `false` | Whether the skill creates or modifies files |
| `filesystem.scope` | `string` | `"outputs"` | Scope of file operations: `"outputs"` (output dir only), `"workspace"` (project dir), `"system"` (anywhere) |
| `shell` | `boolean` | `false` | Whether the skill executes shell commands or subprocesses |
| `environment` | `boolean` | `false` | Whether the skill reads environment variables (potential credential access) |

### `trust.data-flow`

Declares where data goes.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `exfiltration` | `"none"` \| `list` | `"none"` | If `"none"`, the skill sends no data externally. If a list, each entry declares a `target` URL, `purpose`, and `data` description. |

### `trust.dependencies`

Declares what the skill needs to run.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `runtime` | `string[]` | `[]` | System tools required (e.g., `python3`, `node`, `git`, `jq`) |
| `packages` | `object[]` | `[]` | Package dependencies with `name` and `registry` (`npm`, `pypi`, `crates`, etc.) |

### `trust.boundaries`

A human-readable list of behavioral promises. These are **not machine-verified** but serve as documentation for users reviewing the skill. Future versions may support structured boundary definitions.

## Verification Rules

`skill-trust verify` checks the following:

### Rule 1: Network consistency

If `trust.permissions.network` is `false`, the verifier flags any occurrence of:
- `curl`, `wget`, `fetch`, `http.get`, `requests.get/post`, `axios`, `urllib`
- Any URL pattern (`http://`, `https://`, `ftp://`)
- Network-related imports (`import requests`, `require('axios')`, `import urllib`)

### Rule 2: Filesystem consistency

If `trust.permissions.filesystem.write` is `false`, flag:
- File write operations: `open(..., 'w')`, `writeFileSync`, `fs.write`, `>`, `>>`
- Directory creation: `mkdir`, `os.makedirs`

If `trust.permissions.filesystem.scope` is `"outputs"`, flag writes to paths outside the declared scope.

### Rule 3: Shell consistency

If `trust.permissions.shell` is `false`, flag:
- `subprocess`, `exec`, `spawn`, `child_process`, `os.system`, `popen`
- Backtick execution in bash scripts
- `eval()` calls

### Rule 4: Environment consistency

If `trust.permissions.environment` is `false`, flag:
- `process.env`, `os.environ`, `os.getenv`, `$ENV`, `${VAR}`
- `.env` file reads

### Rule 5: Data exfiltration consistency

If `trust.data-flow.exfiltration` is `"none"`, flag any network egress patterns (same as Rule 1).

If endpoints are declared, flag any URL in code that does NOT match a declared target.

### Rule 6: Obfuscation detection

Flag common obfuscation techniques regardless of declarations:
- `base64` encoding/decoding of commands
- `eval()` with dynamic strings
- Hex-encoded strings
- String concatenation building URLs or commands

### Rule 7: Missing trust declaration

If a SKILL.md has no `trust` field at all, report it as `UNDECLARED` — not necessarily malicious, but not transparent either.

## Verification Output

```
skill-trust verify ./my-skill

┌─────────────────────────────────────────────┐
│  skill-trust verification report            │
│  Skill: my-skill                            │
│  Status: ⚠ 2 warnings, 0 failures          │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ PASS  Network: declared=false, found=0  │
│  ✅ PASS  Shell: declared=true, found=3     │
│  ⚠  WARN  Filesystem scope: declared=       │
│           "outputs", but scripts/run.py:12  │
│           writes to "/tmp/cache"            │
│  ⚠  WARN  Undeclared dependency: scripts/   │
│           run.py imports 'requests' but     │
│           not listed in dependencies        │
│  ✅ PASS  No obfuscation patterns detected  │
│  ✅ PASS  Data flow: no undeclared endpoints│
│                                             │
└─────────────────────────────────────────────┘
```

## Trust Levels

Based on verification results, skills receive a trust level:

| Level | Badge | Criteria |
|-------|-------|----------|
| **Verified** | 🟢 | All declarations present, all checks pass |
| **Partial** | 🟡 | Declarations present but warnings exist |
| **Undeclared** | ⚪ | No trust declarations in SKILL.md |
| **Inconsistent** | 🔴 | Declarations contradict actual code behavior |

## Compatibility

This specification is designed as an **extension** to the [Agent Skills specification](https://agentskills.io/specification). The `trust` field lives in the existing frontmatter alongside `name`, `description`, `license`, etc.

Skills without `trust` declarations remain valid Agent Skills — this is opt-in, not breaking.
