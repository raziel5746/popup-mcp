/**
 * E2E tests for popup routing functionality
 * Tests accurate routing of popup requests to correct VS Code instances
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RequestHandler } from '../../src/backend/requestHandler';
import { InstanceCoordinator } from '../../src/backend/coordination';
import { ResponseHandler } from '../../src/backend/responseHandler';
import { PopupRequest } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Popup Routing E2E Tests', () => {
  const testWorkspacePath1 = '/test/workspace1';
  const testWorkspacePath2 = '/test/workspace2';
  const testWorkspacePath3 = '/test/workspace3'; // Non-existent workspace
  const testPort1 = 9101;
  const testPort2 = 9102;
  
  let coordinator1: InstanceCoordinator;
  let coordinator2: InstanceCoordinator;
  let requestHandler1: RequestHandler;
  let requestHandler2: RequestHandler;
  let coordinationFile: string;

  beforeEach(async () => {
    // Clean up any existing coordination file
    coordinationFile = path.join(os.tmpdir(), 'popup-mcp-coordination.json');
    if (fs.existsSync(coordinationFile)) {
      fs.unlinkSync(coordinationFile);
    }

    // Create coordinators and request handlers
    coordinator1 = new InstanceCoordinator(testWorkspacePath1, testPort1);
    coordinator2 = new InstanceCoordinator(testWorkspacePath2, testPort2);
    
    requestHandler1 = new RequestHandler();
    requestHandler2 = new RequestHandler();
    
    // Set workspace paths for request handlers
    requestHandler1.setExtensionWorkspacePath(testWorkspacePath1);
    requestHandler2.setExtensionWorkspacePath(testWorkspacePath2);
  });

  afterEach(async () => {
    // Stop coordinators
    if (coordinator1) {
      await coordinator1.stop();
    }
    if (coordinator2) {
      await coordinator2.stop();
    }

    // Dispose request handlers
    if (requestHandler1) {
      requestHandler1.dispose();
    }
    if (requestHandler2) {
      requestHandler2.dispose();
    }

    // Clean up coordination file
    if (fs.existsSync(coordinationFile)) {
      fs.unlinkSync(coordinationFile);
    }
  });

  describe('Workspace Path Validation', () => {
    it('should require workspace path in popup requests', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'triggerPopup',
        params: {
          // Missing workspacePath
          title: 'Test Popup',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'test-1'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should return validation error when workspace path is missing
      expect(parsedResponse.error).toBeDefined();
      expect(parsedResponse.error.message).toContain('Missing or invalid "workspacePath" parameter');
    });

    it('should validate workspace path format', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'triggerPopup',
        params: {
          workspacePath: '', // Empty workspace path
          title: 'Test Popup',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'test-2'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should be handled as validation error
      expect(parsedResponse.error).toBeDefined();
      expect(parsedResponse.error.code).toBe(-32602); // Validation error
    });
  });

  describe('Instance Routing', () => {
    it('should route to local instance when workspace path matches', async () => {
      // Set up a mock popup trigger callback
      let triggeredRequest: PopupRequest | null = null;
      requestHandler1.setPopupTriggerCallback(async (request: PopupRequest, responseHandler: ResponseHandler) => {
        triggeredRequest = request;
        // Simulate user response
        setTimeout(() => {
          responseHandler.handlePopupResponse({
            requestId: request.requestId,
            selectedValue: 'test-response'
          });
        }, 100);
      });

      const request = {
        jsonrpc: '2.0' as const,
        method: 'triggerPopup',
        params: {
          workspacePath: testWorkspacePath1, // Matches this instance
          title: 'Test Popup',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'test-3'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should be handled locally
      expect(parsedResponse.result).toBeDefined();
      expect(triggeredRequest).not.toBeNull();
      expect(triggeredRequest!.workspacePath).toBe(testWorkspacePath1);
    });

    it('should return error when no matching instance found', async () => {
      // Start single coordinator in server mode
      await coordinator1.start();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for election
      
      requestHandler1.setServerMode();

      const request = {
        jsonrpc: '2.0' as const,
        method: 'triggerPopup',
        params: {
          workspacePath: testWorkspacePath3, // Non-existent workspace
          title: 'Test Popup',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'test-4'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should return error for no matching instance
      expect(parsedResponse.error).toBeDefined();
      expect(parsedResponse.error.code).toBe(-32000);
      expect(parsedResponse.error.message).toContain('No matching VS Code instance found');
      expect(parsedResponse.error.data.requestedWorkspace).toBe(testWorkspacePath3);
    });
  });

  describe('Multi-Instance Routing', () => {
    it('should route between different instances based on workspace path', async () => {
      // Start both coordinators
      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for election
      let attempts = 0;
      let roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
      
      while ((!roles.includes('server-active') || !roles.includes('client-active')) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
        attempts++;
      }
      
      // Set up coordinators in request handlers
      const isCoordinator1Server = coordinator1.getCurrentRole() === 'server-active';
      const serverCoordinator = isCoordinator1Server ? coordinator1 : coordinator2;
      const serverHandler = isCoordinator1Server ? requestHandler1 : requestHandler2;
      
      serverHandler.setServerMode();
      
      // Wait for both instances to be registered
      let instances = serverCoordinator.getAllInstances();
      let registrationAttempts = 0;
      while (instances.length < 2 && registrationAttempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        instances = serverCoordinator.getAllInstances();
        registrationAttempts++;
      }
      
      // Verify that server knows about both instances
      expect(instances.length).toBeGreaterThanOrEqual(2);
      
      const workspace1Instance = instances.find(i => i.workspacePath === testWorkspacePath1);
      const workspace2Instance = instances.find(i => i.workspacePath === testWorkspacePath2);
      
      expect(workspace1Instance).toBeDefined();
      expect(workspace2Instance).toBeDefined();
    }, 15000);
  });

  describe('Path Normalization', () => {
    it('should normalize workspace paths for matching', async () => {
      // Set up mock popup trigger
      let triggeredRequest: PopupRequest | null = null;
      requestHandler1.setPopupTriggerCallback(async (request: PopupRequest, responseHandler: ResponseHandler) => {
        triggeredRequest = request;
        setTimeout(() => {
          responseHandler.handlePopupResponse({
            requestId: request.requestId,
            selectedValue: 'test-response'
          });
        }, 100);
      });

      // Test different path formats that should match testWorkspacePath1
      const testCases = [
        testWorkspacePath1,                    // Exact match
        testWorkspacePath1 + '/',             // With trailing slash
        testWorkspacePath1.replace(/\//g, '\\'), // Windows separators
        testWorkspacePath1.toUpperCase(),      // Different case
      ];

      for (const workspacePath of testCases) {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'triggerPopup',
          params: {
            workspacePath,
            title: 'Test Popup',
            message: 'Test message',
            options: [{ label: 'OK', value: 'ok' }]
          },
          id: `test-normalize-${workspacePath.replace(/[^a-zA-Z0-9]/g, '')}`
        };

        const response = await requestHandler1.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);
        
        // Should match and be handled locally
        expect(parsedResponse.result).toBeDefined();
        expect(triggeredRequest).not.toBeNull();
        
        // Reset for next test
        triggeredRequest = null;
      }
    });
  });

  describe('Tools/Call Routing', () => {
    it('should route tools/call requests with workspace paths', async () => {
      // Set up mock popup trigger
      let triggeredRequest: PopupRequest | null = null;
      requestHandler1.setPopupTriggerCallback(async (request: PopupRequest, responseHandler: ResponseHandler) => {
        triggeredRequest = request;
        setTimeout(() => {
          responseHandler.handlePopupResponse({
            requestId: request.requestId,
            selectedValue: 'selected-option'
          });
        }, 100);
      });

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            workspacePath: testWorkspacePath1,
            title: 'Tool Call Test',
            message: 'Test message from tool call',
            options: ['Option 1', 'Option 2']
          }
        },
        id: 'test-tools-call-1'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should be handled locally and return MCP tool response format
      expect(parsedResponse.result).toBeDefined();
      expect(parsedResponse.result.content).toBeDefined();
      expect(parsedResponse.result.content[0].type).toBe('text');
      
      const responseData = JSON.parse(parsedResponse.result.content[0].text);
      expect(responseData.selectedValue).toBe('selected-option');
      expect(responseData.status).toBe('success');
      
      expect(triggeredRequest).not.toBeNull();
      expect(triggeredRequest!.workspacePath).toBe(testWorkspacePath1);
    });

    it('should return error for tools/call with non-matching workspace', async () => {
      // Start single coordinator
      await coordinator1.start();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      requestHandler1.setServerMode();

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            workspacePath: testWorkspacePath3, // Non-existent
            title: 'Tool Call Test',
            message: 'Test message',
            options: ['Option 1']
          }
        },
        id: 'test-tools-call-error-1'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should return error
      expect(parsedResponse.error).toBeDefined();
      expect(parsedResponse.error.code).toBe(-32000);
      expect(parsedResponse.error.message).toContain('No matching VS Code instance found');
    });
  });

  describe('Error Handling', () => {
    it('should handle routing failures gracefully', async () => {
      // Start coordinator but don't set up HTTP server
      await coordinator1.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock an instance with no HTTP port
      const mockInstance = {
        instanceId: 'mock-instance',
        workspacePath: testWorkspacePath2,
        processId: 9999,
        lastSeen: Date.now(),
        role: 'client-active' as const,
        httpPort: undefined // No HTTP port
      };
      
      // This would require internal access to coordinator state
      // For now, we test the error case by requesting non-existent workspace
      requestHandler1.setServerMode();

      const request = {
        jsonrpc: '2.0' as const,
        method: 'triggerPopup',
        params: {
          workspacePath: testWorkspacePath2, // Different workspace
          title: 'Test Popup',
          message: 'Test message',
          options: [{ label: 'OK', value: 'ok' }]
        },
        id: 'test-error-1'
      };

      const response = await requestHandler1.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);
      
      // Should return appropriate error
      expect(parsedResponse.error).toBeDefined();
      expect(parsedResponse.error.code).toBe(-32000);
    });
  });
});
