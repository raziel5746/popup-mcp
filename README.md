# Popup MCP Extension

A VS Code extension that implements the Model Context Protocol (MCP) to enable AI assistants to display interactive popups and notifications directly within VS Code instances.

## Project Overview

This extension provides:
- **MCP Server Integration**: Embedded server that handles popup requests via HTTP and stdio transports
- **Interactive Popups**: Display messages, confirmations, and multi-choice options in VS Code tabs
- **Multi-Instance Coordination**: Route requests to specific VS Code instances by workspace path
- **Zero Configuration**: Works out-of-the-box with automatic transport setup
- **Extensible Architecture**: Clean separation between server logic and UI components

## Development Environment Setup

### Prerequisites & System Requirements

Before starting development, ensure your system meets these requirements:

#### Required Tools & Versions

| Category | Tool | Version | Purpose | Installation |
|----------|------|---------|---------|-------------|
| **Core Runtime** | Node.js | 20.x LTS | JavaScript runtime & package manager | [Download from nodejs.org](https://nodejs.org/) |
| **IDE** | VS Code | 1.70+ | Development environment & target platform | [Download from code.visualstudio.com](https://code.visualstudio.com/) |
| **Language** | TypeScript | 5.3.x | Core development language | `npm install -g typescript@5.3` |
| **Extension CLI** | vsce | Latest | VS Code extension packaging | `npm install -g vsce` |
| **Build Tool** | esbuild | 0.20.x | Fast bundling for extension | Installed via npm dependencies |
| **Testing** | Jest | 29.x | Unit & integration testing | Installed via npm dependencies |
| **E2E Testing** | Playwright | 1.41.x | End-to-end testing | Installed via npm dependencies |
| **VS Code Testing** | @vscode/test-electron | Latest | Extension testing framework | Installed via npm dependencies |

#### Operating System Support
- **Windows**: Windows 10/11 (tested)
- **macOS**: macOS 10.15+ 
- **Linux**: Ubuntu 18.04+, other major distributions

### Step-by-Step Installation Guide

#### 1. Install Node.js 20.x LTS
```bash
# Verify installation
node --version  # Should output v20.x.x
npm --version   # Should output 10.x.x or higher
```

#### 2. Install VS Code 1.70+
```bash
# Verify installation
code --version  # Should output 1.70.x or higher
```

#### 3. Install Global Development Tools
```bash
# Install TypeScript compiler globally
npm install -g typescript@5.3

# Install VS Code Extension CLI
npm install -g vsce

# Verify installations
tsc --version   # Should output Version 5.3.x
vsce --version  # Should output latest version
```

#### 4. Clone and Setup Project
```bash
# Clone the repository
git clone <repository-url>
cd popup-mcp

# Install project dependencies
npm install

# Verify TypeScript compilation
npm run compile

# Run initial build
npm run build
```

#### 5. Development Workflow Setup
```bash
# Install recommended VS Code extensions (optional but helpful)
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension ms-vscode.extension-test-runner

# Run tests to verify setup
npm test

# Start development mode (watch for changes)
npm run watch
```

### Environment Configuration

#### VS Code Settings
Create or update `.vscode/settings.json` (will be created in Story 1.3):
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

#### Environment Variables
No environment variables required for basic development. Optional configurations:
- `VSCODE_TEST_DATA_DIR`: Custom test data directory
- `NODE_ENV`: Set to 'development' for additional logging

### Verification Steps

#### System Verification Checklist
Run these commands to verify your development environment:

```bash
# 1. Check Node.js version (must be 20.x LTS)
node --version

# 2. Check npm version
npm --version

# 3. Check VS Code version (must be 1.70+)
code --version

# 4. Check TypeScript version (must be 5.3.x)
tsc --version

# 5. Check vsce installation
vsce --version

# 6. Verify project dependencies install correctly
npm install --dry-run

# 7. Run basic compilation test
npx tsc --noEmit

# 8. Run project structure validation
node tests/integration/project-structure.test.js
```

#### VS Code Extension Development Test
1. Open the project in VS Code: `code .`
2. Press `F5` to launch Extension Development Host
3. Verify no errors in Debug Console
4. Check that extension activates (will be implemented in Story 1.3)

### Development Scripts

Once package.json is created (Story 1.3), these scripts will be available:

```bash
# Development
npm run watch          # Compile TypeScript in watch mode
npm run compile        # Compile TypeScript once
npm run build          # Build extension for testing

# Testing
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests
npm run test:e2e      # Run end-to-end tests

# Packaging
npm run package       # Create .vsix file for distribution
npm run deploy        # Deploy to marketplace (with proper credentials)

# Linting & Formatting
npm run lint          # Check code style
npm run lint:fix      # Fix linting issues automatically
```

### Troubleshooting Common Setup Issues

#### Node.js Version Issues
```bash
# If you have wrong Node.js version, use nvm (Node Version Manager)
# Install nvm first, then:
nvm install 20
nvm use 20
```

#### VS Code Version Issues
- Ensure VS Code is updated to 1.70+
- Check: Help → About in VS Code
- Update via: Help → Check for Updates

#### TypeScript Compilation Issues
```bash
# Clear TypeScript cache
npx tsc --build --clean

# Reinstall TypeScript
npm uninstall -g typescript
npm install -g typescript@5.3
```

#### Extension Testing Issues
```bash
# Clear VS Code extension host cache
# Close VS Code, delete:
# Windows: %APPDATA%\Code\CachedExtensions
# macOS: ~/Library/Application Support/Code/CachedExtensions
# Linux: ~/.config/Code/CachedExtensions
```

### IDE Configuration Recommendations

#### Recommended VS Code Extensions
- **TypeScript and JavaScript Language Features** (built-in)
- **Extension Test Runner** - For running tests
- **GitLens** - Enhanced Git integration
- **Prettier** - Code formatting
- **ESLint** - Code linting

#### Workspace Settings
The project will include optimized workspace settings for:
- TypeScript IntelliSense
- Debugging configuration
- Test runner integration
- Build task definitions

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
