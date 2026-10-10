# Step 00: Bootstrap Monorepo & Project Foundations

**Step Branch**: `step/00-bootstrap`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/1  

---

## Objective

Establish the core foundations of the Downtown project: domain context, design tokens, Turborepo + pnpm monorepo configuration, orientation documentation, adapted verification scripts, and architectural baseline (ADR 0001: Web-First Launch).

---

## Scope

### Included
- Commit `GOAL.md` requirements specification into repository history.
- Fill `CONTEXT.md` from `GOAL.md` (domain vocabulary, listing lifecycle, category taxonomy, actors, constraints, non-goals).
- Update `DESIGN.md` with Downtown design tokens (neutral shadcn style, mobile-first, strict prohibitions against gradients and frosted glass).
- Add monorepo configuration manifests: `pnpm-workspace.yaml`, root `package.json`, and `turbo.json`.
- Replace starter `README.md` with Downtown project orientation and local setup instructions.
- Adapt `scripts/check-env.ps1` and `scripts/verify.ps1` for Node.js, pnpm, and Turborepo.
- Author `docs/adr/0001-web-first-launch.md` (web-first MVP launch, mobile deferred post-Nov 30).

### Excluded
- No `apps/` or `packages/` directory creation (strictly deferred to Step 01).
- No frontend UI implementation or database schemas.

---

## Plan

1. Ensure `GOAL.md` is committed and tracked on the `step/00-bootstrap` branch.
2. Populate `CONTEXT.md` with complete domain knowledge from `GOAL.md`.
3. Update `DESIGN.md` with neutral shadcn tokens, typography, spacing, and low-end Android mobile constraints.
4. Record `docs/adr/0001-web-first-launch.md` using the ADR template.
5. Create monorepo configuration files (`pnpm-workspace.yaml`, root `package.json`, `turbo.json`).
6. Replace `README.md` with Downtown orientation and developer instructions.
7. Adapt `scripts/check-env.ps1` and `scripts/verify.ps1` to validate Node, pnpm, and Turborepo.
8. Execute `pnpm install` and run `scripts/verify.ps1`.
9. Review `git diff --stat` and capture verification results.

---

## Implementation

- Created root `pnpm-workspace.yaml` specifying `apps/*` and `packages/*`.
- Configured root `package.json` with Turborepo (`^2.11.7`) as a dev dependency, engine constraints (`node >= 20.0.0`, `pnpm >= 9.0.0`), and standard workspace scripts (`build`, `dev`, `lint`, `check-types`, `test`, `clean`).
- Created `turbo.json` with standard tasks (`build`, `lint`, `check-types`, `test`, `dev`, `clean`).
- Wrote `docs/adr/0001-web-first-launch.md` detailing rationale for web-first launch targeting November 30, 2026 and deferring Expo native mobile apps to post-launch.
- Updated `scripts/check-env.ps1` to enforce Node.js >= 20, pnpm >= 9, Git, and presence of monorepo manifests.
- Updated `scripts/verify.ps1` to test Git state, absence of tracked secrets, validity of JSON manifests (`package.json`, `turbo.json`), presence of `pnpm-workspace.yaml`, and Turborepo CLI execution (`pnpm exec turbo --version`).

---

## Discoveries

- Local toolchain has Node.js `v25.8.1` and pnpm `12.4.1`.
- `turbo` is not installed globally on the host machine, so invoking via `pnpm exec turbo` ensures reliable cross-environment operation without global dependency requirements.

---

## Verification

- **`pnpm install`**: Succeeded. Installed `turbo@2.11.7` (`@turbo/windows-64`), generating `pnpm-lock.yaml`. Exit code 0.
- **`scripts/check-env.ps1`**: Succeeded. Validated Git (`2.52.0.windows.1`), Node.js (`v25.8.1`), pnpm (`12.4.1`), and presence of `package.json`, `pnpm-workspace.yaml`, and `turbo.json`. Status: OK.
- **`scripts/verify.ps1`**: Succeeded (8/8 checks passed, 0 failed, 0 skipped).
  - Git available: OK
  - No obviously tracked secrets: OK
  - `package.json` exists and is valid: OK
  - `pnpm-workspace.yaml` exists: OK
  - `turbo.json` exists and is valid: OK
  - Node.js >= 20: OK
  - pnpm installed: OK
  - Turborepo operational (`pnpm exec turbo --version`): OK
- **`git status`**: Clean scope. Only bootstrap foundation files modified or created (`CONTEXT.md`, `DESIGN.md`, `README.md`, `scripts/check-env.ps1`, `scripts/verify.ps1`, `docs/adr/0001-web-first-launch.md`, `docs/steps/00-bootstrap.md`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`).
- **`git diff`**: Reviewed and confirmed no unintended files or changes. Neither `apps/` nor `packages/` created in this step.

---

## Diff / Checkpoint

- Pull Request URL: https://github.com/richmondsogo/Downtown-Frontend/pull/1
- First commit SHA: a6ff8b977ace620a4c55a68033a34d112d563f6a
- Last commit SHA:
- Merge commit SHA:
- Merge strategy: Standard merge commit (`--no-ff`)

---

## Unresolved Issues

None. Monorepo workspace configuration is prepared for Step 01 (`apps/` and `packages/` initialization).

---

## Decisions

- **ADR 0001**: Web-First Launch, Mobile Deferred (Expo after Nov 30).
