/**
 * Main MCP Server implementation with HTTP and stdio transports
 */

import * as net from 'net';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import { McpServer as SdkMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TransportConfig, ServerHealth, TransportError } from '../types';
import { RequestHandler } from './requestHandler';
import { logger } from '../utils/logger';

/**
 * MCP Server class that handles both HTTP and stdio transports
 */
export class McpServer extends EventEmitter {
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;
  private popupWsServer?: WebSocketServer;
  private clientConnections = new Map<string, WebSocket>(); // workspace -> websocket
  private streamableHttpSessions = new Map<string, {
    transport: StreamableHTTPServerTransport;
    server: SdkMcpServer;
  }>();
  private stdioActive = false;
  private requestHandler: RequestHandler;
  private startTime: number;
  private config: TransportConfig;
  private activeConnections = 0;
  private lastError?: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private instanceId?: string;
  private workspacePath?: string;

  constructor(config: TransportConfig) {
    super();
    this.config = config;
    this.requestHandler = new RequestHandler();
    this.startTime = Date.now();
  }

  /**
   * Starts the MCP server with configured transports
   */
  async start(): Promise<void> {
    try {
      logger.info('MCP Server starting with config:', this.config);

      // Setup HTTP transport if enabled
      if (this.config.http?.enabled) {
        await this.setupHttpTransport();
      }

      // Setup stdio transport if enabled
      if (this.config.stdio?.enabled) {
        await this.setupStdioTransport();
      }

      if (!this.config.http?.enabled && !this.config.stdio?.enabled) {
        throw new TransportError('At least one transport must be enabled');
      }

      logger.info('MCP Server started successfully');
      this.emit('started');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      logger.error('MCP Server failed to start:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stops the MCP server and cleans up resources
   */
  async stop(): Promise<void> {
    try {
      logger.info('MCP Server stopping...');

      // Stop heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Stop popup WebSocket server
      if (this.popupWsServer) {
        try {
          this.popupWsServer.close();
        } catch (error) {
          logger.error('Error closing popup WebSocket server:', error);
        }
        this.popupWsServer = undefined;
      }

      // Clear client connections
      this.clientConnections.clear();

      // Stop WebSocket server
      if (this.wsServer) {
        try {
          this.wsServer.close();
        } catch (error) {
          logger.error('Error closing WebSocket server:', error);
        }
        this.wsServer = undefined;
      }

      // Stop HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((error) => {
            if (error) {reject(error);}
            else {resolve();}
          });
        });
        this.httpServer = undefined;
      }

      // Stop stdio transport
      if (this.stdioActive) {
        // Remove stdio listeners
        process.stdin.removeAllListeners('data');
        this.stdioActive = false;
      }

      // Dispose request handler
      this.requestHandler.dispose();

      logger.info('MCP Server stopped successfully');
      this.emit('stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      logger.error('MCP Server error during stop:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Gets current server health status
   */
  getHealth(): ServerHealth {
    const uptime = Date.now() - this.startTime;
    
    return {
      status: this.isRunning() ? 'active' : 'inactive',
      httpStatus: this.getHttpStatus(),
      stdioStatus: this.getStdioStatus(),
      uptime,
      activeConnections: this.activeConnections,
      ...(this.lastError && { lastError: this.lastError })
    };
  }

  /**
   * Checks if the server is currently running
   */
  isRunning(): boolean {
    const httpRunning = this.config.http?.enabled ? this.httpServer?.listening : true;
    const stdioRunning = this.config.stdio?.enabled ? this.stdioActive : true;
    
    return !!(httpRunning && stdioRunning);
  }

  /**
   * Gets the request handler instance for setting up callbacks
   */
  getRequestHandler(): RequestHandler {
    return this.requestHandler;
  }

  /**
   * Sets the instance ID for coordination
   */
  setInstanceId(instanceId: string): void {
    this.instanceId = instanceId;
  }

  /**
   * Gets the instance ID
   */
  getInstanceId(): string {
    return this.instanceId || 'unknown';
  }

  /**
   * Sets the workspace path for coordination
   */
  setWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath;
  }

  /**
   * Gets the workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath || '';
  }

  /**
   * Normalizes workspace path for consistent comparison
   */
  private normalizeWorkspacePath(path: string): string {
    return path.toLowerCase().replace(/\\/g, '/');
  }

  /**
   * Routes a popup request to a client via WebSocket
   */
  async routePopupToClient(workspacePath: string, popupRequest: any): Promise<any> {
    // Normalize the workspace path for consistent lookup
    const normalizedPath = this.normalizeWorkspacePath(workspacePath);
    const ws = this.clientConnections.get(normalizedPath);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Client not connected');
    }

