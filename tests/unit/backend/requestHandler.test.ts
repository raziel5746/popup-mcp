/**
 * Unit tests for Request Handler
 */

import { RequestHandler } from '../../../src/backend/requestHandler';

describe('RequestHandler', () => {
  let handler: RequestHandler;

  beforeEach(() => {
    handler = new RequestHandler();
  });

  describe('JSON Parsing', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await handler.handleRequest('invalid json');
      const parsed = JSON.parse(response);
      
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32700);
      expect(parsed.error.message).toContain('Parse error');
      expect(parsed.id).toBeNull();
    });

    it('should handle empty request', async () => {
      const response = await handler.handleRequest('');
      const parsed = JSON.parse(response);
      
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32700);
    });
  });

  describe('Request Validation', () => {
    it('should reject requests without jsonrpc field', async () => {
      const invalidRequest = JSON.stringify({
        method: 'test',
        id: '1'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602); // Validation error
    });

    it('should reject requests with wrong jsonrpc version', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '1.0',
        method: 'test',
        id: '1'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('Invalid JSON-RPC version');
    });

    it('should reject requests without method field', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: '1'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('method');
    });

    it('should reject requests without id field', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'test'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('id');
    });
  });

  describe('Health Check Method', () => {
    it('should handle healthCheck method successfully', async () => {
      const healthRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'healthCheck',
        id: 'health-1'
      });
      
      const response = await handler.handleRequest(healthRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.result).toBeDefined();
      expect(parsed.result.status).toBe('active');
      expect(parsed.result.timestamp).toBeDefined();
      expect(parsed.result.uptime).toBeDefined();
      expect(parsed.result.version).toBeDefined();
      expect(parsed.id).toBe('health-1');
    });

    it('should include proper health check data', async () => {
      const healthRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'healthCheck',
        id: 'health-test'
      });
      
      const response = await handler.handleRequest(healthRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.result.status).toBe('active');
      expect(typeof parsed.result.timestamp).toBe('string');
      expect(typeof parsed.result.uptime).toBe('number');
      expect(parsed.result.uptime).toBeGreaterThan(0);
      expect(parsed.result.version).toBe('0.1.0');
    });
  });

  describe('Trigger Popup Method', () => {
    it('should handle valid triggerPopup request', async () => {
      const popupRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'Test Popup',
          message: 'This is a test',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ]
        },
        id: 'popup-1'
      });
      
      const response = await handler.handleRequest(popupRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.result).toBeDefined();
      expect(parsed.result.status).toBe('queued');
      expect(parsed.result.requestId).toBeDefined();
      expect(parsed.id).toBe('popup-1');
    });

    it('should reject triggerPopup without required params', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'triggerPopup',
        id: 'popup-invalid'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('params');
    });

    it('should reject triggerPopup with missing workspacePath', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          title: 'Test',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'popup-invalid'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('workspacePath');
    });

    it('should reject triggerPopup with empty options array', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: []
        },
        id: 'popup-invalid'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('At least one option is required');
    });

    it('should reject triggerPopup with invalid option format', async () => {
      const invalidRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: [{ label: 'OK' }] // Missing value
        },
        id: 'popup-invalid'
      });
      
      const response = await handler.handleRequest(invalidRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602);
      expect(parsed.error.message).toContain('value');
    });

    it('should generate unique request IDs', async () => {
      const popupRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'Test Popup',
          message: 'This is a test',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'popup-test'
      };

      // Make two identical requests
      const response1 = await handler.handleRequest(JSON.stringify(popupRequest));
      const response2 = await handler.handleRequest(JSON.stringify(popupRequest));
      
      const parsed1 = JSON.parse(response1);
      const parsed2 = JSON.parse(response2);
      
      expect(parsed1.result.requestId).toBeDefined();
      expect(parsed2.result.requestId).toBeDefined();
      expect(parsed1.result.requestId).not.toBe(parsed2.result.requestId);
    });
  });

  describe('Unknown Methods', () => {
    it('should reject unknown methods', async () => {
      const unknownRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'unknownMethod',
        id: 'unknown-1'
      });
      
      const response = await handler.handleRequest(unknownRequest);
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602); // Validation error (unknown method caught by validator)
      expect(parsed.error.message).toContain('Unknown method'); // Validation error message
      expect(parsed.error.message).toContain('unknownMethod');
      expect(parsed.id).toBe('unknown-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const originalError = console.error;
      console.error = jest.fn();
      
      // This should trigger internal error handling
      const response = await handler.handleRequest('{}');
      const parsed = JSON.parse(response);
      
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32602); // Validation error for missing fields
      
      // Restore console.error
      console.error = originalError;
    });
  });
});
