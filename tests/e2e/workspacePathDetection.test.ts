/**
 * E2E tests for workspace path detection and multi-instance routing
 */

import * as assert from 'assert';
import { RequestHandler } from '../../src/backend/requestHandler';
import { logger } from '../../src/utils/logger';

describe('Workspace Path Detection E2E Tests', () => {
  let requestHandler: RequestHandler;

  beforeAll(async () => {
    // Initialize logger for tests
    logger.initialize();
  });

  beforeEach(async () => {
    // Create request handler directly for testing (no need for full server)
    requestHandler = new RequestHandler();
  });

  afterEach(async () => {
    if (requestHandler) {
      requestHandler.dispose();
    }
  });

  describe('Workspace Path Detection', () => {
    it('should detect current workspace path when available', async () => {
      // Mock workspace folders
      const mockWorkspacePath = '/mock/workspace/path';
      
      // Set the workspace path on the request handler
      requestHandler.setExtensionWorkspacePath(mockWorkspacePath);
      
      // Create a test popup request without workspace path (should use fallback)
      const testRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'Testing workspace path detection'
          }
        },
        id: 'test-workspace-detection'
      };

      // Mock popup trigger callback to capture the request
      let capturedRequest: any = null;
      requestHandler.setPopupTriggerCallback(async (request, responseHandler) => {
        capturedRequest = request;
        // Simulate immediate response
        await responseHandler.handlePopupResponse({
          requestId: request.requestId,
          selectedValue: 'test'
        });
      });

      // Send the request
      const response = await requestHandler.handleRequest(JSON.stringify(testRequest));
      const parsedResponse = JSON.parse(response);

      // Verify the request was processed successfully
      assert.strictEqual(parsedResponse.jsonrpc, '2.0');
      assert.strictEqual(parsedResponse.id, 'test-workspace-detection');
      assert.ok(!parsedResponse.error, 'Request should not have errors');

      // Verify the captured request has the correct workspace path
      assert.ok(capturedRequest, 'Popup request should have been captured');
      assert.strictEqual(capturedRequest.workspacePath, mockWorkspacePath, 
        'Should use the fallback workspace path when none provided');
    });

    it('should use provided workspace path when specified by AI assistant', async () => {
      // Mock extension workspace path
      const extensionWorkspacePath = '/extension/workspace/path';
      const aiWorkspacePath = '/ai/assistant/workspace/path';
      
      // Set workspace path to match the AI request for routing to work
      requestHandler.setExtensionWorkspacePath(aiWorkspacePath);
      
      // Create a test popup request with explicit workspace path
      const testRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'Testing AI-provided workspace path',
            workspacePath: aiWorkspacePath
          }
        },
        id: 'test-ai-workspace-path'
      };

      // Mock popup trigger callback to capture the request
      let capturedRequest: any = null;
      requestHandler.setPopupTriggerCallback(async (request, responseHandler) => {
        capturedRequest = request;
        // Simulate immediate response
        await responseHandler.handlePopupResponse({
          requestId: request.requestId,
          selectedValue: 'test'
        });
      });

      // Send the request
      const response = await requestHandler.handleRequest(JSON.stringify(testRequest));
      const parsedResponse = JSON.parse(response);

      // Verify the request was processed successfully
      assert.strictEqual(parsedResponse.jsonrpc, '2.0');
      assert.strictEqual(parsedResponse.id, 'test-ai-workspace-path');
      assert.ok(!parsedResponse.error, 'Request should not have errors');

      // Verify the captured request uses the AI-provided workspace path
      assert.ok(capturedRequest, 'Popup request should have been captured');
      assert.strictEqual(capturedRequest.workspacePath, aiWorkspacePath, 
        'Should use AI-provided workspace path when specified');
    });

    it('should handle empty workspace path gracefully', async () => {
      // Don't set any workspace path (simulates no workspace scenario)
      
      // Create a test popup request without workspace path
      const testRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Popup',
            message: 'Testing no workspace scenario'
          }
        },
        id: 'test-no-workspace'
      };

      // Mock popup trigger callback to capture the request
      let capturedRequest: any = null;
      requestHandler.setPopupTriggerCallback(async (request, responseHandler) => {
        capturedRequest = request;
        // Simulate immediate response
        await responseHandler.handlePopupResponse({
          requestId: request.requestId,
          selectedValue: 'test'
        });
      });

      // Send the request
      const response = await requestHandler.handleRequest(JSON.stringify(testRequest));
      const parsedResponse = JSON.parse(response);

      // Verify the request was processed successfully
      assert.strictEqual(parsedResponse.jsonrpc, '2.0');
      assert.strictEqual(parsedResponse.id, 'test-no-workspace');
      assert.ok(!parsedResponse.error, 'Request should not have errors');

      // Verify the captured request has empty workspace path
      assert.ok(capturedRequest, 'Popup request should have been captured');
      assert.strictEqual(capturedRequest.workspacePath, '', 
        'Should use empty string when no workspace is available');
    });
  });

  describe('Multi-Instance Routing', () => {
    it('should support different workspace paths for routing', async () => {
      const workspace1 = '/workspace/instance1';
      const workspace2 = '/workspace/instance2';
      
      // Set this instance to handle workspace1
      requestHandler.setExtensionWorkspacePath(workspace1);
      
      // Test that different workspace paths can be handled
      const testRequests = [
        {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: 'triggerPopup',
            arguments: {
              title: 'Instance 1 Popup',
              message: 'Testing instance 1',
              workspacePath: workspace1
            }
          },
          id: 'test-instance-1'
        },
        {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: 'triggerPopup',
            arguments: {
              title: 'Instance 2 Popup',
              message: 'Testing instance 2',
              workspacePath: workspace2
            }
          },
          id: 'test-instance-2'
        }
      ];

      const capturedRequests: any[] = [];
      requestHandler.setPopupTriggerCallback(async (request, responseHandler) => {
        capturedRequests.push(request);
        // Simulate immediate response
        await responseHandler.handlePopupResponse({
          requestId: request.requestId,
          selectedValue: 'test'
        });
      });

      // Send first request (should succeed - matches this instance)
      const response1 = await requestHandler.handleRequest(JSON.stringify(testRequests[0]));
      const parsedResponse1 = JSON.parse(response1);
      assert.ok(!parsedResponse1.error, 'Request for workspace1 should succeed');
      
      // Send second request (should fail - no matching instance)
      const response2 = await requestHandler.handleRequest(JSON.stringify(testRequests[1]));
      const parsedResponse2 = JSON.parse(response2);
      assert.ok(parsedResponse2.error, 'Request for workspace2 should return error (no matching instance)');
      assert.strictEqual(parsedResponse2.error.code, -32000);
      assert.ok(parsedResponse2.error.message.includes('No matching VS Code instance found'));

      // Verify only the first request was captured (the one that matched)
      assert.strictEqual(capturedRequests.length, 1, 'Should have captured only the matching request');
      assert.strictEqual(capturedRequests[0].workspacePath, workspace1, 
        'Captured request should have workspace1 path');
    });
  });

  describe('Workspace Path Updates', () => {
    it('should update workspace path when changed', async () => {
      const initialPath = '/initial/workspace';
      const updatedPath = '/updated/workspace';
      
      // Set initial workspace path
      requestHandler.setExtensionWorkspacePath(initialPath);
      
      // Create first test request
      const testRequest1 = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Initial Path',
            message: 'Testing initial workspace path'
          }
        },
        id: 'test-initial-path'
      };

      const capturedRequests: any[] = [];
      requestHandler.setPopupTriggerCallback(async (request, responseHandler) => {
        capturedRequests.push(request);
        await responseHandler.handlePopupResponse({
          requestId: request.requestId,
          selectedValue: 'test'
        });
      });

      // Send first request
      await requestHandler.handleRequest(JSON.stringify(testRequest1));
      
      // Update workspace path
      requestHandler.setExtensionWorkspacePath(updatedPath);
      
      // Create second test request
      const testRequest2 = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'triggerPopup',
          arguments: {
            title: 'Test Updated Path',
            message: 'Testing updated workspace path'
          }
        },
        id: 'test-updated-path'
      };

      // Send second request
      await requestHandler.handleRequest(JSON.stringify(testRequest2));

      // Verify both requests were captured with correct workspace paths
      assert.strictEqual(capturedRequests.length, 2, 'Should have captured both requests');
      assert.strictEqual(capturedRequests[0].workspacePath, initialPath, 
        'First request should use initial workspace path');
      assert.strictEqual(capturedRequests[1].workspacePath, updatedPath, 
        'Second request should use updated workspace path');
    });
  });
});
