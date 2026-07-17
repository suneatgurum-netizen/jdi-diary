---
name: Analog Digital
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#424842'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#737972'
  outline-variant: '#c2c8c0'
  surface-tint: '#4a654e'
  primary: '#4a654e'
  on-primary: '#ffffff'
  primary-container: '#8ba88e'
  on-primary-container: '#233d29'
  inverse-primary: '#b0ceb2'
  secondary: '#556159'
  on-secondary: '#ffffff'
  secondary-container: '#d6e3d8'
  on-secondary-container: '#59665d'
  tertiary: '#8e4e14'
  on-tertiary: '#ffffff'
  tertiary-container: '#dd8f50'
  on-tertiary-container: '#592c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cceace'
  primary-fixed-dim: '#b0ceb2'
  on-primary-fixed: '#07200f'
  on-primary-fixed-variant: '#334d38'
  secondary-fixed: '#d9e6db'
  secondary-fixed-dim: '#bdcabf'
  on-secondary-fixed: '#131e17'
  on-secondary-fixed-variant: '#3e4a42'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb780'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#6f3800'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  grid-unit: 8px
  margin-page: 24px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

This design system is built on the philosophy of **Digital Tactility**. It targets individuals seeking a mindful, organized, and distraction-free journaling experience. The goal is to evoke the calmness of a high-quality physical paper planner while leveraging the efficiency of mobile software.

The visual style is a blend of **Minimalism** and **Tactile/Skeuomorphic** design. It prioritizes clarity and whitespace but introduces subtle depth through "paper-stack" layers and a faint graph-paper texture to provide a structural guide for the user's thoughts. The emotional response should be one of "blank-page" potential—inviting, clean, and non-judgmental.

## Colors

The palette is rooted in a soft, organic "Sage Green" (`primary`) to represent growth and peace. The background isn't a harsh pure white, but a warm, paper-inspired `neutral` (`#FDFDFD`) to reduce eye strain during evening reflection. 

- **Primary:** Used for active states, primary action buttons, and month headers.
- **Secondary:** A washed-out tint of the primary, used for background fills of chips or time-blocks.
- **Tertiary:** A soft "Sunset Orange" used sparingly for high-priority alerts or marking specific "Milestone" achievements.
- **Grays:** Subtle, low-contrast grays are reserved strictly for the graph-paper grid lines and secondary metadata.

## Typography

The typography system balances the precision of modern sans-serifs with the utility of monospaced fonts. **Hanken Grotesk** is used for all primary reading and writing tasks due to its exceptional legibility and friendly, balanced curves.

To reinforce the "planner" aesthetic, **JetBrains Mono** is utilized for timestamps, grid labels, and secondary metadata. This creates a technical contrast against the soft body copy, mimicking the look of a structured architectural diary. Headlines should use tight letter-spacing to feel impactful yet neat.

## Layout & Spacing

The layout is strictly governed by an **8px baseline grid**. This ensures that all text lines up perfectly with the background graph-paper texture, which should have a visible grid line every 24px (3 units).

- **Mobile Layout:** Uses a single-column fluid layout with a fixed 24px side margin.
- **Vertical Rhythm:** Spacing between entry blocks follows a 24px step to maintain the "page-like" feel. 
- **Tabbed Navigation:** Week navigation at the top of the screen should be scrollable horizontally, with the active week centered and underlined with a 2px primary color stroke.

## Elevation & Depth

Elevation in this design system is subtle and "flat-layered." Instead of heavy drop shadows, we use **Tonal Layering** and **Hard 1px Borders**.

- **Level 0 (Base):** The main "paper" surface with the graph texture.
- **Level 1 (Cards/Entries):** Defined by a 1px solid border (`#E2E2E2`) and a white fill. No shadow is used here to keep the interface looking clean.
- **Level 2 (Active Overlays/Modals):** A very soft, high-diffusion shadow (8px blur, 4% opacity, Primary-tinted) is applied to simulate the paper lifting slightly off the surface.
- **The "Stack" Effect:** When navigating through months, use a visible 2px offset border to the right and bottom of the container to suggest multiple pages stacked beneath.

## Shapes

The shape language is **Soft**. It avoids the playfulness of fully rounded "pill" shapes in favor of a more professional, "cut paper" look. 

- **Containers:** Use a consistent 4px (`0.25rem`) corner radius. This is applied to diary entry blocks, images, and modal containers.
- **Buttons:** Primary action buttons use a slightly larger 8px radius to make them more "touchable" while remaining consistent with the overall geometric structure.
- **Icons:** Use linear, 2pt stroke icons with slightly rounded caps to match the typography's weight.

## Components

### Buttons & Navigation
- **Primary Button:** Solid fill of the Primary Sage color with white text. No shadow, just a subtle 1px darken on press.
- **Tabbed Week Nav:** Text-only labels using `label-caps`. The active state is indicated by a Primary Sage underline that aligns with the grid.

### Lists & Timeline
- **Timeline Entries:** A vertical 1px line runs down the left margin. Time markers use `label-mono`. Each entry is housed in a white container with the 1px grid-gray border.
- **Goal Sections:** Large, clear headers with a secondary-colored background "highlighter" effect (a 50% height bar behind the text).

### Inputs
- **Diary Entry Field:** Borderless on the bottom, with text sitting directly on the background graph lines. This creates the illusion of writing directly on the paper.
- **Checkboxes:** Square with a 2px radius. When checked, the box fills with the Primary color and shows a white checkmark.

### Cards
- **Weekly Summary:** Uses the "Stack" effect mentioned in Elevation. A white card with a 1px border, offset by 4px to show a "page" underneath.