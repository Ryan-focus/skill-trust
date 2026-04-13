# CLAUDE.md — Agent Guide for skill-trust

This file helps AI agents (Claude Code, Cursor, Copilot, etc.) understand, build, test, and extend this project.

## Quick Start

```bash
npm install          # install dependencies
npm test             # run all tests (vitest)
npm run build        # compile TypeScript → dist/
npx tsc --noEmit     # type-check without emitting
```

## What This Project Does

**skill-trust** is a transparency verifier for Agent Skills. It:
1. Parses a `SKILL.md` file containing a YAML `trust` declaration
2. Scans the skill's source code for actual behavior (network, filesystem, shell, env access)
3. Compares declarations vs. actual code patterns
4. Reports inconsistencies as findings with severity levels

Trust levels: `VERIFIED` | `PARTIAL` | `UNDECLARED` | `INCONSISTENT`

## Architecture

```
src/
├── cli.ts              # CLI entry (commander.js) — commands: verify, verify-all, init, badge, lookup
├── parser.ts           # Parses SKILL.md frontmatter (gray-matter), validates trust schema
├── verifier.ts         # Runs all rules, calculates trust level
├── reporter.ts         # Output: terminal (chalk), JSON, SARIF
├── badge.ts            # SVG badge generator
├── registry.ts         # Agent Skills registry API (lookup/publish)
├── monorepo.ts         # Multi-skill discovery & batch verification
├── wizard.ts           # Interactive trust declaration generator (readline/promises)
├── types.ts            # ★ All TypeScript interfaces — start here to understand the data model
├── index.ts            # Public API exports
├── ast/                # AST-based code analysis (context-aware scanning)
│   ├── context.ts      # Strips comments/strings from code (preserves line numbers)
│   ├── analyzer.ts     # Extracts imports, function calls from code
│   └── index.ts
├── integrations/       # External scanner adapters
│   ├── cisco.ts        # Cisco Skill Scanner API adapter
│   ├── aguara.ts       # Aguara API adapter
│   ├── combined-report.ts  # Merges trust + external scan results
│   ├── types.ts        # Integration-specific types
│   └── index.ts
├── rules/              # Verification rules (each implements Rule interface)
│   ├── index.ts        # Rule registry — allRules array
│   ├── utils.ts        # Pattern scanning utilities (scanContent, scanFiles)
│   ├── network.ts      # Detects network access (fetch, curl, requests, axios, URLs)
│   ├── filesystem.ts   # Detects file writes + scope violations
│   ├── shell.ts        # Detects shell execution (subprocess, child_process, eval)
│   ├── environment.ts  # Detects env var access (process.env, os.environ)
│   ├── data-flow.ts    # Detects undeclared exfiltration endpoints
│   └── obfuscation.ts  # Detects obfuscation (base64, hex, eval with dynamic args)
└── action/
    └── index.ts        # GitHub Action entry point

tests/                  # Vitest tests — mirrors src/ structure
examples/               # Example skills for testing
├── trusted-skill/      # Clean skill → VERIFIED
└── untrusted-skill/    # Intentional violations → INCONSISTENT
```

## Key Type Definitions (src/types.ts)

Read `src/types.ts` first — it defines the entire data model:

- **`TrustDeclaration`** — the YAML trust block schema (permissions, data-flow, dependencies, boundaries)
- **`ParsedSkill`** — parsed SKILL.md + collected source files
- **`SkillFile`** — single source file with content, path, detected language
- **`Rule`** — verification rule interface: `{ id, name, description, check(skill): Finding[] }`
- **`Finding`** — a single verification finding (rule, severity, message, file, line)
- **`VerificationResult`** — full result: skill name, trust level, findings array, summary counts

## How to Add a New Verification Rule

1. Create `src/rules/my-rule.ts`:
   ```typescript
   import type { Rule, ParsedSkill, Finding } from "../types.js";
   import { scanContent, type PatternDef } from "./utils.js";

   const MY_PATTERNS: PatternDef[] = [
     { regex: /pattern/, id: "my-pattern", label: "description" },
   ];

   export const myRule: Rule = {
     id: "my-rule",
     name: "My Rule",
     description: "What this rule checks",
     check(skill: ParsedSkill): Finding[] {
       if (!skill.trust) return [];
       const findings: Finding[] = [];
       for (const file of skill.files) {
         // Pass file.language for AST-aware scanning (skips comments/strings)
         const matches = scanContent(file.content, MY_PATTERNS, file.language);
         if (matches.length > 0) {
           findings.push({
             rule: "my-rule",
             severity: "error",
             message: `Description of violation`,
             file: file.relativePath,
             line: matches[0].line,
           });
         }
       }
       return findings;
     },
   };
   ```
2. Register in `src/rules/index.ts` — add to `allRules` array
3. Add tests in `tests/rules.test.ts` — use `makeSkill()` and `baseTrust()` helpers
4. Update `TRUST-SPEC.md` if adding new trust declaration fields

## How to Add a New CLI Command

Edit `src/cli.ts` — add a new `program.command(...)` block. Follow the existing pattern (verify, verify-all, init, badge, lookup).

## How to Add a New External Scanner Integration

1. Create `src/integrations/my-scanner.ts` — follow `cisco.ts` pattern
2. Export from `src/integrations/index.ts`
3. Add to the `--scan` option handler in `src/cli.ts`

## Conventions

- **Module system**: ESM (`"type": "module"` in package.json), use `.js` extensions in imports
- **Node.js imports**: Use `node:` prefix (`import * as fs from "node:fs"`)
- **Error handling**: Throw `ParseError` for validation errors, let others bubble up
- **Security**: Validate at boundaries, strip ANSI in output, check symlinks, limit file sizes
- **Testing**: Vitest with `describe/it/expect`, use `makeSkill()` helper for test data
- **AST scanning**: Pass `file.language` to `scanContent()` for context-aware matching
- **No `any`**: Use explicit types. Read `types.ts` for all interfaces.

## Testing

```bash
npm test              # run all tests
npx vitest run        # run once (no watch)
npx vitest tests/ast.test.ts  # run single test file
```

Test structure:
- `tests/rules.test.ts` — unit tests per rule
- `tests/e2e.test.ts` — end-to-end with example skills
- `tests/ast.test.ts` — AST stripping & analyzer
- `tests/monorepo.test.ts` — multi-skill discovery
- `tests/wizard.test.ts` — SKILL.md generation
- `tests/integrations.test.ts` — combined report logic

## Build & Publish

```bash
npm run build         # tsc → dist/
node dist/cli.js verify examples/trusted-skill    # smoke test
node dist/cli.js verify-all examples/             # monorepo smoke test
```

## Dependencies (keep minimal)

- **chalk** — terminal colors
- **commander** — CLI framework
- **glob** — file pattern matching
- **gray-matter** — YAML frontmatter parsing

No AST parser library — context stripping is done with a custom state machine in `src/ast/context.ts`.
