/**
 * WebSocket client for client instances to connect to server for popup routing
 */

import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { PopupRequest } from '../types';

export interface WebSocketClientCallbacks {
  onPopupRequest: (request: PopupRequest) => Promise<{ selectedValue: string }>;
  onServerDisconnected?: () => void;
  onServerReconnected?: () => void;
}

/**
 * WebSocket client that connects to the server instance for popup communication
 */
export class WebSocketClient {
  private ws?: WebSocket;
  private workspacePath: string;
  private serverPort?: number;
  private callbacks?: WebSocketClientCallbacks;
  private reconnectTimeout?: NodeJS.Timeout;
  private isConnected = false;
  private readonly RECONNECT_DELAY = 15000; // 15 seconds (reduced frequency)

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Sets the callback handlers for WebSocket events
   */
  setCallbacks(callbacks: WebSocketClientCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Connects to the server WebSocket
   */
  async connect(serverPort: number): Promise<void> {
    this.serverPort = serverPort;
    
    try {
      const wsUrl = `ws://localhost:${serverPort}/popup-ws`;
      logger.info(`Connecting WebSocket client to server on port ${serverPort}`);
      logger.info(`WebSocket URL: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        logger.info('WebSocket client connected to server');
        this.isConnected = true;
        
        // Notify about server reconnection
        if (this.callbacks?.onServerReconnected) {
          this.callbacks.onServerReconnected();
        }
        
        // Register with server
        this.ws!.send(JSON.stringify({
          type: 'register',
          workspacePath: this.workspacePath
        }));
        
        logger.info(`WebSocket client registered with workspace: ${this.workspacePath}`);
      });
      
      this.ws.on('message', async (data) => {
        await this.handleMessage(data);
      });
      
      this.ws.on('close', () => {
        logger.debug('WebSocket client connection closed');
        const wasConnected = this.isConnected;
        this.isConnected = false;
        
        // Notify about server disconnection
        if (wasConnected && this.callbacks?.onServerDisconnected) {
          this.callbacks.onServerDisconnected();
        }
        
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (error) => {
        logger.debug('WebSocket client error:', error);
        this.isConnected = false;
      });
      
      // Handle ping/pong for heartbeat
      this.ws.on('ping', () => {
        if (this.ws) {
          this.ws.pong();
        }
      });
      
    } catch (error) {
      logger.error('Failed to connect WebSocket client:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnects the WebSocket client
   */
  disconnect(): void {
    logger.info('Disconnecting WebSocket client');
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = undefined;
    }
    
    this.isConnected = false;
  }

  /**
   * Checks if the client is currently connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handles incoming WebSocket messages
   */
  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'popup_request') {
        await this.handlePopupRequest(message);
      } else {
        logger.warn('Unknown message type from server:', message.type);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handles popup request from server
   */
  private async handlePopupRequest(message: any): Promise<void> {
    try {
      if (!this.callbacks?.onPopupRequest) {
        logger.error('No popup request callback set');
        return;
      }

      logger.info(`Received popup request via WebSocket: ${message.id ?? message.requestId ?? 'unknown'}`);
      
      // Support direct popup_request shape sent over the popup WebSocket
      const popupRequest: PopupRequest = {
        requestId: (message.requestId ?? message.id ?? 'unknown').toString(),
        workspacePath: (
          message.workspacePath ||
          message.params?.workspacePath ||
          this.workspacePath ||
          ''
        ).toString(),
        title: (
          message.title ||
          message.params?.title ||
          message.params?.arguments?.title ||
          'Popup'
        ),
        message: (
          message.message ||
          message.params?.message ||
          message.params?.arguments?.message ||
          ''
        ),
        options: (
          message.options ||
          message.params?.options ||
          message.params?.arguments?.options ||
          []
        )
      };

      // Show popup locally and get user response
      const userResponse = await this.callbacks.onPopupRequest(popupRequest);
      
      // Send response back to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'popup_response',
          requestId: popupRequest.requestId,
          selectedValue: userResponse.selectedValue
        }));
        
        logger.info(`Sent popup response via WebSocket: ${popupRequest.requestId} -> ${userResponse.selectedValue}`);
      } else {
        logger.error('WebSocket not available to send response');
      }

    } catch (error) {
      logger.error('Error handling popup request:', error);
      
      // Send error response back to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'popup_response',
          requestId: message.id?.toString() || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    }
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Already scheduled
    }
    
    if (!this.serverPort) {
      logger.warn('No server port available for reconnection');
      return;
    }
    
    logger.debug(`Scheduling WebSocket reconnection in ${this.RECONNECT_DELAY}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect(this.serverPort!).catch(error => {
        logger.error('Reconnection attempt failed:', error);
      });
    }, this.RECONNECT_DELAY);
  }
}
