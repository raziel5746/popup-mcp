/**
 * Main MCP Server implementation with HTTP and stdio transports
 */

import * as net from 'net';
import * as http from 'http';
import { EventEmitter } from 'events';
import { TransportConfig, ServerHealth, TransportError } from '../types';
import { RequestHandler } from './requestHandler';
import { logger } from '../utils/logger';

/**
 * MCP Server class that handles both HTTP and stdio transports
 */
export class McpServer extends EventEmitter {
  private httpServer?: http.Server;
  private stdioActive = false;
  private requestHandler: RequestHandler;
  private startTime: number;
  private config: TransportConfig;
  private activeConnections = 0;
  private lastError?: string;

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

      // Stop HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((error) => {
            if (error) reject(error);
            else resolve();
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

      // Handle MCP endpoint
      if (req.url === '/mcp' && req.method === 'POST') {
        await this.handleMcpHttpRequest(req, res);
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
   * Handles MCP HTTP requests
   */
  private async handleMcpHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Read request body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const origin = req.headers.origin as string;
          const response = await this.requestHandler.handleRequest(body, origin);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(response);
        } catch (error) {
          logger.error('Error processing MCP request:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null
          }));
        }
      });
    } catch (error) {
      logger.error('MCP HTTP request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request processing failed' }));
    }
  }

  /**
   * Handles health check HTTP requests
   */
  private async handleHealthHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const health = this.getHealth();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
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
    if (!this.config.http?.enabled) return 'disabled';
    if (this.httpServer?.listening) return 'listening';
    return 'error';
  }

  /**
   * Gets stdio transport status
   */
  private getStdioStatus(): 'active' | 'error' | 'disabled' {
    if (!this.config.stdio?.enabled) return 'disabled';
    if (this.stdioActive) return 'active';
    return 'error';
  }
}
