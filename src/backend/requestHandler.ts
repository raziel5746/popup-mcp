/**
 * Request handler for parsing and processing MCP requests
 */

import { JSONRPCRequest, JSONRPCResponse, PopupRequest, MCPError } from '../types';
import { validateRequest } from './middleware/validator';
import { logger } from '../utils/logger';
import { ResponseHandler } from './responseHandler';
import { InstanceCoordinator, InstanceInfo } from './coordination';
import * as http from 'http';

/**
 * Handles incoming MCP requests and routes them appropriately
 */
export class RequestHandler {
  private requestCounter = 0;
  private responseHandler: ResponseHandler;
  private popupTriggerCallback?: (request: PopupRequest, responseHandler: ResponseHandler) => Promise<void>;
  private extensionWorkspacePath = '';
  private coordinator?: InstanceCoordinator;
  private isClientMode = false;
  private mcpServer?: { routePopupToClient: (workspacePath: string, popupRequest: any) => Promise<any> }; // Reference to MCP server for WebSocket routing

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
   * Sets the extension workspace path for fallback routing
   */
  setExtensionWorkspacePath(workspacePath: string): void {
    this.extensionWorkspacePath = workspacePath;
    logger.info(`Extension workspace path set for MCP coordination: ${workspacePath}`);
  }

  /**
   * Gets the response handler instance
   */
  getResponseHandler(): ResponseHandler {
    return this.responseHandler;
  }

  /**
   * Gets the popup trigger callback
   */
  getPopupTriggerCallback(): ((request: PopupRequest, responseHandler: ResponseHandler) => Promise<void>) | undefined {
    return this.popupTriggerCallback;
  }

  /**
   * Sets client mode for request forwarding
   */
  setClientMode(coordinator: InstanceCoordinator): void {
    this.coordinator = coordinator;
    this.isClientMode = true;
    logger.info('Request handler set to client mode - will forward requests to server');
  }

  /**
   * Sets server mode for direct request handling
   */
  setServerMode(): void {
    this.isClientMode = false;
    logger.info('Request handler set to server mode - will handle requests directly');
  }

  /**
   * Sets the coordinator for server instances to enable request routing
   */
  setCoordinator(coordinator: InstanceCoordinator): void {
    this.coordinator = coordinator;
    logger.info('Request handler coordinator set for instance routing');
  }

