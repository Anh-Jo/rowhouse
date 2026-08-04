# Ember — editorial data design system

Ember is the webapp's design system: an editorial language for data stories.
Warm paper surfaces, near-black ink, hairline rules, squared corners, and a
single ember accent that belongs to the data.

Browse it with Storybook:

```bash
pnpm --filter webapp storybook   # http://localhost:6006
```

## Where things live

| What              | Where                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Tokens            | `apps/webapp/src/styles/tokens.css`                                                      |
| Shared CSS voices | `apps/webapp/src/styles/global.css` (`.ds-label`, `.ds-numeric`, `.ds-link`, `.ds-rule`) |
| Components        | `apps/webapp/src/components/<Name>/`                                                     |
| Page shells       | `apps/webapp/src/layouts/`                                                               |
| Stories           | `apps/webapp/src/stories/{foundations,atoms,molecules,organisms,templates}/`             |

Start at **Templates → DataStory**: it is the reference assembly, and every
other story is a piece of it.

## The rules that make it a system

1. **One accent.** Ember (`--color-accent`) marks the data, the live state, and
   at most one action per view. A headline gets one accented fragment, never two.
2. **Rules, not shadows.** Layout separates with 1px hairlines
   (`--border-hairline`). Shadows are reserved for things that float above the
   page — popover, dialog.
3. **Small caps carry the labels.** Every field, section and metric title uses
   `.ds-label` (11px, 600, `0.14em` tracking, uppercase). Body copy stays small;
   hierarchy comes from headlines and figures.
4. **Figures are tabular.** Anything numeric carries `.ds-numeric` so values do
   not jitter when they update, and columns line up without a table.
5. **Numbers are passed raw.** Components format them (`helpers/format.ts`), so
   grouping and locale are decided once, not per call site.
6. **"No data" is a state, not an empty string.** `StatCard` renders it, the
   choropleth has its own `--color-scale-empty`, distinct from a measured zero.
7. **Provenance travels with the figure.** A figure block ends with a
   `SourceNote`; a metric that needs a method note carries an `InfoTip`.

## Token layers

`tokens.css` is written in three layers, in this order:

1. **Primitives** — `--color-ink-*`, `--color-paper*`, `--color-ember-*`,
   `--color-scale-*`, `--color-series-*`. Raw values, no intent.
2. **Semantics** — `--color-text`, `--color-accent`, `--color-rule`,
   `--border-hairline`, the type scale, space, radius, motion. **Use these.**
3. **Legacy aliases** — the names the pre-Ember components were written against
   (`--color-primary`, `--color-border`…). They map onto the layers above so the
   whole library re-skins from one file; do not reach for them in new code.

Two colour families are deliberately different things: `--color-scale-*` is a
_sequential_ ramp for one measured quantity (choropleth, heatmap), while
`--color-series-*` is _categorical_ — up to five compared dimensions.

## Component map

| Layer     | Components                                                                |
| --------- | ------------------------------------------------------------------------- |
| Atoms     | `Eyebrow`, `DisplayTitle`, `Lede`, `SourceNote`, `InfoTip`, `ScaleLegend` |
| Molecules | `StatCard`, `YearStepper`, `UnderlineTabs`, `RankedList`, `PanelSection`  |
| Organisms | `Masthead`, `StatBar`                                                     |
| Templates | `DataStoryLayout`                                                         |

The pre-existing application components (`Button`, `Badge`, `Input`, `Select`,
`DataTable`, `Dialog`, `AdminLayout`…) are token-driven and re-skin with the
system — `Button` gained an `accent` variant for the one ember action of a view.

## Adding to the system

- A new colour, size or duration means **a new token**, not a literal in a
  component's CSS.
- Every component ships a story; interactive ones ship a test
  (`src/components/<Name>/__tests__/`).
- Keep the gate green: `pnpm verify`.
