# Design Philosophy

This document defines the design principles, visual tokens, and constraints for Downtown.

It is not a pixel-level specification. It establishes intent, tokens, and non-negotiable visual constraints.

---

## Principles

**Modern.** Use current, capable patterns. Clean layout, high contrast, legible typography.

**Minimal.** Every element earns its place. Default to less. High information density without clutter.

**Calm.** Interfaces should not demand attention. They should serve the user effortlessly.

**Precise.** Spacing, alignment, and proportion are intentional. Stick strictly to the 4px spacing scale.

**Content-first.** The interface frames listings, photos, and seller credibility. The chrome stays quiet.

**Mobile-First.** Designed and tested primarily for entry-level Android mobile viewports (360px–390px width) before desktop expansion.

---

## Visual Language

Downtown adopts a disciplined, high-clarity shadcn/ui aesthetic:

- Neutral, calm surfaces (white/zinc light mode, high contrast).
- Restrained, semantic use of color.
- Visible, authentic trust signals (verification badges, clear rating stars).
- Touch-friendly sizing: minimum 44×44px interactive tap targets.
- Lightweight DOM: no heavy animations or layout shifts that lag low-end mobile devices.

---

## Design Tokens

### 1. Color Palette

Downtown uses a clean neutral foundation paired with purposeful semantic accents:

| Token | Value / HSL | Usage |
|---|---|---|
| `background` | `#FFFFFF` (`0 0% 100%`) | Primary page background |
| `foreground` | `#09090B` (`240 10% 3.9%`) | Primary text and headings |
| `muted` | `#F4F4F5` (`240 4.8% 95.9%`) | Secondary card backgrounds, pill tags |
| `muted-foreground` | `#71717A` (`240 3.8% 46.1%`) | Secondary labels, metadata, dates |
| `border` | `#E4E4E7` (`240 5.9% 90%`) | Clean 1px card and divider borders |
| `primary` | `#18181B` (`240 5.9% 10%`) | Main action buttons, heavy emphasis |
| `primary-foreground` | `#FAFAFA` (`0 0% 98%`) | Text on primary buttons |
| `accent` | `#15803D` (`142 72% 29%`) | Verification badge, successful deals, WhatsApp CTA |
| `accent-foreground` | `#FFFFFF` (`0 0% 100%`) | Text on verified badges |
| `destructive` | `#EF4444` (`0 84.2% 60.2%`) | Errors, cancellation, dispute alerts |
| `warning` | `#F59E0B` (`38 92% 50%`) | Pending verification, 24h reservation timer |

### 2. Typography

- **Font Family**: Inter or Geist Sans (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Scale**:
  - `text-xs`: 12px (line-height: 16px) — Badges, timestamps, subtle captions.
  - `text-sm`: 14px (line-height: 20px) — Body text, filter pills, secondary labels.
  - `text-base`: 16px (line-height: 24px) — Listing titles, input fields, default copy.
  - `text-lg`: 18px (line-height: 28px) — Card prices, section subheadings.
  - `text-xl`: 20px (line-height: 28px) — Detail page titles, modal headings.
  - `text-2xl`: 24px (line-height: 32px) — Page titles.

### 3. Spacing Scale

Base unit is **4px**:
- `space-1` = 4px
- `space-2` = 8px
- `space-3` = 12px
- `space-4` = 16px (standard container padding on mobile)
- `space-6` = 24px (section gap)
- `space-8` = 32px (major layout divider)

### 4. Radii & Elevation

- `radius-sm`: 4px — Badges, small tags.
- `radius-md`: 6px — Buttons, inputs, dropdown items.
- `radius-lg`: 8px — Cards, modals, bottom sheets.
- **Shadows**: Restrained to `shadow-sm` on floating overlays/modals only. Card grids default to `border border-border` without drop shadows.

---

## Strict Prohibitions ("What to Avoid")

The following patterns add visual noise, degrade low-end Android performance, and are **forbidden**:

- **No decorative gradients**: Do not use multi-color gradient buttons, gradient backgrounds, or text gradients.
- **No glassmorphism / frosted glass**: `backdrop-filter: blur(...)` causes severe rendering stutter on entry-level Android GPUs. Use solid `#FFFFFF` with standard borders.
- **No decorative blur orbs or floating background shapes**: Keep surfaces solid and flat.
- **No excessive card nesting**: Avoid cards inside cards inside cards.
- **No pill containers for content**: Keep borders restrained to subtle rectangles with `radius-md` or `radius-lg`.
- **No unprompted scroll/entrance animations**: Avoid bouncy entrance transitions and scroll-driven parallax.
- **No hardcoded colors, spacing or one-off page styles**: All styling goes through design tokens and shared components; no hardcoded colors, spacing or one-off styles in pages. A design pass will restyle later.

---

## Components

- **Source Primitives**: Always prefer `shadcn/ui` components built on Radix UI or Base UI primitives.
- **Listing Cards**: Compact, 1:1 or 4:3 aspect ratio photo container with lazy loading, clear price in bold, title clamped to 2 lines, verified seller checkmark badge, and location tag.
- **Mobile Navigation**: Sticky bottom navigation bar on mobile web (`Search/Explore`, `Saved`, `Sell`, `Profile`) with clear touch states.
- **Contact Action**: Prominent "Contact Seller via WhatsApp" CTA with distinct safety prompt.

---

## Verification

Visual changes must be verified in a real browser before a step is considered complete.
See `.agents/skills/browser-verification/SKILL.md` for standard procedures.
