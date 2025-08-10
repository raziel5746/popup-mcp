/**
 * Request handler for parsing and processing MCP requests
 */

import { JSONRPCRequest, JSONRPCResponse, PopupRequest, MCPError } from '../types';
import { validateRequest } from './middleware/validator';
import { logger } from '../utils/logger';

/**
 * Handles incoming MCP requests and routes them appropriately
 */
export class RequestHandler {
  private requestCounter = 0;

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
          return await this.handleTriggerPopup(request);
        
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
  private async handleTriggerPopup(request: JSONRPCRequest): Promise<string> {
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

      // TODO: In future stories, this will route to the appropriate VS Code instance
      // For now, we'll return a mock response to show the server is working
      
      logger.info('Popup request received:', {
        id: request.id,
        internalId: internalRequestId,
        workspace: popupRequest.workspacePath,
        title: popupRequest.title
      });

      // For now, return acknowledgment that request was queued
      // In future stories, this will integrate with actual popup UI
      return this.createSuccessResponse(request.id, {
        status: 'queued',
        requestId: internalRequestId
      });

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
}
