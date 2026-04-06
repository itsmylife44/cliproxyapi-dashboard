# ElevenLabs Design System Migration

## Objective
Migrate the CLIProxyAPI Dashboard from its current dark glassmorphic design to the ElevenLabs Design System — a near-white, warm-toned, typography-led aesthetic with multi-layer sub-0.1 opacity shadows, pill buttons, and Inter/Geist Mono typography.

## Source Reference
https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/elevenlabs/DESIGN.md

## Key Design Principles
- **Near-white canvas** with warm undertones (`#f5f5f5`, `#f5f2ef`)
- **Light typography**: Display headings feel light and ethereal; body text uses Inter with positive letter-spacing (0.14–0.18px)
- **Multi-layer shadow stacks** at sub-0.1 opacity — surfaces barely exist
- **Pill buttons** (9999px radius) with black primary and warm stone variants
- **Warm shadow tints**: `rgba(78, 50, 23, 0.04)` — shadows have color
- **Generous whitespace** — Apple-like spacing, unhurried rhythm

## Color Palette
- **Primary BG**: `#ffffff` (cards, surfaces) / `#f5f5f5` (page bg, sections)
- **Warm Stone**: `#f5f2ef`, `rgba(245, 242, 239, 0.8)` (featured elements)
- **Text Primary**: `#000000`
- **Text Secondary**: `#4e4e4e`
- **Text Muted**: `#777169`
- **Border**: `#e5e5e5` or `rgba(0, 0, 0, 0.05)`
- **Focus Ring**: `rgb(147 197 253 / 0.5)`

## Shadow System
- **Inset Border**: `rgba(0,0,0,0.075) 0px 0px 0px 0.5px inset`
- **Outline Ring**: `rgba(0,0,0,0.06) 0px 0px 0px 1px`
- **Soft Elevation**: `rgba(0,0,0,0.04) 0px 4px 4px`
- **Card Shadow**: outline + 2-layer elevation
- **Warm Shadow**: `rgba(78,50,23,0.04) 0px 6px 16px`
- **Edge Shadow**: `rgba(0,0,0,0.08) 0px 0px 0px 0.5px`

## Phases

### Phase 1: Foundation (globals.css + layout.tsx)
**Files:** `dashboard/src/app/globals.css`, `dashboard/src/app/layout.tsx`

#### globals.css changes:
- Replace body background from dark radial gradient to `#f5f5f5`
- Replace body color from `#e5e7eb` to `#000000`
- Add `letter-spacing: 0.16px` to body
- Replace ALL CSS variables:
  - `--surface-base`: `#ffffff`
  - `--surface-muted`: `#f5f5f5`
  - `--surface-warm`: `rgba(245, 242, 239, 0.8)`
  - `--surface-hover`: `#f0f0f0`
  - `--surface-border`: `#e5e5e5`
  - `--surface-border-subtle`: `rgba(0, 0, 0, 0.05)`
  - `--surface-border-strong`: `rgba(0, 0, 0, 0.1)`
  - `--text-primary`: `#000000`
  - `--text-secondary`: `#4e4e4e`
  - `--text-muted`: `#777169`
  - `--accent`: `#000000`
  - `--accent-strong`: `#1a1a1a`
  - Shadow variables: `--shadow-inset`, `--shadow-outline`, `--shadow-soft`, `--shadow-card`, `--shadow-elevated`, `--shadow-warm`, `--shadow-edge`
- Update scrollbar: transparent track, `rgba(0,0,0,0.1)` thumb
- Update selection: `rgba(0,0,0,0.08)` bg, black text
- Update focus-visible: `rgb(147 197 253 / 0.5)` outline
- Update `.glass-card`: white bg, no border, `var(--shadow-card)`, no backdrop-filter
- Update `.glass-input`: white bg, shadow-as-border via inset+outline, light focus ring
- Update `.glass-button-primary`: black bg, white text, edge shadow
- Update `.glass-button-secondary`: white bg, black text, elevated shadow
- Update `.glass-button-ghost`: transparent bg, secondary text, outline shadow
- Update `.glass-nav`: white bg, right border `#e5e5e5`, no backdrop-filter
- Update `.glass-nav-item-active`: muted bg, border, inset shadow
- Update `.avatar-glow`: warm shadow on hover instead of blue
- Update date inputs `color-scheme` to `light`

