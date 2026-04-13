# Contributing to skill-trust

Thanks for your interest in contributing! This project aims to bring transparency standards to the Agent Skills ecosystem.

## Getting started

```bash
git clone https://github.com/Ryan-focus/skill-trust.git
cd skill-trust
npm install
npm test
```

## Development workflow

1. **Create a branch** from `main` for your changes
2. **Write tests** for any new functionality
3. **Run checks** before submitting:
   ```bash
   npm test          # Run test suite
   npm run build     # Verify TypeScript compilation
   ```
4. **Open a Pull Request** with a clear description of what changed and why

## Project structure

```
src/
├── cli.ts              # CLI entry — commands: verify, verify-all, init, badge, lookup
├── parser.ts           # SKILL.md frontmatter parser + validation
├── verifier.ts         # Core verification engine
├── reporter.ts         # Output formatting (terminal, JSON, SARIF)
├── badge.ts            # SVG badge generator
├── registry.ts         # Agent Skills registry integration
├── monorepo.ts         # Multi-skill discovery & batch verification
├── wizard.ts           # Interactive trust declaration generator
├── types.ts            # All TypeScript interfaces — start here
├── index.ts            # Public API exports
├── ast/                # AST-based code analysis
│   ├── context.ts      # Strips comments/strings (preserves line numbers)
│   ├── analyzer.ts     # Extracts imports, function calls
│   └── index.ts
├── integrations/       # External scanner adapters (Cisco, Aguara)
│   ├── cisco.ts
│   ├── aguara.ts
│   ├── combined-report.ts
│   ├── types.ts
│   └── index.ts
├── rules/              # Verification rules (each implements Rule interface)
│   ├── index.ts        # Rule registry
│   ├── utils.ts        # Pattern scanning utilities
│   ├── network.ts      # Network access detection
│   ├── filesystem.ts   # File write + scope detection
│   ├── shell.ts        # Shell execution detection
│   ├── environment.ts  # Env var access detection
│   ├── data-flow.ts    # Exfiltration endpoint detection
│   └── obfuscation.ts  # Obfuscation technique detection
└── action/
    └── index.ts        # GitHub Action entry point

tests/                  # Vitest tests mirroring src/ structure
examples/               # Example skills for testing
```

## Adding a new rule

1. Create `src/rules/your-rule.ts` implementing the `Rule` interface from `types.ts`
2. Use `scanContent(content, patterns, file.language)` for AST-aware pattern matching
3. Register it in `src/rules/index.ts`
4. Add tests in `tests/rules.test.ts`
5. Update `TRUST-SPEC.md` if the rule relates to a new trust declaration field

## Adding a new integration

1. Create `src/integrations/your-scanner.ts` following the adapter pattern in `cisco.ts`
2. Export from `src/integrations/index.ts`
3. Add to the `--scan` handler in `src/cli.ts`
4. Add tests in `tests/integrations.test.ts`

## For AI Agents

If you are an AI agent forking or extending this project:

- **Start with `src/types.ts`** — it defines the entire data model
- **Read `CLAUDE.md`** — it has detailed architecture notes, extension patterns, and conventions
- **Read `.cursorrules`** — project-specific rules for AI-assisted development
- **Use `makeSkill()` helper** in tests — see `tests/rules.test.ts` for examples
- **All imports use `.js` extensions** — this is ESM, not CommonJS

## Security

If you discover a security vulnerability, please report it privately via GitHub Security Advisories rather than opening a public issue.

## Code style

- Keep dependencies minimal — this project aims for a small footprint
- Validate all external inputs at system boundaries
- Prefer explicit types over `any`
- Use AST-aware scanning (`file.language` parameter) to avoid false positives

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
