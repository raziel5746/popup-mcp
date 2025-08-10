# Tech Stack

## Technology Stack Table
| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3.x | Core language for UI logic and type safety | Strongly typed JS extension for VS Code APIs; chosen over plain JS for maintainability and error prevention in extension development. |
| Frontend Framework | VS Code Extension API (with Webviews) | 1.85.x (matches VS Code 1.85+) | Building popups, status bar, settings | Native to VS Code; no external framework needed (e.g., React avoided for lightweight MVP), balancing simplicity with UI needs. |
| UI Component Library | N/A (Custom HTML/CSS/TS) | N/A | Custom popup rendering in tabs | Per front-end spec, minimal custom styling; avoids heavy libs like Material-UI for performance in extension context. |
| State Management | VS Code Workspace State API | 1.85.x | Managing configs like chime mute | Built-in for persistence; simple alternative to Redux, sufficient for extension's limited state needs. |
| Backend Language | TypeScript (via Node.js) | 5.3.x | Server logic for MCP handling | Consistent with frontend; enables shared types, chosen for type safety in routing/protocol code. |
| Backend Framework | Node.js | 20.x LTS | MCP server and coordination | Core runtime for VS Code extensions; serverless-like in extension context, preferred over alternatives like Deno for ecosystem maturity. |
| API Style | MCP Protocol (HTTP/Stdio) | Custom (per PRD) | AI communication | Custom protocol as defined; not REST/GraphQL due to stdio support, chosen for flexibility and zero-config. |
| Database | N/A (Local Storage if needed) | N/A | No persistent data required | Per PRD, no DB; avoids overhead of SQLite/etc., with VS Code storage APIs as fallback for configs. |
| Cache | N/A | N/A | No caching needs | Extension doesn't require; simplifies architecture. |
| File Storage | VS Code File System API | 1.85.x | Asset handling (e.g., chime WAV) | Native; no need for cloud storage like S3. |
| Authentication | N/A | N/A | No auth required | Per PRD, extension is local; no user auth needed. |
| Frontend Testing | Jest + @vscode/test-electron | 29.x / Latest | Unit/integration for UI components | Standard for VS Code extensions; electron runner for realistic testing, chosen over Vitest for compatibility. |
| Backend Testing | Jest | 29.x | Unit tests for MCP logic | Consistent tooling; sufficient for Node.js parts. |
| E2E Testing | Playwright | 1.41.x | End-to-end extension flows | Cross-platform; integrates well with VS Code for simulating instances, preferred over Cypress for headless capabilities. |
| Build Tool | esbuild | 0.20.x | Bundling extension | Fast and lightweight; chosen over webpack for speed in extension packaging. |
| Bundler | vsce (VS Code Extension CLI) | Latest | Packaging for marketplace | Official tool; bundles TS to JS for deployment. |
| IaC Tool | N/A | N/A | No infrastructure | Local extension; no cloud IaC needed. |
| CI/CD | GitHub Actions | Latest | Automated testing/build | Free for open-source; aligns with potential repo hosting, over Jenkins for simplicity. |
| Monitoring | VS Code Output Channel | 1.85.x | Logging extension events | Built-in; no external like Sentry needed for MVP. |
| Logging | console.log + Output Channel | N/A | Debug logging | Simple and native; sufficient for extension. |
| CSS Framework | Custom CSS (with VS Code theme integration) | N/A | Popup styling | Per spec, minimal custom; avoids Tailwind for lightweight bundle. |
