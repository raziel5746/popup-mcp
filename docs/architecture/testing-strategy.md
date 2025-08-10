# Testing Strategy

## Testing Pyramid
```
                  E2E Tests (Playwright)
                 /                  \
        Integration Tests (Jest + VS Code APIs)
               /                      \
      Frontend Unit (Jest)      Backend Unit (Jest)
```

## Test Organization

### Frontend Tests
```
tests/
├── unit/
│   └── components/
│       ├── PopupWebview.test.ts  # Test rendering and input
│       └── StatusBar.test.ts     # Test updates and toggles
└── integration/
    └── popupFlow.test.ts         # Simulate user interactions
```

### Backend Tests
```
tests/
├── unit/
│   └── backend/
│       ├── mcpServer.test.ts     # Test request handling
│       └── coordination.test.ts  # Test routing/election
└── integration/
    └── transport.test.ts         # Test HTTP/stdio flows
```

### E2E Tests
```
tests/
└── e2e/
    ├── multiInstance.test.ts     # Simulate multiple VS Code instances
    └── fullWorkflow.test.ts      # End-to-end popup trigger/response
```

## Test Examples

### Frontend Component Test
```typescript
// PopupWebview.test.ts
import { PopupWebview } from '../components/PopupWebview';

test('renders popup with title', () => {
  const request = { title: 'Test', message: '', options: [] };
  const webview = new PopupWebview(request);
  expect(webview.panel.title).toBe('Test');
});
```

### Backend API Test
```typescript
// mcpServer.test.ts
import { McpServer } from '../backend/mcpServer';

test('handles valid request', async () => {
  const server = new McpServer();
  const response = await server.handleRequest('{"jsonrpc":"2.0","method":"triggerPopup","id":"1"}');
  expect(JSON.parse(response).id).toBe('1');
});
```

### E2E Test
```typescript
// fullWorkflow.test.ts (Playwright)
import { test } from '@playwright/test';

test('triggers and responds to popup', async ({ page }) => {
  // Simulate VS Code instance and extension
  await page.goto('vscode://file/test');  // Mock
  // Assert popup appears and response sent
});
```
