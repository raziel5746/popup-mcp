# Frontend Architecture

## Component Architecture
Based on VS Code Extension API, components are organized as modular TS classes handling UI elements.

### Component Organization
```
extension/
├── src/
│   ├── components/          # UI logic classes
│   │   ├── PopupWebview.ts  # Popup rendering
│   │   ├── StatusBar.ts     # Status indicator
│   │   └── ConfigCommand.ts # JSON generator command
│   ├── views/               # Webview HTML/CSS/JS
│   │   └── popup.html       # Template for popup tab
│   └── utils/               # Shared helpers (e.g., chime player)
└── package.json             # Extension manifest
```

### Component Template
```typescript
// Example: PopupWebview.ts
import * as vscode from 'vscode';

export class PopupWebview {
  private panel: vscode.WebviewPanel;

  constructor(request: PopupRequest) {
    this.panel = vscode.window.createWebviewPanel(
      'popupMCP',
      request.title,
      vscode.ViewColumn.Active,
      { enableScripts: true }
    );
    this.panel.webview.html = this.getHtmlContent(request);
    this.panel.webview.onDidReceiveMessage((msg) => {
      // Handle response
      this.panel.dispose();
    });
  }

  private getHtmlContent(request: PopupRequest): string {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>${request.title}</h1>
        <p>${request.message}</p>
        <!-- Buttons and text input -->
      </body>
      </html>
    `;
  }
}
```

## State Management Architecture
Uses VS Code's built-in state APIs for lightweight management.

### State Structure
```typescript
// Global state example
interface AppState {
  config: ExtensionConfig;
  currentStatus: StatusState;
}

// Usage in extension.ts
const globalState = context.globalState;
globalState.update('appState', { config: {...}, currentStatus: StatusState.ServerActive });
```

### State Management Patterns
- Use VS Code Memento for persistence across sessions.
- Event listeners for reactive updates (e.g., onDidChangeWorkspaceFolders).
- Avoid heavy stores; simple getters/setters suffice.

## Routing Architecture
No traditional web routing; uses VS Code commands for "navigation" (e.g., opening settings, triggering config copy).

### Route Organization
```
Commands:
- popupmcp.copyMcpJson: Triggers Config Generator
- popupmcp.toggleChime: Status Bar toggle
- popupmcp.openSettings: Opens extension settings
```

### Protected Route Pattern
N/A - No auth; all local. Example command registration:
```typescript
vscode.commands.registerCommand('popupmcp.copyMcpJson', async () => {
  // Logic to select AI/transport and copy JSON
});
```

## Frontend Services Layer
Handles "API" calls to backend (MCP Server) via internal events.

### API Client Setup
```typescript
// Internal event emitter for FE-BE communication
import { EventEmitter } from 'events';

const appEvents = new EventEmitter();

// In Popup Renderer: emit response
appEvents.emit('response', popupResponse);

// In MCP Server: listen and route
appEvents.on('response', (res) => { /* send to AI */ });
```

### Service Example
```typescript
// ResponseService.ts
export class ResponseService {
  static sendResponse(response: PopupResponse) {
    appEvents.emit('response', response);
  }
}
```

