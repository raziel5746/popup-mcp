# Security and Performance

## Security Requirements
**Frontend Security:**
- CSP Headers: Strict Content-Security-Policy in webviews (e.g., script-src 'self') to prevent XSS.
- XSS Prevention: Sanitize all user inputs in popups; use VS Code APIs for safe rendering.
- Secure Storage: Store configs in VS Code Memento (encrypted if sensitive); no direct process.env access.

**Backend Security:**
- Input Validation: Middleware to parse/validate JSON-RPC (e.g., schema checks on requests).
- Rate Limiting: Basic in-memory limit on requests to prevent abuse (e.g., 10/sec per instance).
- CORS Policy: For HTTP, restrict to localhost origins; validate Origin header.

**Authentication Security:**
- Token Storage: N/A - No tokens; local only.
- Session Management: Use server-generated requestId for short-lived sessions; no persistent auth.
- Password Policy: N/A.

## Performance Optimization
**Frontend Performance:**
- Bundle Size Target: <500KB (minified .vsix) via esbuild optimization.
- Loading Strategy: Lazy-load webview content; async chime playback.
- Caching Strategy: Cache static assets (e.g., chime.wav) in extension bundle.

**Backend Performance:**
- Response Time Target: <50ms for routing/handling (per NFR1).
- Database Optimization: N/A - Local storage; use efficient VS Code APIs.
- Caching Strategy: In-memory cache for workspace registrations to speed up routing.
