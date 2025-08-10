# Source Tree

This represents the full project source structure, reflecting the monorepo approach, embedded Node.js service architecture, component organization, and best practices. Adapted for TypeScript/Node.js conventions (e.g., async/await in handlers, strict typing, clear FE/BE separation).

```
popup-mcp/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml             # Test/lint on PR
│       └── deploy.yaml         # Package for marketplace
├── src/                        # Core source code
│   ├── backend/                # MCP server logic (embedded service)
│   │   ├── mcpServer.ts        # Main server init and transport (HTTP/stdio)
│   │   ├── requestHandler.ts   # JSON-RPC parsing and validation (async)
│   │   ├── responseHandler.ts  # Response formatting and sending
│   │   ├── coordination.ts     # Server/client election and routing logic
│   │   └── middleware/         # Guards and validators
│   │       └── validator.ts    # Input schema checks
│   ├── components/             # Frontend UI classes
│   │   ├── PopupWebview.ts     # Popup rendering
│   │   ├── StatusBar.ts        # Status indicator
│   │   └── ConfigCommand.ts    # JSON generator command
│   ├── views/                  # Webview assets
│   │   └── popup.html          # Template for popup tab
│   ├── utils/                  # Shared utilities
│   │   └── chimePlayer.ts      # Chime sound handler
│   ├── types/                  # Shared data models/interfaces
│   │   └── index.ts            # e.g., PopupRequest, used across FE/BE
│   └── extension.ts            # Main activation tying FE/BE
├── tests/                      # Unit/integration/E2E
│   ├── unit/                   # Jest tests (FE/BE units)
│   └── e2e/                    # Playwright scripts (full flows)
├── assets/                     # Static files
│   └── chime.wav               # Notification sound
├── docs/                       # Documentation
│   ├── prd.md
│   ├── front-end-spec.md
│   └── architecture.md
├── .vscode/                    # Editor settings
│   └── settings.json
├── .env.example                # Environment template (if needed)
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript config (strict typing)
├── esbuild.config.js           # Build script
└── README.md                   # Project overview
```

Notes:
- **Conventions**: Use async/await for all I/O; explicit types everywhere; kebab-case files, PascalCase classes.
- **Separation**: Clear FE/BE divide under src/ for testability; shared types/utils enable consistency.
