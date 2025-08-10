/**
 * Request handler for parsing and processing MCP requests
 */

import { JSONRPCRequest, JSONRPCResponse, PopupRequest, MCPError } from '../types';
import { validateRequest } from './middleware/validator';
import { logger } from '../utils/logger';
import { ResponseHandler } from './responseHandler';

/**
 * Handles incoming MCP requests and routes them appropriately
 */
export class RequestHandler {
  private requestCounter = 0;
  private responseHandler: ResponseHandler;
  private popupTriggerCallback?: (request: PopupRequest, responseHandler: ResponseHandler) => Promise<void>;

  constructor() {
    this.responseHandler = new ResponseHandler();
  }

  /**
   * Sets the callback for triggering popups (called by extension.ts)
   */
  setPopupTriggerCallback(callback: (request: PopupRequest, responseHandler: ResponseHandler) => Promise<void>): void {
    this.popupTriggerCallback = callback;
  }

  /**
   * Gets the response handler instance
   */
  getResponseHandler(): ResponseHandler {
    return this.responseHandler;
  }

  /**
   * Processes raw request data and returns formatted response
   */
  async handleRequest(rawRequest: string, origin?: string): Promise<string> {
    try {
      // Parse JSON
      let parsedRequest: any;
      try {
        parsedRequest = JSON.parse(rawRequest);
      } catch (error) {
        return this.createErrorResponse(null, -32700, 'Parse error: Invalid JSON');
      }

      // Validate request structure
      try {
        validateRequest(parsedRequest);
      } catch (error) {
        const mcpError = error as MCPError;
        return this.createErrorResponse(
          parsedRequest.id || null,
          mcpError.code,
          mcpError.message,
          mcpError.data
        );
      }

      const request = parsedRequest as JSONRPCRequest;

      // Route to appropriate handler
      switch (request.method) {
        case 'triggerPopup':
          return await this.handleTriggerPopup(request, origin);
        
        case 'healthCheck':
          return await this.handleHealthCheck(request);
        
        default:
          return this.createErrorResponse(
            request.id,
            -32601,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      logger.error('Unexpected error in request handler:', error);
      return this.createErrorResponse(null, -32603, 'Internal error');
    }
  }

  /**
   * Handles triggerPopup method
   */
  private async handleTriggerPopup(request: JSONRPCRequest, origin?: string): Promise<string> {
    try {
      // Generate internal request ID for tracking
      const internalRequestId = this.generateRequestId();
      
      // Create popup request object
      const popupRequest: PopupRequest = {
        requestId: internalRequestId,
        workspacePath: request.params.workspacePath,
        title: request.params.title,
        message: request.params.message,
        options: request.params.options
      };

      logger.info('Popup request received:', {
        id: request.id,
        internalId: internalRequestId,
        workspace: popupRequest.workspacePath,
        title: popupRequest.title
      });

      // Check if popup trigger callback is set
      if (!this.popupTriggerCallback) {
        logger.error('No popup trigger callback set - extension may not be fully initialized');
        return this.createErrorResponse(
          request.id,
          -32000,
          'Popup system not available',
          { error: 'Extension not properly initialized' }
        );
      }

      // Determine transport type
      const transport = request.params.workspacePath ? 'http' : 'stdio';
      
      // Register pending response and get promise
      const responsePromise = this.responseHandler.registerPendingResponse(
        internalRequestId,
        request.id,
        transport,
        // Pass origin for HTTP requests (for CORS validation)
        transport === 'http' ? origin : undefined
      );

      // Trigger the popup (non-blocking)
      this.popupTriggerCallback(popupRequest, this.responseHandler).catch(error => {
        logger.error('Error triggering popup:', error);
        // The response handler will handle cleanup via timeout
      });

      // Wait for user response
      return await responsePromise;

    } catch (error) {
      logger.error('Error handling triggerPopup:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Failed to process popup request',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handles healthCheck method
   */
  private async handleHealthCheck(request: JSONRPCRequest): Promise<string> {
    try {
      const health = {
        status: 'active',
        timestamp: new Date().toISOString(),
        uptime: process.uptime() * 1000, // Convert to milliseconds
        version: '0.1.0'
      };

      return this.createSuccessResponse(request.id, health);
    } catch (error) {
      logger.error('Error handling health check:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Health check failed',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates a successful JSON-RPC response
   */
  private createSuccessResponse(id: string, result: any): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      result,
      id
    };
    return JSON.stringify(response);
  }

  /**
   * Creates an error JSON-RPC response
   */
  private createErrorResponse(
    id: string | null,
    code: number,
    message: string,
    data?: any
  ): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data && { data })
      },
      id
    };
    return JSON.stringify(response);
  }

  /**
   * Generates unique request IDs for internal tracking
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const counter = ++this.requestCounter;
    return `mcp_${timestamp}_${counter}`;
  }

  /**
   * Disposes of the request handler and cleans up resources
   */
  dispose(): void {
    this.responseHandler.dispose();
    this.popupTriggerCallback = undefined;
  }
}
