# Phase plans

This folder holds the plans for multi-session work (see "Planning Multi-Session
Work" in the root `CLAUDE.md`). Replace this skeleton with your feature set's
master plan; keep one self-contained file per phase.

## How it works

- **One phase = one plan file = one branch = one session.** A phase plan is
  written to be executed without re-planning: scope, data model, endpoints,
  tests, and a manual validation scenario.
- **Transverse decisions are recorded once** (section below) and never reopened
  by a later phase. If a decision must change, update it here first, in its own
  commit, before any phase relies on the new version.
- **Every phase ends with the gate green** (`pnpm verify`) plus the phase's
  manual validation scenario on a running app.

## Skeleton

```markdown
# <Project> — Master plan

<One paragraph: what is being built, on which stack.>

**V1 scope**: <features in>. **Out of scope**: <features explicitly out>.

## Phase index

| Phase | Plan                    | Branch          | Delivers        |
| ----- | ----------------------- | --------------- | --------------- |
| 0     | [phase-0-x.md](...)     | `feat/x`        | <deliverable>   |

## Transverse decisions (do not reopen)

1. <Stack/architecture choice + one-line rationale.>
2. <Data-model invariant.>
3. <API style, error contract, pagination convention…>

## Data model

<The models and their invariants, shared by all phases.>

## Gate

Run from the repo root, all green before asking for user validation:
`pnpm verify`
```

And each `phase-N-<slug>.md`:

```markdown
# Phase N — <name>

**Branch**: `feat/<slug>` · **Depends on**: phase N-1

## Goal

<What exists at the end of this phase that did not before.>

## Scope

<Modules/screens/endpoints touched. Explicit non-goals.>

## Steps

<Ordered, concrete steps — migrations, modules, tests, wiring.>

## Manual validation

<A scenario a human runs on the live app to accept the phase.>
```
