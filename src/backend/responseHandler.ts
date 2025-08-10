/**
 * Response handler for routing popup responses back to AI via MCP transport
 * Implements AC: 1, 4 - Send responses via MCP and verify routing
 */

import { EventEmitter } from 'events';
import { PopupResponse, JSONRPCResponse, TransportError } from '../types';
import { logger } from '../utils/logger';

/**
 * Handles routing of popup responses back to the original MCP transport
 */
export class ResponseHandler extends EventEmitter {
  private pendingResponses = new Map<string, {
    transport: 'http' | 'stdio';
    origin?: string;
    resolve: (response: string) => void;
    reject: (error: Error) => void;
    timestamp: number;
    timeoutId?: NodeJS.Timeout;
  }>();

  private responseTimeout = 300000; // 5 minutes timeout for responses
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    
    // Clean up expired pending responses every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredResponses();
    }, 60000);
    
    // Unref the interval so it doesn't keep the process alive
    this.cleanupInterval.unref();
  }

  /**
   * Registers a pending response for a popup request
   * @param requestId - Internal request ID from popup request
   * @param jsonrpcId - Original JSON-RPC request ID
   * @param transport - Transport type (http or stdio)
   * @param origin - HTTP origin (for CORS, only for HTTP transport)
   * @returns Promise that resolves when response is received
   */
  async registerPendingResponse(
    requestId: string,
    jsonrpcId: string,
    transport: 'http' | 'stdio',
    origin?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Set timeout for this specific response
      const timeoutId = setTimeout(() => {
        if (this.pendingResponses.has(requestId)) {
          this.pendingResponses.delete(requestId);
          const timeoutResponse: JSONRPCResponse = {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Popup response timeout',
              data: { requestId, timeout: this.responseTimeout }
            },
            id: jsonrpcId
          };
          reject(new TransportError('Response timeout', timeoutResponse));
        }
      }, this.responseTimeout);

      // Store the pending response with JSON-RPC ID for routing
      this.pendingResponses.set(requestId, {
        transport,
        origin,
        resolve: (response: string) => {
          // Create JSON-RPC response with original ID
          const jsonrpcResponse: JSONRPCResponse = {
            jsonrpc: '2.0',
            result: { selectedValue: JSON.parse(response).selectedValue },
            id: jsonrpcId
          };
          resolve(JSON.stringify(jsonrpcResponse));
        },
        reject,
        timestamp: Date.now(),
        timeoutId
      });
    });
  }

  /**
   * Handles incoming popup response and routes it back via appropriate transport
   * @param response - PopupResponse from webview
   */
  async handlePopupResponse(response: PopupResponse): Promise<void> {
    try {
      const pending = this.pendingResponses.get(response.requestId);
      
      if (!pending) {
        logger.warn(`No pending response found for request ID: ${response.requestId}`);
        // Emit event for monitoring/debugging
        this.emit('orphanResponse', response);
        return;
      }

      // Clear timeout and remove from pending responses
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      this.pendingResponses.delete(response.requestId);

      logger.info('Processing popup response:', {
        requestId: response.requestId,
        selectedValue: response.selectedValue,
        transport: pending.transport
      });

      // Create response data
      const responseData = JSON.stringify({
        selectedValue: response.selectedValue,
        timestamp: new Date().toISOString()
      });

      // Route response back via the original transport
      try {
        pending.resolve(responseData);
        
        // Emit success event
        this.emit('responseRouted', {
          requestId: response.requestId,
          transport: pending.transport,
          selectedValue: response.selectedValue
        });

        logger.info(`Response successfully routed via ${pending.transport} transport`);
      } catch (error) {
        logger.error('Error routing response:', error);
        pending.reject(new TransportError(
          `Failed to route response via ${pending.transport}`,
          { requestId: response.requestId, error: error instanceof Error ? error.message : String(error) }
        ));
      }

    } catch (error) {
      logger.error('Error handling popup response:', error);
      
      // Emit error event
      this.emit('responseError', {
        requestId: response.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Gets count of pending responses (for monitoring)
   */
  getPendingResponseCount(): number {
    return this.pendingResponses.size;
  }

  /**
   * Gets pending response details (for debugging)
   */
  getPendingResponses(): Array<{
    requestId: string;
    transport: string;
    age: number;
  }> {
    const now = Date.now();
    return Array.from(this.pendingResponses.entries()).map(([requestId, pending]) => ({
      requestId,
      transport: pending.transport,
      age: now - pending.timestamp
    }));
  }

  /**
   * Cleans up expired pending responses
   */
  private cleanupExpiredResponses(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [requestId, pending] of this.pendingResponses.entries()) {
      if (now - pending.timestamp > this.responseTimeout) {
        expired.push(requestId);
      }
    }

    if (expired.length > 0) {
      logger.warn(`Cleaning up ${expired.length} expired pending responses`);
      
      for (const requestId of expired) {
        const pending = this.pendingResponses.get(requestId);
        if (pending) {
          // Clear timeout
          if (pending.timeoutId) {
            clearTimeout(pending.timeoutId);
          }
          
          this.pendingResponses.delete(requestId);
          
          // Reject with timeout error
          const timeoutError = new TransportError('Response timeout during cleanup', {
            requestId,
            expiredAt: new Date(now).toISOString()
          });
          
          try {
            pending.reject(timeoutError);
          } catch (error) {
            // Ignore errors from rejected promises that may already be handled
            logger.debug(`Cleanup rejection error for ${requestId}:`, error);
          }
        }
      }

      // Emit cleanup event
      this.emit('cleanup', { expiredCount: expired.length });
    }
  }

  /**
   * Disposes of the response handler and cleans up resources
   */
  dispose(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Reject all pending responses and clear their timeouts
    for (const [requestId, pending] of this.pendingResponses.entries()) {
      try {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.reject(new TransportError('ResponseHandler disposed', { requestId }));
      } catch (error) {
        // Ignore errors from rejected promises
      }
    }
    
    this.pendingResponses.clear();
    this.removeAllListeners();
    
    logger.info('ResponseHandler disposed');
  }
}
