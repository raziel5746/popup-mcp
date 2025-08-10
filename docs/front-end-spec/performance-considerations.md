# Performance Considerations

### Performance Goals
- **Page Load:** N/A (extension-based); aim for <100ms activation time.
- **Interaction Response:** <50ms for popup display and response routing.
- **Animation FPS:** Maintain 60 FPS for all animations, even on lower-end hardware.

### Design Strategies
- Use lightweight CSS animations over JS-heavy libraries to minimize overhead.
- Limit DOM elements in popups and use VS Code's built-in icons exclusively.
- Lazy-load non-essential assets; respect VS Code's performance APIs for monitoring.
- Test on various hardware to ensure smooth multi-instance routing without lag.
