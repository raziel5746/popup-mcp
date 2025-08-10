# Accessibility Requirements

**Compliance Target:** WCAG AA standard, with aspirations toward AAA where feasible (e.g., enhanced contrast).

**Key Requirements:**

**Visual:**
- Color contrast ratios: Minimum 4.5:1 for text, 3:1 for large text and UI components; test with tools like WAVE.
- Focus indicators: Clear, visible outlines (e.g., blue glow) on interactive elements like buttons and inputs.
- Text sizing: Support VS Code's font size settings; ensure resizable text up to 200% without loss of functionality.

**Interaction:**
- Keyboard navigation: Full tab-order support for all elements (e.g., buttons, text input, chime toggle); no keyboard traps.
- Screen reader support: ARIA labels/roles for popups (e.g., role="dialog"), status bar items, and dynamic content; test with NVDA/VoiceOver.
- Touch targets: Minimum 44x44px for buttons/icons, accommodating mouse/touch inputs.

**Content:**
- Alternative text: Descriptive alt text for icons (e.g., "Chime muted") and images (e.g., screenshot references).
- Heading structure: Logical hierarchy in popups (H1 for title, H2 for sections).
- Form labels: Associated labels for text inputs; error messages announced via ARIA-live.

**Testing Strategy:** Automated checks with VS Code accessibility tools and Lighthouse; manual testing with screen readers across OSes; include beta user feedback from diverse groups (e.g., color-blind testers).
