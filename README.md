# Popup MCP Extension

A VS Code extension that implements the Model Context Protocol (MCP) to enable AI assistants to display interactive popups and notifications directly within VS Code instances.

## Project Overview

This extension provides:
- **MCP Server Integration**: Embedded server that handles popup requests via HTTP and stdio transports
- **Interactive Popups**: Display messages, confirmations, and multi-choice options in VS Code tabs
- **Multi-Instance Coordination**: Route requests to specific VS Code instances by workspace path
- **Zero Configuration**: Works out-of-the-box with automatic transport setup
- **Extensible Architecture**: Clean separation between server logic and UI components

## Setup Instructions

### Prerequisites

- **Node.js**: 20.x LTS
- **VS Code**: Version 1.70 or higher
- **TypeScript**: 5.3.x (installed via npm)
- **vsce**: Latest (VS Code Extension CLI)

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd popup-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Package the extension** (optional):
   ```bash
   npm run package
   ```

### Required Tools & Versions

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x LTS | Runtime environment |
| TypeScript | 5.3.x | Core development language |
| VS Code | 1.70+ | Target platform |
| esbuild | 0.20.x | Fast bundling |
| Jest | 29.x | Testing framework |
| Playwright | 1.41.x | E2E testing |
| vsce | Latest | Extension packaging |

### Project Structure

```
popup-mcp/
├── src/                    # Source code
│   ├── backend/           # MCP server logic
│   ├── components/        # UI components
│   ├── views/            # Webview assets
│   ├── utils/            # Shared utilities
│   ├── types/            # TypeScript definitions
│   └── extension.ts      # Main entry point
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   └── e2e/              # End-to-end tests
├── assets/               # Static files
└── docs/                 # Documentation
```

## Integration with Extension Skeleton

This repository setup integrates seamlessly with the extension skeleton creation process (Story 1.3):

- **Source Structure**: The `src/` directory is pre-configured for extension components and MCP server logic
- **Testing Framework**: Jest and Playwright are set up for comprehensive testing
- **Build Pipeline**: esbuild configuration ready for TypeScript compilation
- **VS Code Integration**: Package.json structure prepared for extension metadata

## Development Workflow

1. Make changes to source code in `src/`
2. Run tests: `npm test`
3. Build extension: `npm run build`
4. Test in VS Code: Press F5 to launch Extension Development Host
5. Package for distribution: `npm run package`

## Verification

To verify your setup is working correctly:

1. **Check VS Code version**: Help → About (should be 1.70+)
2. **Verify Node.js**: `node --version` (should be 20.x)
3. **Test extension loading**: Follow development workflow above

---

*This project follows the MCP (Model Context Protocol) specification for AI assistant integration.*
