/**
 * Integration tests for response handling and routing functionality
 * Tests all acceptance criteria for Story 1.5
 */

import * as vscode from 'vscode';
import { PopupWebview } from '../../src/components/PopupWebview';
import { ResponseHandler } from '../../src/backend/responseHandler';
import { RequestHandler } from '../../src/backend/requestHandler';
import { McpServer } from '../../src/backend/mcpServer';
import { PopupRequest, PopupResponse, JSONRPCRequest, TransportConfig } from '../../src/types';

// Enhanced VS Code mocks for this test file
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createWebviewPanel: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue?: any) => defaultValue)
    })),
    onDidChangeConfiguration: jest.fn(),
    workspaceFolders: []
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((...paths: any[]) => ({ fsPath: paths.join('/'), path: paths.join('/') }))
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  ExtensionMode: {
    Test: 3,
    Development: 2,
    Production: 1
  },
  ExtensionContext: jest.fn()
}), { virtual: true });

describe('Response Flow Integration Tests', () => {
  let extensionContext: vscode.ExtensionContext;
  let popupWebview: PopupWebview;
  let responseHandler: ResponseHandler;
  let requestHandler: RequestHandler;
  let mcpServer: McpServer;

  beforeEach(async () => {
    // Mock extension context
    extensionContext = {
      extensionUri: vscode.Uri.file(__dirname),
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn()
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        setKeysForSync: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      environmentVariableCollection: {
        persistent: true,
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        get: jest.fn(),
        forEach: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn()
      },
      extensionPath: __dirname,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storageUri: vscode.Uri.file(__dirname),
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      asAbsolutePath: jest.fn((path: string) => path)
    } as any;

    // Initialize components
    popupWebview = new PopupWebview(extensionContext.extensionUri, extensionContext);
    responseHandler = new ResponseHandler();
    requestHandler = new RequestHandler();
    
    // Mock MCP server configuration
    const transportConfig: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: false, port: 0, host: 'localhost' }
    };
    mcpServer = new McpServer(transportConfig);
  });

  afterEach(async () => {
    // Clean up with null checks
    if (popupWebview) {
      popupWebview.dispose();
    }
    if (responseHandler) {
      responseHandler.dispose();
    }
    if (requestHandler) {
      requestHandler.dispose();
    }
    if (mcpServer) {
      try {
        await mcpServer.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('AC1: Captures button selection and sends response via MCP', () => {
    it('should capture button click and route response back via stdio transport', async () => {
      const testRequest: PopupRequest = {
        requestId: 'test-001',
        workspacePath: '/test/workspace',
        title: 'Test Response Capture',
        message: 'Please select an option',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      };

      // Mock webview panel
      const mockWebview = { 
        html: '', 
        onDidReceiveMessage: jest.fn(), 
        postMessage: jest.fn() 
      };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };
      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Set up response handling
      let capturedResponse: PopupResponse | undefined;
      
      // Register pending response
      const responsePromise = responseHandler.registerPendingResponse(
        testRequest.requestId,
        'json-rpc-123',
        'stdio'
      );

      // Render popup
      await popupWebview.renderPopup(testRequest, async (response) => {
        capturedResponse = response;
        // Route response back via MCP
        await responseHandler.handlePopupResponse(response);
      });

      // Simulate user clicking "Yes" button
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'yes' });

      // Wait for response to be processed
      const mcpResponse = await responsePromise;
      const parsedResponse = JSON.parse(mcpResponse);

      // Verify response was captured correctly
      expect(capturedResponse).toEqual({
        requestId: 'test-001',
        selectedValue: 'yes'
      });

      // Verify MCP response format
      expect(parsedResponse).toEqual({
        jsonrpc: '2.0',
        result: { selectedValue: 'yes' },
        id: 'json-rpc-123'
      });
    });

    it('should capture text input and send response via MCP', async () => {
      const testRequest: PopupRequest = {
        requestId: 'test-002',
        workspacePath: '/test/workspace',
        title: 'Test Text Input',
        message: 'Please enter your response',
        options: [{ label: 'Submit', value: 'submit' }]
      };

      // Mock webview panel
      const mockWebview = { 
        html: '', 
        onDidReceiveMessage: jest.fn(), 
        postMessage: jest.fn() 
      };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };
      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Set up response handling
      let capturedResponse: PopupResponse | undefined;
      
      // Register pending response
      const responsePromise = responseHandler.registerPendingResponse(
        testRequest.requestId,
        'json-rpc-456',
        'stdio'
      );

      // Render popup
      await popupWebview.renderPopup(testRequest, async (response) => {
        capturedResponse = response;
        await responseHandler.handlePopupResponse(response);
      });

      // Simulate user entering custom text
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'custom user input' });

      // Wait for response to be processed
      const mcpResponse = await responsePromise;
      const parsedResponse = JSON.parse(mcpResponse);

      // Verify response was captured correctly
      expect(capturedResponse).toEqual({
        requestId: 'test-002',
        selectedValue: 'custom user input'
      });

      // Verify MCP response format
      expect(parsedResponse).toEqual({
        jsonrpc: '2.0',
        result: { selectedValue: 'custom user input' },
        id: 'json-rpc-456'
      });
    });
  });

  describe('AC2: Closes popup tab after response submission', () => {
    it('should dispose webview panel after response is sent', async () => {
      const testRequest: PopupRequest = {
        requestId: 'test-003',
        workspacePath: '/test/workspace',
        title: 'Test Popup Closure',
        message: 'This popup should close after response',
        options: [{ label: 'Close', value: 'close' }]
      };

      // Mock webview panel with dispose tracking
      const mockDispose = jest.fn();
      const mockWebview = { 
        html: '', 
        onDidReceiveMessage: jest.fn(), 
        postMessage: jest.fn() 
      };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: mockDispose
      };
      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Render popup
      await popupWebview.renderPopup(testRequest, async (response) => {
        await responseHandler.handlePopupResponse(response);
      });

      // Simulate user response
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'close' });

      // Verify webview was disposed
      expect(mockDispose).toHaveBeenCalled();
      expect(popupWebview.isActive()).toBe(false);
    });
  });

  describe('AC3: Handles errors gracefully with user notifications', () => {
    it('should show error notification for invalid webview messages', async () => {
      const testRequest: PopupRequest = {
        requestId: 'test-004',
        workspacePath: '/test/workspace',
        title: 'Test Error Handling',
        message: 'Testing error scenarios',
        options: [{ label: 'OK', value: 'ok' }]
      };

      // Mock error notification
      const mockShowErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');
      mockShowErrorMessage.mockResolvedValue(undefined);

      // Mock webview panel
      const mockWebview = { 
        html: '', 
        onDidReceiveMessage: jest.fn(), 
        postMessage: jest.fn() 
      };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };
      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Render popup
      await popupWebview.renderPopup(testRequest, () => {});

      // Simulate invalid message from webview
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: null }); // Invalid value

      // Verify error notification was shown
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Invalid response value')
      );

      mockShowErrorMessage.mockRestore();
    });

    it('should handle webview errors gracefully', async () => {
      const testRequest: PopupRequest = {
        requestId: 'test-005',
        workspacePath: '/test/workspace',
        title: 'Test Webview Error',
        message: 'Testing webview error handling',
        options: [{ label: 'OK', value: 'ok' }]
      };

      // Mock error notification
      const mockShowErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');
      mockShowErrorMessage.mockResolvedValue(undefined);

      // Mock webview panel
      const mockWebview = { 
        html: '', 
        onDidReceiveMessage: jest.fn(), 
        postMessage: jest.fn() 
      };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };
      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Render popup
      await popupWebview.renderPopup(testRequest, () => {});

      // Simulate error from webview
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'error', error: 'JavaScript error occurred' });

      // Verify error notification was shown
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Webview error: JavaScript error occurred')
      );

      mockShowErrorMessage.mockRestore();
    });

    it('should handle response timeout gracefully', async () => {
      // Set short timeout for testing
      const originalTimeout = (responseHandler as any).responseTimeout;
      (responseHandler as any).responseTimeout = 100; // 100ms for fast test

      const testRequestId = 'timeout-test';
      
      try {
        // Register pending response that will timeout
        const responsePromise = responseHandler.registerPendingResponse(
          testRequestId,
          'json-rpc-timeout',
          'stdio'
        );

        // Wait for timeout
        await expect(responsePromise).rejects.toThrow('Response timeout');
      } finally {
        // Restore original timeout
        (responseHandler as any).responseTimeout = originalTimeout;
      }
    });
  });

  describe('AC4: Verifies response routing in single-instance setup', () => {
    it('should route response through RequestHandler correctly', async () => {
      // Mock popup trigger callback
      let triggeredRequest: PopupRequest | undefined;
      let responseHandlerRef: ResponseHandler | undefined;

      requestHandler.setPopupTriggerCallback(async (request, handler) => {
        triggeredRequest = request;
        responseHandlerRef = handler;
        
        // Simulate immediate response (like clicking a button)
        const response: PopupResponse = {
          requestId: request.requestId,
          selectedValue: 'automated-response'
        };
        
        await handler.handlePopupResponse(response);
      });

      // Create JSON-RPC request
      const jsonRpcRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'Integration Test',
          message: 'Testing end-to-end flow',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'integration-test-123'
      };

      // Process request through RequestHandler
      const responseJson = await requestHandler.handleRequest(JSON.stringify(jsonRpcRequest));
      const response = JSON.parse(responseJson);

      // Verify popup was triggered correctly
      expect(triggeredRequest).toBeDefined();
      expect(triggeredRequest?.title).toBe('Integration Test');
      expect(triggeredRequest?.message).toBe('Testing end-to-end flow');

      // Verify response format
      expect(response).toEqual({
        jsonrpc: '2.0',
        result: { selectedValue: 'automated-response' },
        id: 'integration-test-123'
      });

      // Verify response handler was passed correctly
      expect(responseHandlerRef).toBe(requestHandler.getResponseHandler());
    });

    it('should handle multiple concurrent requests correctly', async () => {
      const responses: string[] = [];
      
      // Mock popup trigger callback that responds immediately
      requestHandler.setPopupTriggerCallback(async (request, handler) => {
        // Add small delay to simulate real popup interaction
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Simulate different responses based on JSON-RPC ID (not internal request ID)
        const value = request.title.includes('First') ? 'first-response' : 'second-response';
        
        const response: PopupResponse = {
          requestId: request.requestId,
          selectedValue: value
        };
        
        await handler.handlePopupResponse(response);
      });

      // Create two concurrent requests
      const request1: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'First Request',
          message: 'First concurrent request',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'first-request'
      };

      const request2: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'Second Request',
          message: 'Second concurrent request',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'second-request'
      };

      // Process both requests concurrently
      const [response1, response2] = await Promise.all([
        requestHandler.handleRequest(JSON.stringify(request1)),
        requestHandler.handleRequest(JSON.stringify(request2))
      ]);

      const parsed1 = JSON.parse(response1);
      const parsed2 = JSON.parse(response2);

      // Verify responses are correctly routed
      expect(parsed1).toEqual({
        jsonrpc: '2.0',
        result: { selectedValue: 'first-response' },
        id: 'first-request'
      });

      expect(parsed2).toEqual({
        jsonrpc: '2.0',
        result: { selectedValue: 'second-response' },
        id: 'second-request'
      });
    });

    it('should pass HTTP origin to response handler for CORS validation', async () => {
      let capturedOrigin: string | undefined;
      
      // Mock the ResponseHandler to capture the origin parameter
      const originalRegisterPendingResponse = requestHandler.getResponseHandler().registerPendingResponse;
      jest.spyOn(requestHandler.getResponseHandler(), 'registerPendingResponse')
        .mockImplementation(async (requestId, jsonrpcId, transport, origin) => {
          capturedOrigin = origin;
          // Simulate immediate response
          return Promise.resolve(JSON.stringify({
            jsonrpc: '2.0',
            result: { selectedValue: 'test-response' },
            id: jsonrpcId
          }));
        });

      // Mock popup trigger callback
      requestHandler.setPopupTriggerCallback(async (request, handler) => {
        const response: PopupResponse = {
          requestId: request.requestId,
          selectedValue: 'test-response'
        };
        await handler.handlePopupResponse(response);
      });

      const httpRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace', // This indicates HTTP transport
          title: 'HTTP Origin Test',
          message: 'Testing HTTP origin passing',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'http-origin-test'
      };

      const testOrigin = 'http://localhost:3000';
      
      // Process request with origin
      await requestHandler.handleRequest(JSON.stringify(httpRequest), testOrigin);

      // Verify that the origin was passed to the response handler
      expect(capturedOrigin).toBe(testOrigin);
      
      // Test stdio request (no origin should be passed)
      capturedOrigin = undefined;
      
      const stdioRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '', // This indicates stdio transport
          title: 'Stdio Test',
          message: 'Testing stdio transport',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'stdio-test'
      };

      await requestHandler.handleRequest(JSON.stringify(stdioRequest), testOrigin);

      // Verify that no origin was passed for stdio transport
      expect(capturedOrigin).toBeUndefined();
    });
  });

  describe('Response Handler functionality', () => {
    it('should track pending responses correctly', async () => {
      expect(responseHandler.getPendingResponseCount()).toBe(0);

      // Register a pending response
      const responsePromise = responseHandler.registerPendingResponse(
        'pending-test',
        'json-rpc-pending',
        'stdio'
      );

      expect(responseHandler.getPendingResponseCount()).toBe(1);

      // Provide response
      const testResponse: PopupResponse = {
        requestId: 'pending-test',
        selectedValue: 'test-value'
      };

      await responseHandler.handlePopupResponse(testResponse);
      
      // Wait for promise to resolve
      await responsePromise;

      expect(responseHandler.getPendingResponseCount()).toBe(0);
    });

    it('should handle orphan responses gracefully', async () => {
      const orphanEvents: any[] = [];
      responseHandler.on('orphanResponse', (response) => {
        orphanEvents.push(response);
      });

      // Send response without registering pending request
      const orphanResponse: PopupResponse = {
        requestId: 'orphan-test',
        selectedValue: 'orphan-value'
      };

      await responseHandler.handlePopupResponse(orphanResponse);

      expect(orphanEvents).toHaveLength(1);
      expect(orphanEvents[0]).toEqual(orphanResponse);
    });

    it('should emit routing success events', async () => {
      const routingEvents: any[] = [];
      responseHandler.on('responseRouted', (event) => {
        routingEvents.push(event);
      });

      // Register and handle response
      const responsePromise = responseHandler.registerPendingResponse(
        'routing-test',
        'json-rpc-routing',
        'stdio'
      );

      const testResponse: PopupResponse = {
        requestId: 'routing-test',
        selectedValue: 'routing-value'
      };

      await responseHandler.handlePopupResponse(testResponse);
      await responsePromise;

      expect(routingEvents).toHaveLength(1);
      expect(routingEvents[0]).toEqual({
        requestId: 'routing-test',
        transport: 'stdio',
        selectedValue: 'routing-value'
      });
    });
  });
});
