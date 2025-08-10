/**
 * Unit tests for Validator middleware
 */

import { validateRequest, validateOrigin, requestGuard } from '../../../src/backend/middleware/validator';
import { ValidationError } from '../../../src/types';

describe('Validator Middleware', () => {
  describe('validateRequest', () => {
    it('should validate correct JSON-RPC request', () => {
      const validRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          workspacePath: '/test/workspace',
          title: 'Test Title',
          message: 'Test message',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ]
        },
        id: 'test-1'
      };

      expect(() => validateRequest(validRequest)).not.toThrow();
      expect(validateRequest(validRequest)).toBe(true);
    });

    it('should validate healthCheck request', () => {
      const healthRequest = {
        jsonrpc: '2.0',
        method: 'healthCheck',
        id: 'health-1'
      };

      expect(() => validateRequest(healthRequest)).not.toThrow();
      expect(validateRequest(healthRequest)).toBe(true);
    });

    it('should reject request with wrong jsonrpc version', () => {
      const invalidRequest = {
        jsonrpc: '1.0',
        method: 'test',
        id: 'test-1'
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('Invalid JSON-RPC version');
    });

    it('should reject request without method', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 'test-1'
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('method');
    });

    it('should reject request without id', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        method: 'test'
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('id');
    });

    it('should reject unknown method', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        method: 'unknownMethod',
        id: 'test-1'
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('Unknown method');
    });
  });

  describe('triggerPopup validation', () => {
    const baseRequest = {
      jsonrpc: '2.0',
      method: 'triggerPopup',
      id: 'test-1'
    };

    it('should reject request without params', () => {
      expect(() => validateRequest(baseRequest)).toThrow(ValidationError);
      expect(() => validateRequest(baseRequest)).toThrow('params');
    });

    it('should reject request with invalid params type', () => {
      const invalidRequest = {
        ...baseRequest,
        params: 'invalid'
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('params');
    });

    it('should reject request without workspacePath', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          title: 'Test',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('workspacePath');
    });

    it('should reject request without title', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('title');
    });

    it('should reject request without message', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          options: [{ label: 'OK', value: 'ok' }]
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('message');
    });

    it('should reject request without options', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message'
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('options');
    });

    it('should reject request with non-array options', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: 'invalid'
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('options');
    });

    it('should reject request with empty options array', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: []
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('At least one option is required');
    });

    it('should reject request with invalid option format', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: [{ label: 'OK' }] // Missing value
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('value');
    });

    it('should reject request with option missing label', () => {
      const invalidRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: [{ value: 'ok' }] // Missing label
        }
      };

      expect(() => validateRequest(invalidRequest)).toThrow(ValidationError);
      expect(() => validateRequest(invalidRequest)).toThrow('label');
    });

    it('should validate multiple options correctly', () => {
      const validRequest = {
        ...baseRequest,
        params: {
          workspacePath: '/test',
          title: 'Test',
          message: 'Test message',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Maybe', value: 'maybe' }
          ]
        }
      };

      expect(() => validateRequest(validRequest)).not.toThrow();
    });
  });

  describe('validateOrigin', () => {
    it('should allow requests without origin', () => {
      expect(validateOrigin(undefined)).toBe(true);
    });

    it('should allow localhost origins', () => {
      expect(validateOrigin('http://localhost:3000')).toBe(true);
      expect(validateOrigin('https://localhost:8080')).toBe(true);
      expect(validateOrigin('http://127.0.0.1:3000')).toBe(true);
      expect(validateOrigin('https://127.0.0.1:8080')).toBe(true);
    });

    it('should reject non-localhost origins', () => {
      expect(validateOrigin('http://example.com')).toBe(false);
      expect(validateOrigin('https://malicious.site')).toBe(false);
      expect(validateOrigin('http://192.168.1.100')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateOrigin('')).toBe(false); // Empty string should be rejected
      expect(validateOrigin('not-a-url')).toBe(false);
      expect(validateOrigin('localhost')).toBe(false); // Missing protocol
    });
  });

  describe('requestGuard', () => {
    const validRequest = {
      jsonrpc: '2.0',
      method: 'healthCheck',
      id: 'test-1'
    };

    it('should pass valid request with valid origin', () => {
      expect(() => requestGuard(validRequest, 'http://localhost:3000')).not.toThrow();
      expect(requestGuard(validRequest, 'http://localhost:3000')).toBe(true);
    });

    it('should pass valid request without origin', () => {
      expect(() => requestGuard(validRequest)).not.toThrow();
      expect(requestGuard(validRequest)).toBe(true);
    });

    it('should reject invalid request', () => {
      const invalidRequest = {
        jsonrpc: '1.0', // Wrong version
        method: 'test',
        id: 'test-1'
      };

      expect(() => requestGuard(invalidRequest)).toThrow(ValidationError);
    });

    it('should reject valid request with invalid origin', () => {
      // Mock console.warn to avoid test output noise
      const originalWarn = console.warn;
      console.warn = jest.fn();

      expect(() => requestGuard(validRequest, 'http://malicious.site')).toThrow(ValidationError);
      expect(() => requestGuard(validRequest, 'http://malicious.site')).toThrow('Invalid request origin');

      // Restore console.warn
      console.warn = originalWarn;
    });

    it('should log security violations', () => {
      const originalWarn = console.warn;
      const mockWarn = jest.fn();
      console.warn = mockWarn;

      try {
        requestGuard(validRequest, 'http://malicious.site');
      } catch (error) {
        // Expected to throw
      }

      expect(mockWarn).toHaveBeenCalledWith('Request guard failed:', expect.any(String));

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
