# AI Native OS DESIGN.md

## 1. Visual Theme & Atmosphere

AI Native OS is not a generic SaaS dashboard. It should feel like an operator console for an AI runtime:

- precise, compact, and decision-oriented
- closer to Linear in control-plane discipline
- closer to Cursor in AI workflow semantics
- never playful, glossy, or marketing-heavy
- always optimized for triage, inspection, and review

The product mood is:

- calm
- technical
- high-signal
- audit-friendly
- credible under operational pressure

## 2. Layout Principles

The default application frame is a three-part console:

1. left navigation rail
2. primary work canvas
3. right context rail

The shell should feel stable and persistent. Pages should feel like specialized workstations living inside the same control room.

Preferred layout traits:

- sticky top header
- fixed or semi-fixed left navigation
- persistent right context rail on desktop
- dense, inspectable cards rather than oversized marketing blocks
- generous grouping, but not excessive whitespace

## 3. Color Palette & Roles

### Core Neutrals

- `--background`: very light cool gray
- `--foreground`: near-black graphite
- `--card`: clean white with slight cool tint
- `--muted`: slate-gray neutrals
- `--border`: soft but visible cool-gray borders

### Semantic Accents

- primary accent: restrained indigo-blue for active navigation, focus, and important actions
- success: deep green, never neon
- warning: amber-gold, used sparingly
- danger: muted red, only for incidents and destructive actions
- AI context accent: warm copper-orange for agentic hints and timeline states

### Color Behavior

- do not rely on gradients for structure
- use color to encode state, not decoration
- avoid purple-heavy startup aesthetics
- avoid flat monochrome without semantic contrast

## 4. Typography Rules

Typography should prioritize clarity under density.

- headings: modern sans, compact, crisp, slightly tight tracking
- body: neutral sans with excellent legibility at 13px to 16px
- metadata: smaller, muted, uppercase labels used sparingly
- monospace: only for IDs, request keys, prompt variables, and runtime artifacts

Hierarchy:

- page titles are strong but not oversized
- section labels are compact uppercase kickers
- table content should remain readable at dense sizes
- captions and metadata should support scanning, not dominate

## 5. Component Styling

### Navigation

- left navigation should use grouped sections
- active items should feel precise and intentional, not pillowy
- nested items should be rare and only used when the hierarchy is real

### Cards

- cards should feel like operator panels
- use subtle elevation and strong border rhythm
- cards must support dense content without looking cramped

### Tables

- tables are first-class
- sticky headers preferred for operational views
- row hover states should be subtle
- status chips and metadata blocks should improve scan speed

### Buttons

- primary buttons should be confident but restrained
- secondary buttons should feel tool-like
- destructive actions require clear contrast and confirmation

### Inputs

- focus rings must be crisp and visible
- search and filter controls should look like console tools, not marketing forms

### Right Context Rail

- the right rail is not a decorative help sidebar
- it must present current object context, suggested actions, and Copilot interaction
- it should feel like a live operator assistant surface

## 6. Workbench Patterns

AI Native OS should repeatedly use these page patterns:

- queue + detail inspector
- table + side inspector
- signal strip + action board
- release pipeline
- audit timeline
- evidence bundle
- compare diff

These patterns are more important than flashy hero sections.

## 7. Density & Spacing

Spacing should be compact but breathable.

- prefer structured density over oversized empty space
- keep cards and panels visually separated through borders and subtle elevation
- avoid extreme compression that harms readability

Use a spacing rhythm that feels like:

- 4, 8, 12, 16, 20, 24, 32

Large whitespace should be reserved for major transitions, not ordinary list views.

## 8. Responsive Behavior

Desktop is the primary mode.

On mobile and tablet:

- collapse the right context rail into a sheet or stacked section
- compress navigation into chips or drawer navigation
- preserve approval, audit, and triage actions
- never hide critical status indicators behind multiple taps

## 9. Do

- build interfaces that look operational and trustworthy
- prefer real status structure over decorative graphics
- make AI-specific objects first-class
- use timelines, inspectors, and evidence summaries
- keep admin surfaces visually aligned with governance surfaces

## 10. Do Not

- do not build generic “cards on a white page” startup UI
- do not make Copilot just a chat bubble with little context
- do not overuse gradients, glow, or purple accents
- do not treat AI governance pages like CRUD forms
- do not let the visual system drift between admin and AI pages

## 11. Prompt Guide For Future UI Work

When generating or editing UI in this repository:

- treat the product as an AI operations control plane
- prioritize shell cohesion before page ornament
- maintain a stable left-nav / center-canvas / right-rail structure
- favor Linear-like precision and Cursor-like AI workflow cues
- make new pages feel operator-grade, not demo-grade