#### layout.tsx changes:
- Change `colorScheme: "dark"` to `colorScheme: "light"`
- Change `theme-color` from `#080b11` to `#f5f5f5`
- Keep GeistSans/GeistMono font variables (Inter via CSS fallback in body)

### Phase 2: UI Primitives
**Files in `dashboard/src/components/ui/`:**

#### button.tsx
- Change border-radius from `rounded-md` to `rounded-full` (9999px pill)
- Primary: `glass-button-primary text-white` (no blue shadow)
- Secondary: `glass-button-secondary text-black`
- Danger: `bg-red-500 text-white border-none rounded-full hover:bg-red-600`
- Ghost: `glass-button-ghost text-[#4e4e4e] hover:text-black`

#### card.tsx
- Card: `glass-card rounded-2xl p-4` (shadow via CSS class, remove inline shadow)
- CardHeader: border-b `border-[#e5e5e5]`
- CardTitle: `text-sm font-medium tracking-wide text-black`

#### input.tsx
- Replace `glass-input text-white` with `glass-input text-black`
- Focus: remove blue border/ring (handled by CSS class)
- Placeholder: `placeholder:text-[#777169]`

#### modal.tsx
- Overlay: `bg-black/30` instead of `bg-black/60`
- Card: `bg-white border-none rounded-2xl shadow-[...]` with warm shadow
- Close button: `text-[#777169] hover:text-black hover:bg-[#f5f5f5]`
- ModalHeader border: `border-[#e5e5e5]`
- ModalTitle: `text-lg font-medium text-black`
- ModalFooter border: `border-[#e5e5e5]`

#### toast.tsx
- Success: white bg, green left-accent, green text, card shadow
- Error: white bg, red left-accent, card shadow
- Info: white bg, blue left-accent, card shadow
- Container: remove backdrop-blur
- Text: black/secondary colors
- Dismiss button: `text-[#777169] hover:text-black hover:bg-[#f5f5f5]`

#### tooltip.tsx
- Background: `bg-white` with card shadow
- Text: `text-[#4e4e4e]`
- Border: none (shadow-as-border)
- Arrow: white colored

#### skeleton.tsx
- Skeleton bg: `bg-[#e5e5e5]`
- SkeletonCard: `border-[#e5e5e5] bg-white`

#### confirm-dialog.tsx
- Overlay: `bg-black/30`
- Card: `bg-white border-none rounded-2xl`
- Title: `text-black`
- Message: `text-[#4e4e4e]`
- Icon circles: lighter opacity backgrounds

#### breadcrumbs.tsx
- Text: `text-[#777169]` base, active `text-black`
- Chevron: `text-[#e5e5e5]`
- Hover: `hover:text-black`

### Phase 3: Navigation Components
**Files:**

#### dashboard-nav.tsx
- Logo area: `text-black` heading, `text-[#777169]` subtitle
- Section labels: `text-[#777169]`
- Nav items: `text-[#4e4e4e]` default, `text-black` active/hover
- Active item: `glass-nav-item-active text-black`
- Collapse button: white bg, `border-[#e5e5e5]`, `text-[#4e4e4e]`
- Mobile overlay: `bg-black/20`

#### mobile-top-bar.tsx
- Container: white bg via `glass-nav`, `border-[#e5e5e5]`
- Hamburger icon: `text-black`
- Logo text: `text-black`

#### dashboard-header.tsx
- Background: `bg-white border-[#e5e5e5]` with card shadow
- Status text: black/secondary for running, red for offline, amber for checking
- Uptime/latency separators: `bg-[#e5e5e5]`
- User name: `text-black`
- Admin badge: `text-[#4e4e4e]`
- Avatar: white bg, `border-[#e5e5e5]`, hover warm shadow

### Phase 4: Shell Components

