# Unified Project Structure
```
popup-mcp/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml             # Test/lint on PR
│       └── deploy.yaml         # Package for marketplace
├── src/                        # Core source code
│   ├── backend/                # MCP server logic
│   │   ├── mcpServer.ts
│   │   ├── requestHandler.ts
│   │   ├── responseHandler.ts
│   │   ├── coordination.ts
│   │   └── middleware/
│   │       └── validator.ts
│   ├── components/             # Frontend UI classes
│   │   ├── PopupWebview.ts
│   │   ├── StatusBar.ts
│   │   └── ConfigCommand.ts
│   ├── views/                  # Webview assets
│   │   └── popup.html
│   ├── utils/                  # Shared utilities
│   │   └── chimePlayer.ts     # Chime sound handler
│   ├── types/                  # Shared data models
│   │   └── index.ts           # PopupRequest, etc.
│   └── extension.ts            # Main activation
├── tests/                      # Unit/integration/E2E
│   ├── unit/                   # Jest tests
│   └── e2e/                    # Playwright scripts
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
├── tsconfig.json               # TypeScript config
├── esbuild.config.js           # Build script
└── README.md                   # Project overview
```
