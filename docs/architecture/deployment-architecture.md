# Deployment Architecture

## Deployment Strategy
**Frontend Deployment:**
- **Platform:** VS Code Extension Marketplace / Local sideload
- **Build Command:** `npm run package` (uses vsce)
- **Output Directory:** Root (produces .vsix file)
- **CDN/Edge:** N/A - Local assets bundled

**Backend Deployment:**
- **Platform:** Embedded in extension (Node.js runtime)
- **Build Command:** `npm run build` (esbuild for TS)
- **Deployment Method:** Package and install .vsix

## CI/CD Pipeline
```yaml