#### user-panel.tsx
- Panel bg: `bg-white` with `border-[#e5e5e5]`
- Overlay: `bg-black/20`
- Avatar: white bg, `border-[#e5e5e5]`
- Text: black primary, `#4e4e4e` secondary, `#777169` muted
- Admin badge: `bg-[#f5f5f5] text-[#4e4e4e] border-[#e5e5e5]`
- Session box: `bg-[#f5f5f5] border-[#e5e5e5]`
- Dividers: `border-[#e5e5e5]`
- Form labels: `text-[#777169]`
- Error alert: red-tinted white card
- Success: green-tinted white card

#### dashboard-client-layout.tsx
- No visual changes needed (structural only)

### Phase 5: Utility Components

#### copy-block.tsx
- Pre: `bg-[#f5f5f5] border border-[#e5e5e5] text-black`
- Copy button: `bg-white border-[#e5e5e5] text-[#4e4e4e]`

#### chart-theme.tsx
- Update CHART_COLORS text values to black/secondary/muted
- Grid: `rgba(0, 0, 0, 0.06)`
- Border: `rgba(0, 0, 0, 0.1)`
- Surface: `#ffffff`
- TOOLTIP_STYLE: white bg, black text
- ChartContainer: white bg, `border-[#e5e5e5]`
- ChartEmpty: white bg, muted text

### Phase 6: Auth Pages

#### login/page.tsx
- Remove purple icon, use black icon bg or just logo
- Heading: `text-black`
- Subtitle: `text-[#4e4e4e]`
- Card: `glass-card rounded-2xl`
- Labels: `text-[#777169]`
- Error: `bg-red-50 border-red-200 text-red-600`
- Footer text: `text-[#777169]`
- Loading skeleton: `bg-[#e5e5e5]`

#### setup/page.tsx
- Same pattern as login
- Warning banner: `bg-amber-50 border-amber-200 text-amber-700`

### Phase 7: Remaining Components (class-level updates across 91 files)
All remaining components use Tailwind classes directly. The following patterns must be replaced project-wide:

| Old Pattern | New Pattern |
|---|---|
| `text-slate-100`, `text-slate-200` | `text-black` |
| `text-slate-300` | `text-[#4e4e4e]` |
| `text-slate-400`, `text-slate-500` | `text-[#777169]` |
| `text-white` (on dark surfaces) | `text-black` |
| `text-white/70`, `text-white/80` | `text-[#4e4e4e]` |
| `bg-slate-800/*`, `bg-slate-900/*` | `bg-white` or `bg-[#f5f5f5]` |
| `border-slate-700/*`, `border-slate-600/*` | `border-[#e5e5e5]` |
| `bg-blue-500/20 text-blue-300 border-blue-500/30` | `bg-[#f5f5f5] text-[#4e4e4e] border-[#e5e5e5]` |
| `bg-emerald-500` | Keep for status indicators |
| `bg-red-500/20 text-red-300` | `bg-red-50 text-red-600 border-red-200` |
| `bg-amber-500/15 text-amber-200 border-amber-400/25` | `bg-amber-50 text-amber-700 border-amber-200` |
| `bg-green-500/30 text-white` | `bg-green-50 text-green-700 border-green-200` |
| `hover:bg-slate-700/*` | `hover:bg-[#f5f5f5]` |
| `shadow-2xl`, `shadow-xl` (dark) | CSS variable shadows |
| `backdrop-blur-*` (on cards) | Remove |
| `bg-black/60` (overlays) | `bg-black/20` or `bg-black/30` |

## Execution Notes
- Font: Keep Geist Sans/Mono. Add Inter via CSS `font-family` fallback. The ElevenLabs system uses Inter as primary body, Waldenburg for display — we use Geist Sans as a close equivalent for the clean, modern feel.
- Do NOT add Waldenburg/WaldenburgFH fonts — use Geist Sans weight 300 for display headings as an equivalent.
- Maintain all existing component APIs, props, and behavior.
- Keep all accessibility features (focus traps, aria labels, reduced motion).
- Keep the `cn()` utility pattern.
- The dashboard is functional software, not a marketing page. Adapt the ElevenLabs aesthetic while keeping it usable for data-dense admin UIs.

## Verification
After all changes: `npm run typecheck && npm run build` in `dashboard/`.
