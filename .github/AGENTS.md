# Agent Instructions for skill-trust

This file provides context for GitHub Copilot and other AI agents working on this repository.

## Project Summary

skill-trust is a transparency verifier for Agent Skills. It parses `SKILL.md` trust declarations, scans source code for actual behavior, and reports inconsistencies.

## Build & Test

```bash
npm install           # install dependencies
npm test              # run vitest
npm run build         # compile TypeScript to dist/
npx tsc --noEmit      # type-check only
```

## Architecture Overview

Start with `src/types.ts` — it defines all data models (TrustDeclaration, ParsedSkill, Rule, Finding, VerificationResult).

The verification pipeline:
1. `parser.ts` parses SKILL.md → `ParsedSkill`
2. `verifier.ts` runs all rules → `VerificationResult`
3. `reporter.ts` formats output (terminal/JSON/SARIF)

Rules live in `src/rules/` and implement the `Rule` interface. AST-aware scanning in `src/ast/` strips comments and strings before pattern matching.

## Extending

- **New rule**: Create `src/rules/X.ts`, register in `src/rules/index.ts`, test in `tests/rules.test.ts`
- **New CLI command**: Add `program.command(...)` in `src/cli.ts`
- **New integration**: Add adapter in `src/integrations/`, follow `cisco.ts` pattern

## Conventions

- ESM with `.js` extensions in imports
- `node:` prefix for Node.js builtins
- Strict TypeScript — no `any`
- Pass `file.language` to `scanContent()` for AST-aware scanning
- Throw `ParseError` for validation errors
