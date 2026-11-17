# ASC Fruits Design System

Adapted from the Afrah ERP design system. ASC Fruits ships a **light theme only**, and the warm gold/brown accent is replaced by a **fresh produce green**. Layout, type scale and component shapes follow the Afrah system. The PRD's "Simplicity First" principle adds larger touch targets and visual (emoji/photo) selection.

Tokens live in `src/index.css` as Tailwind v4 `@theme` variables, so every token is usable as a utility (`bg-primary`, `text-muted`, `border-border`, ...).

## 1) Core visual theme

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#F6F8F5` | App background (soft leaf-tinted off-white) |
| `--color-surface` | `#FFFFFF` | Cards, panels, tables, modals |
| `--color-surface-low` | `#EEF3EE` | Table headers, subtle wells, hover rows |
| `--color-border` | `#DCE5DC` | All 1px strokes |
| `--color-ink` | `#16211A` | Primary text |
| `--color-muted` | `#5B6B60` | Secondary text, labels |
| `--color-primary` | `#2E7D4F` | Primary accent (replaces gold `#E2C399`) |
| `--color-primary-hover` | `#256B42` | Hover/pressed primary |
| `--color-primary-soft` | `#E3F1E8` | Selected states, tinted headers, chips |
| `--color-primary-ink` | `#1C5233` | Text on `primary-soft` |
| `--color-warning` | `#D97706` | Shortages, pending |
| `--color-warning-soft` | `#FEF3C7` | Warning chip background |
| `--color-danger` | `#DC2626` | Destructive actions, negative stock |
| `--color-danger-soft` | `#FEE2E2` | Danger chip background |

Primary button gradient: `linear-gradient(135deg, #3A9A62, #2E7D4F)`.

Focus ring: `0 0 0 3px rgba(46,125,79,0.22)` with a `primary` border.

## 2) Typography

- `Plus Jakarta Sans` for general UI
- `Cinzel` for the brand wordmark ("ASC Fruits") only
- `JetBrains Mono` for kg quantities, rates and money values

### Type scale

- `--fs-3xl`: 32px (big totals, headline metrics)
- `--fs-2xl`: 26px (page titles, metric numbers)
- `--fs-xl`: 22px
- `--fs-lg`: 20px (section headings)
- `--fs-md`: 18px
- `--fs-base`: 16px (standard emphasis, touch inputs on mobile)
- `--fs-sm`: 14px (body, inputs, table body)
- `--fs-xs`: 13px (labels, nav captions)
- `--fs-2xs`: 12px (metadata, badges)
- `--fs-3xs`: 11px (micro labels, uppercase table headers)

## 3) Spacing and layout

- Sidebar width: `250px` (collapsed `68px`), shown from the `md` breakpoint
- Mobile: bottom tab bar (`64px`) instead of the sidebar
- Topbar height: `56px`
- Main content padding: `20px 24px 48px` (`16px` horizontal on mobile)
- Section padding: `20px`
- Table cell padding: `12px`
- Input height: `44px` (up from Afrah's `38px` for touch use)
- Button height: `44px` (primary), `36px` (compact/table actions)
- Form gaps: `10px` to `14px`
- Detail page gaps: `20px` to `28px`

## 4) Component patterns

### Buttons
- Primary: green gradient, white text, `10px` radius, subtle shadow, hover lifts `-1px`
- Secondary: white surface, `border` stroke, ink text, hover tints `surface-low`
- Danger: `danger` text on white, `danger-soft` on hover
- Minimum touch target `44px x 44px`

### Visual picker cards (fruit, variety, vendor)
- `surface` card, `12px` radius, `border` stroke
- Large emoji (`40px`) or photo thumbnail, name below at `14px` semibold
- Selected: `primary` 2px border plus `primary-soft` fill

### Tables (TanStack Table)
- Container: `surface`, `1px border`, `12px` radius
- Header row: `primary-soft` background, `primary-ink` uppercase `11px` labels
- Body rows: `12px` vertical padding, hover `surface-low`
- Numeric columns are right aligned and use `JetBrains Mono`

### Forms
- Inputs: `44px` height, `7px` radius, `14px` text, `border` stroke
- Focus: `primary` border plus green glow ring

### Modals
- Panel radius `14px`, padding `18px 22px` header and `20px 22px` body
- Backdrop `rgba(22,33,26,0.35)` with a light blur; panel shadow `0 20px 50px rgba(22,33,26,0.18)`

### Status chips
- Pending: `warning-soft` / `warning`
- Fulfilled: `primary-soft` / `primary-ink`
- Cancelled: `surface-low` / `muted`

## 5) Summary

- Light, high-contrast, green-accented; designed for daylight warehouse floors and office desks
- Mobile-first: bottom nav, `44px` targets, emoji/photo-driven selection, minimal typing
- Dense desktop tables remain available through TanStack Table with sorting and search
