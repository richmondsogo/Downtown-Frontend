# AGENTS.md

This file is the working agreement for any agent operating in this repository.

Read it before touching anything.

---

## Order of Precedence

When instructions conflict, resolve them in this order:

1. **User instructions** in the active prompt (highest priority).
2. **`AGENTS.md` & `BUILD_PROTOCOL.md`** (Repository operating agreements).
3. **`CONTEXT.md` & `DESIGN.md`** (Domain constraints and design rules).
4. **Project-local skills** (`.agents/skills/`).
5. **Environment skills & general defaults** (lowest priority).

---

## Methodology & Git Workflow

The standard 10-stage development loop is defined in [`BUILD_PROTOCOL.md`](./BUILD_PROTOCOL.md):

```
Understand → Plan → Branch → Approve → Implement → Verify → Review diff → Record → PR & Review → Merge & Checkpoint
```

### Primary Branch Protection & Step Isolation

1. **Never commit directly to the primary branch**: Explicitly prefer `main`. If `main` exists, target `main`; otherwise, fall back to `master`.
2. **Every step operates on an isolated branch**: Create and switch to a dedicated branch named `step/NN-<slug>` (e.g., `step/01-auth-flow`).
3. **Standard merge commits (`--no-ff`)**: Steps merge to the primary branch exclusively via Pull Request using standard merge commits (`git merge --no-ff`) to preserve full granular commit history.
4. **Record full provenance**: Every step log in `docs/steps/` must record the PR URL, first commit SHA, last commit SHA, and merge commit SHA.

---

## File Structure & Directory Rules

Do not create random files or drop scripts into arbitrary locations. Adhere to the directory conventions defined in [`docs/agents/file-structure.md`](./docs/agents/file-structure.md):

- **Root (`/`)**: Reserved for core project documentation and standard manifests (`package.json`, `pyproject.toml`, etc.). No loose scripts or test dumps.
- **`src/`**: Application source code organized by feature or domain.
- **`tests/`**: Automated unit, integration, and end-to-end tests.
- **`docs/`**: All persistent documentation (`adr/`, `steps/`, `agents/`).
- **`scripts/`**: Automation, environment checks, and verification scripts.
- **`.agents/`**: Local agent configuration (`skills/`, `mcp_config.json`).
- **`.tmp/`**: Gitignored temporary workspace. Use `.tmp/` or the agent scratchpad for experiments; never pollute source trees.

---

## Before you implement anything

1. **Read the relevant documentation:**
   - [`CONTEXT.md`](./CONTEXT.md) — project domain, constraints, non-goals.
   - [`DESIGN.md`](./DESIGN.md) — design principles and visual rules.
   - [`docs/steps/`](./docs/steps/) — prior step logs.
   - [`docs/adr/`](./docs/adr/) — architecture decisions.
   - [`docs/agents/file-structure.md`](./docs/agents/file-structure.md) — directory conventions.

2. **Inspect the existing repository** before making assumptions about structure, patterns, or dependencies.

3. **Investigate uncertainty before implementing.** If the right answer is unclear, look it up or ask. Do not guess and proceed.

4. **Ensure primary branch is clean**, cut a dedicated step branch `step/NN-<slug>`, and write a numbered implementation plan in `docs/steps/NN-<slug>.md` using [`docs/steps/00-plan-template.md`](./docs/steps/00-plan-template.md).

5. **Wait for approval** before modifying files when operating under the Build Protocol.

---

## During implementation

- Work exclusively on the dedicated `step/NN-<slug>` branch.
- Work on one scoped task at a time. Do not silently expand scope.
- Prefer existing project patterns over inventing new ones.
- Prefer existing dependencies and components before introducing new ones.
- Do not introduce infrastructure there is no demonstrated need for.
- Follow directory placement rules in [`docs/agents/file-structure.md`](./docs/agents/file-structure.md).
- Do not modify files unrelated to the current task.
- Never expose, log, or commit secrets, credentials, or API keys.
- Preserve the project design system. See [`DESIGN.md`](./DESIGN.md).
- Use available skills and MCPs when they materially improve the task.

---

## After implementation

Actual verification is required. Saying something works is not evidence it works.

1. Run relevant tests and checks via [`scripts/verify.ps1`](./scripts/verify.ps1).
2. Run `git status` — confirm only expected files changed and no stray files exist.
3. Run `git diff` — inspect every line of the diff.
4. Start the application and verify it runs, when relevant.
5. Open a browser and verify visible changes, when relevant (use `browser-verification` skill).
6. Update the step document in [`docs/steps/`](./docs/steps/) with discoveries, decisions, and verification proof.
7. Open a Pull Request targeting the primary branch (`main`, fallback `master`), run diff review with `code-review` skill, and land via standard merge commit (`--no-ff`).
8. Record PR URL, first commit SHA, last commit SHA, and merge commit SHA in the step document.

