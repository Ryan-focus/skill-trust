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
   npm run lint      # Check code style
   ```
4. **Open a Pull Request** with a clear description of what changed and why

## Project structure

- `src/` — TypeScript source
  - `cli.ts` — CLI entry point (verify, badge, lookup)
  - `parser.ts` — SKILL.md frontmatter parser
  - `verifier.ts` — Core verification engine
  - `rules/` — Individual verification rules
  - `reporter.ts` — Output formatting (terminal, JSON, SARIF)
  - `badge.ts` — SVG badge generator
  - `registry.ts` — Agent Skills registry integration
  - `action/index.ts` — GitHub Action entry point
- `tests/` — Vitest test files
- `examples/` — Example skills for testing

## Adding a new rule

1. Create `src/rules/your-rule.ts` implementing the `Rule` interface from `types.ts`
2. Register it in `src/rules/index.ts`
3. Add tests in `tests/rules.test.ts`
4. Update `TRUST-SPEC.md` if the rule relates to a new trust declaration field

## Security

If you discover a security vulnerability, please report it privately via GitHub Security Advisories rather than opening a public issue.

## Code style

- Keep dependencies minimal — this project aims for a small footprint
- Validate all external inputs at system boundaries
- Prefer explicit types over `any`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
