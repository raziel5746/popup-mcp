/**
 * Unit tests for triggerPopup tool functionality
 */

import { RequestHandler } from '../../../src/backend/requestHandler';
import { ResponseHandler } from '../../../src/backend/responseHandler';
import { PopupRequest, JSONRPCRequest } from '../../../src/types';

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('TriggerPopup Tool Tests', () => {
  let requestHandler: RequestHandler;
  let mockPopupCallback: jest.Mock;
  let mockResponseHandler: ResponseHandler;

  beforeEach(() => {
    requestHandler = new RequestHandler();
    mockPopupCallback = jest.fn().mockResolvedValue(undefined);
    
    // Mock the response handler's registerPendingResponse method
    const responseHandler = requestHandler.getResponseHandler();
    jest.spyOn(responseHandler, 'registerPendingResponse').mockResolvedValue(
      '{"jsonrpc":"2.0","result":{"selectedValue":"yes"},"id":"test"}'
    );

    requestHandler.setPopupTriggerCallback(mockPopupCallback);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    requestHandler.dispose();
  });

  describe('initialize method', () => {
    it('should return capabilities with tools support', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 'test-1'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-1');
      expect(parsed.result).toBeDefined();
      expect(parsed.result.capabilities).toBeDefined();
      expect(parsed.result.capabilities.tools).toEqual({ listChanged: false });
      expect(parsed.result.serverInfo).toEqual({
        name: 'popup-mcp',
        version: '0.1.0'
      });
    });
  });

  describe('tools/list method', () => {
    it('should return available tools including triggerPopup', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'test-2'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-2');
      expect(parsed.result).toBeDefined();
      expect(parsed.result.tools).toBeInstanceOf(Array);
      expect(parsed.result.tools).toHaveLength(1);

      const tool = parsed.result.tools[0];
      expect(tool.name).toBe('triggerPopup');
      expect(tool.description).toBe('Trigger a popup in VS Code for user input');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toHaveProperty('title');
      expect(tool.inputSchema.properties).toHaveProperty('message');
      expect(tool.inputSchema.properties).toHaveProperty('options');
      expect(tool.inputSchema.properties).toHaveProperty('workspacePath');
      expect(tool.inputSchema.required).toEqual(['title', 'message']);
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false
      });
    });
  });

  describe('tools/call method', () => {

    it('should successfully call triggerPopup tool with valid parameters', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message',
            options: ['Yes', 'No']
          }
        },
        id: 'test-3'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-3');
      expect(parsed.result).toBeDefined();
      expect(parsed.result.content).toBeInstanceOf(Array);
      expect(parsed.result.content[0].type).toBe('text');
      
      const content = JSON.parse(parsed.result.content[0].text);
      expect(content.selectedValue).toBe('yes');
      expect(content.status).toBe('success');

      // Verify popup callback was called
      expect(mockPopupCallback).toHaveBeenCalledTimes(1);
      const popupRequest: PopupRequest = mockPopupCallback.mock.calls[0][0];
      expect(popupRequest.title).toBe('Test Popup');
      expect(popupRequest.message).toBe('This is a test message');
      expect(popupRequest.options).toEqual([
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' }
      ]);
    });

    it('should handle options as objects correctly', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message',
            options: [
              { label: 'Confirm', value: 'confirm' },
              { label: 'Cancel', value: 'cancel' }
            ]
          }
        },
        id: 'test-4'
      };

      await requestHandler.handleRequest(JSON.stringify(request));

      const popupRequest: PopupRequest = mockPopupCallback.mock.calls[0][0];
      expect(popupRequest.options).toEqual([
        { label: 'Confirm', value: 'confirm' },
        { label: 'Cancel', value: 'cancel' }
      ]);
    });

    it('should handle empty options array', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message',
            options: []
          }
        },
        id: 'test-5'
      };

      await requestHandler.handleRequest(JSON.stringify(request));

      const popupRequest: PopupRequest = mockPopupCallback.mock.calls[0][0];
      expect(popupRequest.options).toEqual([]);
    });

    it('should return error for unknown tool name', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unknownTool',
          arguments: {}
        },
        id: 'test-6'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-6');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32601);
      expect(parsed.error.message).toBe('Unknown tool: unknownTool');
    });

    it('should return error for missing required parameters', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup'
            // Missing required 'message' parameter
          }
        },
        id: 'test-7'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-7');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toBe('Missing or invalid "message" in arguments');
    });

    it('should return error when popup callback is not set', async () => {
      // Create a new request handler without setting the callback
      const handlerWithoutCallback = new RequestHandler();

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message'
          }
        },
        id: 'test-8'
      };

      const response = await handlerWithoutCallback.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-8');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32000);
      expect(parsed.error.message).toBe('Popup system not available');

      handlerWithoutCallback.dispose();
    });

    it('should handle error responses from popup system', async () => {
      // Mock the response handler to return an error response
      const responseHandler = requestHandler.getResponseHandler();
      jest.spyOn(responseHandler, 'registerPendingResponse').mockResolvedValueOnce(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Popup failed' },
          id: 'test-response'
        })
      );

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message'
          }
        },
        id: 'test-9'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-response');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32000);
      expect(parsed.error.message).toBe('Popup failed');
    });

    it('should set workspacePath from arguments', async () => {
      // Set up matching workspace path
      requestHandler.setExtensionWorkspacePath('/path/to/workspace');
      
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message',
            workspacePath: '/path/to/workspace'
          }
        },
        id: 'test-10'
      };

      await requestHandler.handleRequest(JSON.stringify(request));

      const popupRequest: PopupRequest = mockPopupCallback.mock.calls[0][0];
      expect(popupRequest.workspacePath).toBe('/path/to/workspace');
    });

    it('should default workspacePath to empty string for stdio', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'This is a test message'
          }
        },
        id: 'test-11'
      };

      await requestHandler.handleRequest(JSON.stringify(request));

      const popupRequest: PopupRequest = mockPopupCallback.mock.calls[0][0];
      expect(popupRequest.workspacePath).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors', async () => {
      const response = await requestHandler.handleRequest('invalid json');
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(null);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32700);
      expect(parsed.error.message).toBe('Parse error: Invalid JSON');
    });

    it('should handle method not found', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'unknownMethod',
        params: {},
        id: 'test-12'
      };

      const response = await requestHandler.handleRequest(JSON.stringify(request));
      const parsed = JSON.parse(response);

      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('test-12');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toBe('Unknown method: unknownMethod');
    });
  });
});
