# Responsiveness Strategy

**Breakpoints:** None; the UI is designed for desktop VS Code without traditional responsive breakpoints, focusing on consistent layouts across window sizes.

**Adaptation Patterns:**

**Layout Changes:** Elements are always stacked vertically for simplicity, except for Custom Text, Cancel, and Send buttons which remain aligned in a row regardless of size. No reflowing or stacking changes based on width.

**Navigation Changes:** Status bar items and popup content maintain fixed layouts; no adaptations needed.

**Content Priority:** All elements are displayed fully without hiding; core message, buttons, and inputs are always visible as they are essential.

**Interaction Changes:** Consistent across sizes; no adjustments to chime or other features based on screen detection.

**Alternative User-Configurable Sizing:** Provide a "Size" setting in extension preferences (small, medium, large, extra large; default: medium). This affects modal width, button size, and font size, while height auto-adjusts to content for optimal viewing.
