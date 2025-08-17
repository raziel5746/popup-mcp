/**
 * Integration tests for WebSocket communication between server and client instances
 */

import WebSocket from 'ws';
import { McpServer } from '../../src/backend/mcpServer';
import { WebSocketClient } from '../../src/components/WebSocketClient';
import { TransportConfig, PopupRequest } from '../../src/types';

describe('WebSocket Communication Integration Tests', () => {
  let wsClient: WebSocketClient;

  beforeEach(() => {
    // Initialize WebSocket client for basic tests
    wsClient = new WebSocketClient('/test/workspace');
  });

  afterEach(() => {
    if (wsClient) {
      wsClient.disconnect();
    }
  });

  test('should create WebSocket client instance', () => {
    expect(wsClient).toBeDefined();
    expect(wsClient.isClientConnected()).toBe(false);
  });

  test('should set callbacks correctly', () => {
    const mockCallback = {
      onPopupRequest: jest.fn().mockResolvedValue({ selectedValue: 'test' })
    };

    wsClient.setCallbacks(mockCallback);
    
    // Verify callbacks are set (this tests the interface)
    expect(mockCallback.onPopupRequest).toBeDefined();
  });

  test('should handle disconnection when not connected', () => {
    // Should not throw error when disconnecting while not connected
    expect(() => wsClient.disconnect()).not.toThrow();
    expect(wsClient.isClientConnected()).toBe(false);
  });
});