  /**
   * Sets the MCP server reference for WebSocket routing
   */
  setMcpServer(mcpServer: { routePopupToClient: (workspacePath: string, popupRequest: any) => Promise<any> }): void {
    this.mcpServer = mcpServer;
    logger.info('Request handler MCP server reference set for WebSocket routing');
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

      // Forward to server if in client mode (except for initialization and health checks)
      if (this.isClientMode && this.coordinator && 
          request.method !== 'initialize' && 
          request.method !== 'healthCheck') {
        try {
          logger.info(`Forwarding ${request.method} request to server instance`);
          const response = await this.coordinator.forwardToServer(parsedRequest);
          return JSON.stringify(response);
        } catch (error) {
          logger.error('Failed to forward request to server:', error);
          return this.createErrorResponse(
            request.id,
            -32000,
            'Request forwarding failed',
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }

      // Route to appropriate handler
      switch (request.method) {
      case 'initialize':
        return await this.handleInitialize(request);
        
      case 'tools/list':
        return await this.handleToolsList(request);
        
      case 'tools/call':
        return await this.handleToolsCall(request, origin);
        
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
      const requestedWorkspacePath = request.params.workspacePath;
      
      // Use common routing logic
      const routingResult = await this.routeRequest(
        request,
        requestedWorkspacePath,
        () => this.handleTriggerPopupLocal(request, origin)
      );
      
      return routingResult;

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
   * Handles triggerPopup locally on this instance
   */
  private async handleTriggerPopupLocal(request: JSONRPCRequest, origin?: string): Promise<string> {
    try {
      // Generate internal request ID for tracking
      const internalRequestId = this.generateRequestId();
      
      // Create popup request object
      // Use provided workspacePath, or fallback to detected workspace for current instance
      const popupRequest: PopupRequest = {
        requestId: internalRequestId,
        workspacePath: request.params.workspacePath || this.getExtensionWorkspacePath(),
        title: request.params.title,
        message: request.params.message,
        options: request.params.options
      };

      logger.info('Popup request received for local handling:', {
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
      logger.error('Error handling triggerPopup locally:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Failed to process popup request',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handles initialize method - declares MCP capabilities
   */
  private async handleInitialize(request: JSONRPCRequest): Promise<string> {
    try {
      const capabilities = {
        tools: {
          listChanged: false
        }
      };

      const serverInfo = {
        name: 'popup-mcp',
        version: '0.1.0'
      };

      return this.createSuccessResponse(request.id, {
        capabilities,
        serverInfo
      });
    } catch (error) {
      logger.error('Error handling initialize:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Initialization failed',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handles tools/list method - returns available tools
   */
  private async handleToolsList(request: JSONRPCRequest): Promise<string> {
    try {
      const tools = [
        {
          name: 'triggerPopup',
          description: 'Trigger a popup in VS Code for user input',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the popup'
              },
              message: {
                type: 'string',
                description: 'Main message content'
              },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'string',
                      description: 'The value returned when this option is selected'
                    },
                    label: {
                      type: 'string',
                      description: 'The display text shown to the user'
                    }
                  },
                  required: ['value', 'label']
                },
                description: 'Array of button options for user selection. Each option should have a value (returned when selected) and label (displayed to user).'
              },
              workspacePath: {
                type: 'string',
                description: 'Required workspace path to target specific VS Code instance. AI assistants should include their current workspace path here for proper routing in multi-instance environments.'
              }
            },
            required: ['title', 'message', 'workspacePath']
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false
          }
        }
      ];

      return this.createSuccessResponse(request.id, { tools });
    } catch (error) {
      logger.error('Error handling tools/list:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Failed to list tools',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handles tools/call method - executes tool calls
   */
  private async handleToolsCall(request: JSONRPCRequest, origin?: string): Promise<string> {
    try {
      const { name, arguments: args } = request.params as any;

      if (name !== 'triggerPopup') {
        return this.createErrorResponse(
          request.id,
          -32601,
          `Unknown tool: ${name}`
        );
      }

      // Validate required parameters
      if (!args || !args.title || !args.message) {
        return this.createErrorResponse(
          request.id,
          -32602,
          'Invalid parameters: title and message are required'
        );
      }

      const requestedWorkspacePath = args.workspacePath;
      
      // Use common routing logic
      return await this.routeRequest(
        request,
        requestedWorkspacePath,
        () => this.handleToolsCallLocal(request, origin)
      );

    } catch (error) {
      logger.error('Error handling tools/call:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Failed to execute tool',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handles tools/call locally on this instance
   */
  private async handleToolsCallLocal(request: JSONRPCRequest, origin?: string): Promise<string> {
    try {
      const { name, arguments: args } = request.params as any;

      // Generate internal request ID for tracking
      const internalRequestId = this.generateRequestId();
      
      // Convert options from array of strings to array of objects if needed
      let options: Array<{ label: string; value: string }> = [];
      if (args.options && Array.isArray(args.options)) {
        // Options are already in the correct format from the schema
        options = args.options;
      }

      // Create popup request object
      // Use provided workspacePath, or fallback to detected workspace for current instance
      const popupRequest: PopupRequest = {
        requestId: internalRequestId,
        workspacePath: args.workspacePath || this.getExtensionWorkspacePath(),
        title: args.title,
        message: args.message,
        options
      };

      logger.info('Tool call popup request received for local handling:', {
        id: request.id,
        internalId: internalRequestId,
        title: popupRequest.title,
        toolName: name
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
      const transport = popupRequest.workspacePath ? 'http' : 'stdio';
      
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
        logger.error('Error triggering popup via tool call:', error);
        // The response handler will handle cleanup via timeout
      });

      // Wait for user response and format as MCP tool response
      const response = await responsePromise;
      const parsedResponse = JSON.parse(response);
      
      if (parsedResponse.error) {
        return response; // Return error as-is
      }

      // Format successful response for MCP tools protocol
      const toolResponse = {
        content: [
          {
            type: 'text',
            text: `User selected: ${parsedResponse.result?.selectedValue || ''}`
          }
        ]
      };

      return this.createSuccessResponse(request.id, toolResponse);

    } catch (error) {
      logger.error('Error handling tools/call locally:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Failed to execute tool',
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
   * Common routing logic for workspace-aware requests
   */
  private async routeRequest(
    request: JSONRPCRequest,
    requestedWorkspacePath: string | undefined,
    localHandler: () => Promise<string>
  ): Promise<string> {
    // If no workspace path provided, handle locally
    if (!requestedWorkspacePath) {
      return await localHandler();
    }

    // Check if the requested workspace matches this instance
    if (this.isWorkspaceMatch(requestedWorkspacePath)) {
      logger.info(`Workspace path matches this instance: ${requestedWorkspacePath}`);
      return await localHandler();
    }

    // If in server mode, try to route to appropriate client instance
    if (!this.isClientMode && this.coordinator) {
      const allInstances = this.coordinator.getAllInstances();
      logger.info(`Server has ${allInstances.length} known instances for routing:`);
      allInstances.forEach(instance => {
        logger.info(`  Instance ${instance.instanceId}: workspace="${instance.workspacePath}", role=${instance.role}`);
      });
      logger.info(`Looking for workspace: "${requestedWorkspacePath}"`);
      
      const targetInstance = this.findInstanceByWorkspacePath(requestedWorkspacePath);
      if (targetInstance) {
        logger.info(`✓ Found matching instance: ${targetInstance.instanceId} (${targetInstance.workspacePath})`);
        return await this.routeToInstance(request, targetInstance);
      } else {
        logger.warn(`✗ No instance found with workspace: "${requestedWorkspacePath}"`);
      }
    }

    // No matching instance found in coordination system - try WebSocket clients directly
    if (this.mcpServer) {
      try {
        logger.info(`No coordination instance found, attempting direct WebSocket routing to: ${requestedWorkspacePath}`);
        const wsResponse = await this.mcpServer.routePopupToClient(requestedWorkspacePath, request);
        
        // Return response in the same MCP tool format as local case
        const mcpToolResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: `User selected: ${wsResponse.selectedValue}`
              }
            ]
          }
        };
        
        logger.info(`WebSocket routing successful, returning: ${wsResponse.selectedValue}`);
        return JSON.stringify(mcpToolResponse);
        
      } catch (wsError) {
        logger.warn(`Direct WebSocket routing also failed: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
      }
    }
    
    // No matching instance found anywhere - return error
    logger.warn(`No instance found for workspace path: ${requestedWorkspacePath}`);
    return this.createErrorResponse(
      request.id,
      -32000,
      'No matching VS Code instance found',
      { 
        error: 'No VS Code instance is currently running with the specified workspace path',
        requestedWorkspace: requestedWorkspacePath
      }
    );
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
   * Gets the current extension workspace path (fallback for when AI doesn't provide one)
   */
  private getExtensionWorkspacePath(): string {
    return this.extensionWorkspacePath;
  }

  /**
   * Checks if the requested workspace path matches this instance
   */
  private isWorkspaceMatch(requestedPath: string): boolean {
    const normalizedRequested = this.normalizeWorkspacePath(requestedPath);
    const normalizedCurrent = this.normalizeWorkspacePath(this.extensionWorkspacePath);
    return normalizedRequested === normalizedCurrent;
  }

  /**
   * Normalizes workspace paths for comparison (handles different path separators, etc.)
   */
  private normalizeWorkspacePath(workspacePath: string): string {
    if (!workspacePath) {return '';}
    // Convert to forward slashes and remove trailing slash
    const normalized = workspacePath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
    logger.debug(`Normalized workspace path: "${workspacePath}" -> "${normalized}"`);
    return normalized;
  }

  /**
   * Finds an instance by workspace path using the coordinator
   */
  private findInstanceByWorkspacePath(workspacePath: string): InstanceInfo | null {
    if (!this.coordinator) {
      return null;
    }

    const normalizedRequested = this.normalizeWorkspacePath(workspacePath);
    const instances = this.coordinator.getAllInstances();
    
    return instances.find(instance => {
      const normalizedInstance = this.normalizeWorkspacePath(instance.workspacePath);
      return normalizedInstance === normalizedRequested;
    }) || null;
  }

  /**
   * Routes a request to a specific instance
   */
  private async routeToInstance(request: JSONRPCRequest, targetInstance: InstanceInfo): Promise<string> {
    try {
      // For popup requests, try WebSocket routing first if available
      if ((request.method === 'triggerPopup' || 
           (request.method === 'tools/call' && request.params?.name === 'triggerPopup')) &&
          this.mcpServer) {
        
        try {
          logger.info(`Attempting WebSocket routing to instance ${targetInstance.instanceId} (workspace: ${targetInstance.workspacePath})`);
          
          // Create popup request object
          const popupRequest = this.createPopupRequestFromJsonRpc(request);
          
          // Try WebSocket routing
          const response = await this.mcpServer.routePopupToClient(targetInstance.workspacePath, popupRequest);
          
          // Format the response in MCP tool format
          return this.createSuccessResponse(request.id, {
            content: [
              {
                type: 'text',
                text: `User selected: ${response.selectedValue || response.response?.selectedValue || ''}`
              }
            ]
          });
          
        } catch (wsError) {
          logger.warn(`WebSocket routing failed for ${targetInstance.instanceId}: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
          // Fall through to HTTP routing
        }
      }

      // Fall back to HTTP routing
      if (targetInstance.httpPort) {
        logger.info(`Forwarding request via HTTP to instance ${targetInstance.instanceId}:${targetInstance.httpPort}`);
        const response = await this.makeHttpRequest(
          `http://localhost:${targetInstance.httpPort}/mcp`,
          request
        );
        return JSON.stringify(response);
      } else {
        // No HTTP port available - cannot route
        logger.warn(`Target instance ${targetInstance.instanceId} has no HTTP port for routing`);
        return this.createErrorResponse(
          request.id,
          -32000,
          'Target instance not accessible',
          { 
            error: 'Target VS Code instance does not have HTTP transport enabled and WebSocket routing failed',
            targetInstance: targetInstance.instanceId
          }
        );
      }
    } catch (error) {
      logger.error('Error routing to instance:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        'Request routing failed',
        { 
          error: error instanceof Error ? error.message : String(error),
          targetInstance: targetInstance.instanceId
        }
      );
    }
  }

  /**
   * Creates a popup request object from a JSON-RPC request
   */
  private createPopupRequestFromJsonRpc(request: JSONRPCRequest): any {
    let title: string;
    let message: string;
    let options: Array<{ label: string; value: string }> = [];
    let workspacePath: string;

    if (request.method === 'triggerPopup') {
      title = request.params.title;
      message = request.params.message;
      options = request.params.options || [];
      workspacePath = request.params.workspacePath || '';
    } else if (request.method === 'tools/call' && request.params?.name === 'triggerPopup') {
      const args = request.params.arguments;
      title = args.title;
      message = args.message;
      
      // Convert options from array of strings to array of objects if needed
      if (args.options && Array.isArray(args.options)) {
        // Options are already in the correct format from the schema
        options = args.options;
      }
      workspacePath = args.workspacePath || '';
    } else {
      throw new Error('Invalid request method for popup creation');
    }

    return {
      requestId: this.generateRequestId(),
      workspacePath,
      title,
      message,
      options
    };
  }

  /**
   * Makes an HTTP request to another instance
   */
  private async makeHttpRequest(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // http is now imported at the top
      const postData = JSON.stringify(data);
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(url, options, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: string) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error: Error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * Disposes of the request handler and cleans up resources
   */
  dispose(): void {
    this.responseHandler.dispose();
    this.popupTriggerCallback = undefined;
  }
}