    return new Promise((resolve/* , reject */) => {
      // const timeout = setTimeout(() => {
      //   reject(new Error('Popup request timeout'));
      // }, 30000);

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          // Extract request ID from popup request (could be .id or .requestId)
          const expectedId = popupRequest.requestId || popupRequest.id;
          logger.info(`Checking WebSocket response: received ID "${response.requestId}" (${typeof response.requestId}), expected ID "${expectedId}" (${typeof expectedId})`);
          // Use loose equality to handle string vs number comparison
          if (response.requestId == expectedId) {
            logger.info(`WebSocket response matched! Selected value: ${response.selectedValue}`);
            // clearTimeout(timeout);
            ws.off('message', responseHandler);
            resolve(response);
          } else {
            logger.warn(`WebSocket response ID mismatch: received "${response.requestId}", expected "${expectedId}"`);
          }
        } catch (error) {
          logger.error('Error parsing WebSocket response:', error);
        }
      };

      ws.on('message', responseHandler);
      // Send popup request to client
      const requestToSend = {
        type: 'popup_request',
        ...popupRequest
      };
      
      logger.info('Sending popup request via WebSocket:', JSON.stringify(requestToSend, null, 2));
      ws.send(JSON.stringify(requestToSend));
    });
  }

  /**
   * Sets up WebSocket server for stdio MCP server communication
   */
  private setupWebSocketServer(): void {
    if (!this.httpServer) {return;}

    // Use noServer: true for proper HTTP server sharing
    this.wsServer = new WebSocket.Server({ 
      noServer: true
    });

    this.wsServer.on('connection', (ws) => {
      logger.info('WebSocket connection established with stdio MCP server');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.info('Received message from stdio MCP server:', message);

          if (message.type === 'popup_request') {
            // Handle popup request from stdio MCP server
            await this.handleStdioPopupRequest(ws, message);
          }
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('WebSocket server setup complete on /ws endpoint');
  }

  /**
   * Sets up popup WebSocket server for client instance communication
   */
  private setupPopupWebSocketServer(): void {
    if (!this.httpServer) {return;}

    // Use noServer: true for proper HTTP server sharing
    this.popupWsServer = new WebSocketServer({ 
      noServer: true
    });

    // Handle the 'upgrade' event to route WebSocket requests to both /ws and /popup-ws
    this.httpServer.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url || '', 'ws://localhost');
      
      logger.info(`WebSocket upgrade request to: ${pathname}`);
      
      if (pathname === '/ws') {
        logger.info('Handling WebSocket upgrade for /ws (stdio MCP)');
        this.wsServer!.handleUpgrade(request, socket, head, (ws) => {
          this.wsServer!.emit('connection', ws, request);
        });
      } else if (pathname === '/popup-ws') {
        logger.info('Handling WebSocket upgrade for /popup-ws (popup routing)');
        this.popupWsServer!.handleUpgrade(request, socket, head, (ws) => {
          this.popupWsServer!.emit('connection', ws, request);
        });
      } else {
        logger.warn(`Unknown WebSocket path: ${pathname}, destroying socket`);
        socket.destroy();
      }
    });

    this.popupWsServer.on('connection', (ws, request) => {
      logger.info('Popup WebSocket connection established from:', request.socket.remoteAddress);

      // Add error handler immediately
      ws.on('error', (error) => {
        logger.error('Popup WebSocket error:', error);
      });

      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'register') {
            // Register client connection with normalized path for consistent lookup
            const normalizedPath = this.normalizeWorkspacePath(message.workspacePath);
            this.clientConnections.set(normalizedPath, ws);
            logger.info(`Client registered: ${message.workspacePath} (normalized: ${normalizedPath})`);
          } else if (message.type === 'popup_response') {
            // Handle popup response from client - this is handled by the promise in routePopupToClient
            logger.info(`Received popup response from client: ${message.selectedValue} (request: ${message.requestId})`);
          }
        } catch (error) {
          logger.error('Error handling popup WebSocket message:', error);
        }
      });
      
      // Clean up on disconnect
      ws.on('close', () => {
        this.removeClientConnection(ws);
        logger.info('Popup WebSocket connection closed');
      });
      
      // Setup heartbeat
      (ws as any).isAlive = true;
      ws.on('pong', () => { 
        (ws as any).isAlive = true; 
      });
    });

    // Start heartbeat interval - ping clients every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.popupWsServer) {
        this.popupWsServer.clients.forEach(ws => {
          if (!(ws as any).isAlive) {
            return ws.terminate();
          }
          (ws as any).isAlive = false;
          ws.ping();
        });
      }
    }, 30000);

    logger.info('Popup WebSocket server setup complete on /popup-ws endpoint');
  }

  /**
   * Removes a client connection from the connections map
   */
  private removeClientConnection(ws: WebSocket): void {
    for (const [workspacePath, connection] of this.clientConnections.entries()) {
      if (connection === ws) {
        this.clientConnections.delete(workspacePath);
        logger.info(`Client connection removed: ${workspacePath}`);
        break;
      }
    }
  }

  /**
   * Handle popup request from stdio MCP server
   */
  private async handleStdioPopupRequest(ws: WebSocket, message: any): Promise<void> {
    try {
      const { requestId, options } = message;
      
      // Get the popup trigger callback
      const popupCallback = this.requestHandler.getPopupTriggerCallback();
      if (!popupCallback) {
        ws.send(JSON.stringify({
          type: 'response',
          requestId,
          error: 'Popup system not available'
        }));
        return;
      }

      // Create popup request
      const popupRequest = {
        requestId: `stdio_${requestId}`,
        workspacePath: options.workspacePath || '', // Use provided workspace path or empty string
        title: options.title,
        message: options.message,
        options: options.options || []
      };

      logger.info('Creating stdio popup request:', {
        requestId: popupRequest.requestId,
        workspacePath: popupRequest.workspacePath || 'Empty',
        title: popupRequest.title
      });

      // Trigger popup and wait for response
      await popupCallback(popupRequest, {
        handlePopupResponse: async (response: any) => {
          ws.send(JSON.stringify({
            type: 'response',
            requestId,
            response
          }));
        }
      } as any);

    } catch (error) {
      logger.error('Error handling stdio popup request:', error);
      ws.send(JSON.stringify({
        type: 'response',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Sets up HTTP transport
   */
  private async setupHttpTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = http.createServer(async (req, res) => {
          await this.handleHttpRequest(req, res);
        });

        this.httpServer.on('connection', () => {
          this.activeConnections++;
        });

        this.httpServer.on('close', () => {
          if (this.activeConnections > 0) {
            this.activeConnections--;
          }
        });

        const port = this.config.http!.port || 0; // 0 = auto-assign
        const host = this.config.http!.host || 'localhost';

        this.httpServer.listen(port, host, () => {
          const address = this.httpServer!.address() as net.AddressInfo;
          logger.info(`HTTP transport listening on ${host}:${address.port}`);
          
          // Update config with actual port if auto-assigned
          if (this.config.http) {
            this.config.http.port = address.port;
          }
          
          // Setup WebSocket server for stdio MCP server communication
          this.setupWebSocketServer();
          
          // Setup popup WebSocket server for client communication
          this.setupPopupWebSocketServer();
          
          resolve();
        });

        this.httpServer.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.lastError = `HTTP transport error: ${errorMessage}`;
          logger.error('HTTP transport error:', error);
          reject(new TransportError(`HTTP transport failed: ${errorMessage}`));
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reject(new TransportError(`Failed to setup HTTP transport: ${errorMessage}`));
      }
    });
  }

  /**
   * Sets up stdio transport
   */
  private async setupStdioTransport(): Promise<void> {
    try {
      // Set up stdin listener for JSON-RPC messages
      process.stdin.setEncoding('utf8');
      
      let buffer = '';
      
      process.stdin.on('data', (chunk: string) => {
        buffer += chunk;
        
        // Process complete lines (JSON-RPC messages)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            this.handleStdioMessage(line.trim());
          }
        }
      });

      this.stdioActive = true;
      logger.info('Stdio transport active');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TransportError(`Failed to setup stdio transport: ${errorMessage}`);
    }
  }

  /**
   * Handles HTTP requests
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Handle MCP endpoint via Streamable HTTP transport (supports SSE)
      if (req.url === '/mcp' && (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE')) {
        await this.handleMcpStreamableHttpRequest(req, res);
        return;
      }

      // Handle health endpoint
      if (req.url === '/health' && req.method === 'GET') {
        await this.handleHealthHttpRequest(req, res);
        return;
      }

      // 404 for other endpoints
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      logger.error('HTTP request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handles MCP requests over Streamable HTTP transport (with optional SSE)
   */
  private async handleMcpStreamableHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = (Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader) as string | undefined;

      if (req.method === 'POST') {
        let bodyText = '';
        req.on('data', (chunk) => {
          bodyText += chunk.toString();
        });

        req.on('end', async () => {
          let bodyJson: any;
          try {
            bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            return;
          }

          try {
            const { transport } = await this.getOrCreateStreamableHttpSession(sessionId, bodyJson);
            await transport.handleRequest(req as any, res as any, bodyJson);
          } catch (error) {
            logger.error('Error processing Streamable HTTP MCP request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal error' },
              id: null
            }));
          }
        });

        return;
      }

      // GET/DELETE are session-based
      if (!sessionId || !this.streamableHttpSessions.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }

      const session = this.streamableHttpSessions.get(sessionId);
      await session!.transport.handleRequest(req as any, res as any);
    } catch (error) {
      logger.error('MCP Streamable HTTP request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request processing failed' }));
    }
  }

  private async getOrCreateStreamableHttpSession(sessionId: string | undefined, bodyJson: any): Promise<{
    transport: StreamableHTTPServerTransport;
    server: SdkMcpServer;
  }> {
    if (sessionId && this.streamableHttpSessions.has(sessionId)) {
      return this.streamableHttpSessions.get(sessionId)!;
    }

    // Only allow new sessions on initialize
    if (sessionId) {
      throw new Error('Invalid session');
    }

    if (!isInitializeRequest(bodyJson)) {
      throw new Error('Invalid session');
    }

    const sdkServer = new SdkMcpServer({
      name: 'popup-mcp',
      version: '0.1.0',
      capabilities: {
        tools: {}
      }
    });

    // Register tool that bridges to the extension popup system
    sdkServer.registerTool(
      'triggerPopup',
      {
        title: 'Trigger Popup',
        description: 'Trigger a popup in VS Code for user input. Shows a dialog with title, message, and optional buttons for user interaction.',
        inputSchema: {
          title: z.string().describe('Title of the popup'),
          message: z.string().describe('Message to display to the user'),
          options: z.array(z.object({
            value: z.string().describe('The value returned when this option is selected'),
            label: z.string().describe('The display text shown to the user')
          })).optional().describe('Array of button options for user selection.'),
          workspacePath: z.string().describe('Required workspace path to target specific VS Code instance.')
        }
      },
      async ({ title, message, options, workspacePath }) => {
        const jsonrpcRequest = {
          jsonrpc: '2.0',
          id: `sdk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          method: 'triggerPopup',
          params: {
            title,
            message,
            options: options || [],
            workspacePath
          }
        } as any;

        const responseText = await this.requestHandler.handleTriggerPopup(jsonrpcRequest);
        const response = JSON.parse(responseText);
        const selectedValue = response?.result?.selectedValue;

        return {
          content: [
            {
              type: 'text',
              text: `User selected: ${selectedValue}`
            }
          ],
          structuredContent: {
            selectedValue
          }
        };
      }
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        const existing = this.streamableHttpSessions.get(id);
        if (!existing) {
          this.streamableHttpSessions.set(id, { transport, server: sdkServer });
        }
      },
      onsessionclosed: (id) => {
        this.streamableHttpSessions.delete(id);
      }
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        this.streamableHttpSessions.delete(transport.sessionId);
      }
    };

    await sdkServer.connect(transport);
    if (transport.sessionId) {
      this.streamableHttpSessions.set(transport.sessionId, { transport, server: sdkServer });
    }

    return { transport, server: sdkServer };
  }

  /**
   * Handles health check HTTP requests
   */
  private async handleHealthHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const health = this.getHealth();
      
      // Add instance information for coordination
      const healthWithInstance = {
        ...health,
        instanceId: this.getInstanceId(),
        workspacePath: this.getWorkspacePath(),
        role: 'server-active'
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthWithInstance));
    } catch (error) {
      logger.error('Health check error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Health check failed' }));
    }
  }

  /**
   * Handles stdio messages
   */
  private async handleStdioMessage(message: string): Promise<void> {
    try {
      const response = await this.requestHandler.handleRequest(message);
      
      // Send response to stdout
      process.stdout.write(response + '\n');
    } catch (error) {
      logger.error('Stdio message error:', error);
      
      // Send error response to stdout
      const errorResponse = {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  /**
   * Gets HTTP transport status
   */
  private getHttpStatus(): 'listening' | 'error' | 'disabled' {
    if (!this.config.http?.enabled) {return 'disabled';}
    if (this.httpServer?.listening) {return 'listening';}
    return 'error';
  }

  /**
   * Gets stdio transport status
   */
  private getStdioStatus(): 'active' | 'error' | 'disabled' {
    if (!this.config.stdio?.enabled) {return 'disabled';}
    if (this.stdioActive) {return 'active';}
    return 'error';
  }
}
