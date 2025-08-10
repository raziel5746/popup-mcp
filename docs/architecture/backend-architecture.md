# Backend Architecture

## Service Architecture
Based on Node.js, services are organized as modular handlers within the extension, emphasizing embedded execution.

### Traditional Server (Embedded)
**Controller/Route Organization**
```
src/
├── backend/
│   ├── mcpServer.ts         # Main server init, transport setup, JSON-RPC handling
│   ├── requestHandler.ts    # Parses/validates incoming requests
│   ├── responseHandler.ts   # Formats/sends responses
│   ├── coordination.ts      # Server/client election and routing
│   └── middleware/          # Validation, error handling
│       └── validator.ts
└── extension.ts             # Activates server
```

**Controller Template**
```typescript
// mcpServer.ts
import * as net from 'net';
import { JSONRPCRequest } from 'json-rpc-2.0'; // Or custom parser

export class McpServer {
  constructor() {
    // Setup HTTP or stdio listener
    this.setupTransports();
  }

  private setupTransports() {
    // HTTP example
    const server = net.createServer((socket) => {
      // Handle connections
    });
  }

  async handleRequest(rawReq: string): Promise<string> {
    try {
      const req = JSON.parse(rawReq) as JSONRPCRequest;
      // Validate with middleware
      if (!validateRequest(req)) throw new Error('Invalid request');
      const response = { jsonrpc: '2.0', result: { selectedValue: 'example' }, id: req.id };
      return JSON.stringify(response);
    } catch (err) {
      return JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: err.message }, id: null });
    }
  }
}

// Example middleware
function validateRequest(req: JSONRPCRequest): boolean {
  return req.jsonrpc === '2.0' && req.method === 'triggerPopup'; // etc.
}
```

## Database Architecture
N/A - See Database Schema section; no backend DB, uses VS Code storage for consistency.

## Authentication and Authorization
N/A - No auth required per PRD; local extension. For validation, use middleware to check request integrity.

### Auth Flow
N/A

### Middleware/Guards
```typescript
// validator.ts (example guard)
export function requestGuard(req: any): boolean {
  // Check Origin for HTTP, format for stdio
  return true; // Or throw
}
```
