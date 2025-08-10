# Animation & Micro-interactions

**Motion Principles:** Keep animations subtle and purposeful to enhance feedback without overwhelming the user; use easing for natural feel (e.g., ease-in-out); respect reduced motion preferences via media queries; prioritize performance with short durations (<300ms) to maintain low latency.

**Key Animations:**
- **Popup Appearance:** Fade-in with scale from center (Duration: 200ms, Easing: ease-out); includes persistent pulsating blueish glow while modal is open for AI-ish effect.
- **Button Hover/Press:** Subtle scale-up and color shift (Duration: 150ms, Easing: ease-in-out).
- **Text Area Toggle:** Slide-down expansion (Duration: 300ms, Easing: cubic-bezier for smooth reveal).
- **Status Update:** Gentle pulse on change (e.g., color shift for warnings) (Duration: 200ms, Easing: ease-in).
