# Error Handling Strategy

## Error Flow
```mermaid
sequenceDiagram
    participant AI as AI Assistant
    participant MCP as MCP Server
    participant Router as Instance Router
    participant Popup as Popup Renderer

    AI->>MCP: Invalid Request
    MCP->>MCP: Validate (fails)
    MCP->>AI: JSON-RPC Error (e.g., code -32600)

    alt Routing Failure
        MCP->>Router: Route Request
        Router->>MCP: No Match
        MCP->>AI: JSON-RPC Error (custom code, e.g., -32001 "Routing Failed")
    end

    alt Popup Error (e.g., render fail)
        Router->>Popup: Render
        Popup->>MCP: Throw Error
        MCP->>AI: JSON-RPC Error
    end
    note over MCP: Log all errors to VS Code Output
```

## Error Response Format
```typescript
interface ApiError {
  jsonrpc: '2.0';
  error: {
    code: number;        // JSON-RPC or custom (e.g., -32600 Invalid Request)
    message: string;
    data?: any;          // Optional details
  };
  id: string | null;
}
```

## Frontend Error Handling
```typescript
// PopupWebview.ts example
try {
  // Render logic
} catch (err) {
  vscode.window.showErrorMessage(`Popup error: ${err.message}`);
  appEvents.emit('error', { code: -32000, message: err.message });
}
```

## Backend Error Handling
```typescript
// mcpServer.ts example
async handleRequest(rawReq: string): Promise<string> {
  try {
    // Processing
  } catch (err) {
    console.error(`Server error: ${err}`);  // Log to output channel
    return JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error', data: err.stack },
      id: null
    });
  }
}
```
