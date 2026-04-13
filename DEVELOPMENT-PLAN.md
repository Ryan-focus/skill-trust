# skill-trust Development Plan

## 2-Week Sprint Breakdown

### Week 1: Core Engine + CLI (Days 1-7)

#### Day 1-2: Project Setup + Parser
- [ ] Initialize project (`npm init`, tsconfig, eslint)
- [ ] Implement `parser.ts` — parse SKILL.md frontmatter using `gray-matter`
- [ ] Validate trust declaration against schema (types.ts)
- [ ] Handle missing trust block (UNDECLARED case)
- [ ] Write tests for parser

#### Day 3-4: Scanner + Rules
- [ ] Implement `scanner.ts` — read all files in skill directory
- [ ] Detect file language (Python, JS/TS, Bash) by extension + shebang
- [ ] Implement rules:
  - [ ] `network.ts` — detect network access patterns
  - [ ] `filesystem.ts` — detect file write patterns + scope violations
  - [ ] `shell.ts` — detect shell execution patterns
  - [ ] `environment.ts` — detect env var access patterns
  - [ ] `data-flow.ts` — detect undeclared endpoints
  - [ ] `obfuscation.ts` — detect obfuscation techniques
- [ ] Write tests for each rule (use examples/trusted-skill and examples/untrusted-skill)

#### Day 5: Reporter
- [ ] Implement `reporter.ts` — terminal output with chalk
- [ ] Implement JSON output format
- [ ] Implement trust level calculation logic
- [ ] Write tests for reporter

#### Day 6-7: CLI + Integration Testing
- [ ] Implement `cli.ts` using commander
- [ ] Commands: `verify <path>`, `init` (scaffold trust block)
- [ ] Flags: `--strict`, `--format`, `--verbose`
- [ ] End-to-end tests: run CLI against example skills
- [ ] Fix bugs from integration testing

### Week 2: GitHub Action + Polish (Days 8-14)

#### Day 8-9: GitHub Action
- [ ] Implement `action/index.ts` — wrapper around core engine
- [ ] PR comment integration (post results as comment)
- [ ] Exit code handling (fail CI on INCONSISTENT)
- [ ] Test with a real GitHub repository

#### Day 10-11: Documentation + Examples
- [ ] Polish README.md with real output examples
- [ ] Write CONTRIBUTING.md
- [ ] Add more example skills (3-4 covering different scenarios)
- [ ] Record a terminal demo (asciinema or GIF)

#### Day 12-13: Badge + Extras
- [ ] Implement `skill-trust badge` command (generate SVG badge)
- [ ] SARIF output format (for GitHub Code Scanning integration)
- [ ] `skill-trust init` interactive wizard
- [ ] Edge case handling and error messages

#### Day 14: Release
- [ ] Final testing across all features
- [ ] Publish to npm
- [ ] Publish GitHub Action to Marketplace
- [ ] Write launch post (dev.to / GitHub Discussions)
- [ ] Submit to Agent Skills community (Discord / GitHub)

## Key Design Decisions

### 1. Pattern matching vs AST parsing
**Decision: Start with regex/pattern matching, upgrade to AST later.**

Regex is simpler and covers 90% of cases. AST parsing (e.g., tree-sitter) can be added in v0.2 for better accuracy. The goal for MVP is to catch obvious violations, not to be a perfect static analyzer.

### 2. Strictness levels
**Decision: Default to lenient, with --strict flag.**

Developers should feel encouraged to add trust declarations. If the first experience is a wall of errors, they won't adopt it. Warnings for most issues, errors only for clear contradictions.

### 3. SKILL.md body scanning
**Decision: Scan both frontmatter and body content.**

Some skills embed code examples or inline scripts in the SKILL.md body. The scanner should check these too, but with lower severity (INFO level).

### 4. Monorepo support
**Decision: Support scanning multiple skills in one repo.**

`skill-trust verify ./skills/` should recursively find and verify all skills. This is common in enterprise setups.

## Success Metrics

- **Week 1 milestone**: `npx skill-trust verify ./examples/untrusted-skill` produces correct report with all 5 violations flagged
- **Week 2 milestone**: GitHub Action runs on a real PR and posts a comment
- **Launch milestone**: Published to npm with working CLI + Action