---

## Comprehensive Repository Resources Directory

### 1. Core Operating Documents

| Document | Purpose |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Agent working agreement, rules, and resource index |
| [`BUILD_PROTOCOL.md`](./BUILD_PROTOCOL.md) | 10-stage development methodology & branching/PR strategy |
| [`CONTEXT.md`](./CONTEXT.md) | Authoritative source of project domain, users, constraints, and non-goals |
| [`DESIGN.md`](./DESIGN.md) | Design principles, typography, spacing, color, and visual rules |
| [`README.md`](./README.md) | Project overview, human orientation, and bootstrap guide |

### 2. Architecture & Step History

| Location | Purpose |
|---|---|
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records directory |
| [`docs/adr/0000-template.md`](./docs/adr/0000-template.md) | Template for recording architectural decisions |
| [`docs/steps/`](./docs/steps/) | Sequential step execution logs |
| [`docs/steps/00-plan-template.md`](./docs/steps/00-plan-template.md) | Template for step planning, verification, and commit provenance |

### 3. Agent Governance & Reference Guides

| Document | Purpose |
|---|---|
| [`docs/agents/file-structure.md`](./docs/agents/file-structure.md) | Functional directory layout and file placement decision table |
| [`docs/agents/skills.md`](./docs/agents/skills.md) | Skills reference, categorization, and combination guide |
| [`docs/agents/mcps.md`](./docs/agents/mcps.md) | Available MCP servers, setup instructions, and security practices |
| [`docs/agents/domain.md`](./docs/agents/domain.md) | Guidance on maintaining authoritative domain knowledge in `CONTEXT.md` |
| [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md) | Issue tracking strategies and integration with step documents |

### 4. Project-Local Skills Catalog (`.agents/skills/`)

Every skill in `.agents/skills/` is available locally and travels with the repository:

| Skill | Path | When to Use |
|---|---|---|
| `ask-matt` | [`.agents/skills/ask-matt/SKILL.md`](./.agents/skills/ask-matt/SKILL.md) | Skill router. When unsure which workflow skill fits, start here. |
| `to-spec` | [`.agents/skills/to-spec/SKILL.md`](./.agents/skills/to-spec/SKILL.md) | Crystallize a conversation or feature idea into an actionable spec. |
| `triage` | [`.agents/skills/triage/SKILL.md`](./.agents/skills/triage/SKILL.md) | Move issues through triage roles and write agent-ready briefs. |
| `implement` | [`.agents/skills/implement/SKILL.md`](./.agents/skills/implement/SKILL.md) | Implement work based on a spec or ticket. Drives TDD and code review. |
| `tdd` | [`.agents/skills/tdd/SKILL.md`](./.agents/skills/tdd/SKILL.md) | Test-driven development (red → green → refactor loop). |
| `code-review` | [`.agents/skills/code-review/SKILL.md`](./.agents/skills/code-review/SKILL.md) | Two-axis review (Standards + Spec) of diff between HEAD and target branch. |
| `diagnosing-bugs` | [`.agents/skills/diagnosing-bugs/SKILL.md`](./.agents/skills/diagnosing-bugs/SKILL.md) | Structured diagnosis loop for hard bugs and performance regressions. |
| `prototype` | [`.agents/skills/prototype/SKILL.md`](./.agents/skills/prototype/SKILL.md) | Build throwaway prototype code to resolve design or logic questions. |
| `frontend-design` | [`.agents/skills/frontend-design/SKILL.md`](./.agents/skills/frontend-design/SKILL.md) | Distinctive visual styling; typography, palette, and layout polish. |
| `design-system` | [`.agents/skills/design-system/SKILL.md`](./.agents/skills/design-system/SKILL.md) | Keep UI components aligned with project design tokens and primitives. |
| `browser-verification` | [`.agents/skills/browser-verification/SKILL.md`](./.agents/skills/browser-verification/SKILL.md) | Real browser verification of visual and interactive changes. |
| `project-bootstrap` | [`.agents/skills/project-bootstrap/SKILL.md`](./.agents/skills/project-bootstrap/SKILL.md) | Structured process for initializing a new project from this starter. |

### 5. Automation & Tooling Scripts

| Script | Purpose |
|---|---|
| [`scripts/bootstrap.ps1`](./scripts/bootstrap.ps1) | Inspects newly cloned environment and reports toolchain setup status |
| [`scripts/check-env.ps1`](./scripts/check-env.ps1) | Fast environment health check (Node, Python, Git state) |
| [`scripts/verify.ps1`](./scripts/verify.ps1) | Central verification runner for repository state, secrets, and tests |

### 6. Configuration Templates

| Template | Purpose |
|---|---|
| [`.agents/mcp_config.json.example`](./.agents/mcp_config.json.example) | Example template for configuring local MCP servers without leaking secrets |
