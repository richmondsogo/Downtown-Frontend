# Repository File Structure

This document defines the functional directory conventions and file placement rules for this repository.

Agents and human contributors must follow these conventions to keep the codebase navigable, predictable, and clean.

---

## Philosophy

1. **Predictable locations**: Every file belongs in a clearly defined directory based on its function.
2. **Clean root**: The repository root contains only essential configuration and top-level entry documents.
3. **No stray files**: Do not drop temporary scripts, scratchpads, test output, or experimental files into arbitrary directories.
4. **Functional flexibility**: The structure is functional, not rigid. Project-specific build and tooling files (such as package manifests, compiler configs, and linter configs) reside where their ecosystems expect them without unnecessary hurdles.

---

## Directory Conventions

```
starter-repo/
├── .agents/                 # Agent intelligence configuration and local skills
│   ├── skills/              # Reusable agent skills
│   └── mcp_config.json      # Local MCP configuration (gitignored, see .example)
├── docs/                    # Persistent documentation
│   ├── adr/                 # Architecture Decision Records
│   ├── agents/              # Agent operating guides and reference docs
│   └── steps/               # Sequential step execution logs
├── scripts/                 # Automation and developer tooling scripts
├── src/                     # Application source code (created as project evolves)
├── tests/                   # Automated test suites (unit, integration, e2e)
├── .tmp/                    # Local temporary workspace & scratchpads (gitignored)
├── AGENTS.md                # Agent working agreement & full resource catalog
├── BUILD_PROTOCOL.md        # 10-stage development methodology
├── CONTEXT.md               # Authoritative project domain and context
├── DESIGN.md                # Design philosophy and visual rules
└── README.md                # Human entry point and project overview
```

---

## Detailed Directory Guide

### Root Directory (`/`)

The root directory is reserved for core project documentation, version control configuration, and standard ecosystem manifests.

**Permitted at root:**
- Core operating documents: `AGENTS.md`, `BUILD_PROTOCOL.md`, `CONTEXT.md`, `DESIGN.md`, `README.md`.
- Git configuration: `.gitignore`, `.gitattributes`.
- Ecosystem configuration and manifests as needed by your stack (e.g., `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`).

**Prohibited at root:**
- Ad-hoc scripts (e.g., `test.py`, `run.js`).
- One-off scratch notes, logs, or raw data dumps.
- Application logic or loose source components.

---

### `.agents/` — Agent Intelligence

Contains repository-local agent configuration:
- `.agents/skills/<skill-name>/SKILL.md` — Reusable local agent skills.
- `.agents/mcp_config.json.example` — Committed template for local MCP servers.
- `.agents/mcp_config.json` — Gitignored local MCP server credentials and settings.

---

### `docs/` — Repository Documentation

All persistent project documentation lives here:
- `docs/adr/` — Architecture Decision Records following `docs/adr/0000-template.md`.
- `docs/steps/` — Step execution logs following `docs/steps/00-plan-template.md`.
- `docs/agents/` — Reference documents for agents:
  - `skills.md` — Skills reference and usage guidelines.
  - `mcps.md` — MCP server catalog and security guidelines.
  - `domain.md` — Domain knowledge maintenance guide.
  - `issue-tracker.md` — Issue tracking strategy.
  - `file-structure.md` — This file placement and layout reference.

---

### `scripts/` — Automation & Tooling

Shell and PowerShell scripts for bootstrapping, environment validation, and verification:
- `scripts/bootstrap.ps1` — Environment inspection and setup.
- `scripts/check-env.ps1` — Fast environment health check.
- `scripts/verify.ps1` — Verification runner entry point.

---

### `src/` — Application Source Code

Created when implementing a project on top of this starter:
- Subdivide logically by domain, feature, or architectural layer.
- Keep source files cohesive and focused.
- Do not mix tests or temporary mock files directly in source directories unless following an established framework standard (e.g., adjacent `.test.ts` files).

---

### `tests/` — Automated Tests

All test suites that verify application behavior:
- Unit tests, integration tests, and end-to-end tests.
- Fixtures and test helpers belong in `tests/fixtures/` or `tests/helpers/`.

---

### `.tmp/` & Scratchpads — Temporary Work

- Any temporary files, experimental scratch scripts, or scratch notes must go to `.tmp/` (which is gitignored) or the agent brain scratch directory.
- Never commit `.tmp/` files to the repository.

---

## File Placement Decision Table

| What are you adding? | Where does it go? | Example Path |
|---|---|---|
| Architecture decision record | `docs/adr/` | `docs/adr/0001-use-postgres.md` |
| Step execution plan & log | `docs/steps/` | `docs/steps/01-auth-flow.md` |
| Agent reference document | `docs/agents/` | `docs/agents/api-contracts.md` |
| New reusable agent skill | `.agents/skills/<name>/` | `.agents/skills/data-migration/SKILL.md` |
| Verification or tooling script | `scripts/` | `scripts/verify.ps1` |
| Application source code | `src/` (or stack equivalent) | `src/auth/service.ts` |
| Automated test file | `tests/` (or adjacent per stack) | `tests/auth/service.test.ts` |
| Temporary experiment or scratchpad | `.tmp/` or agent brain scratch | `.tmp/scratch-query.sql` |
| Tooling/ecosystem manifest | Root `/` | `package.json`, `pyproject.toml` |
