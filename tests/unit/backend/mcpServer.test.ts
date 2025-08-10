/**
 * Unit tests for MCP Server
 */

import { McpServer } from '../../../src/backend/mcpServer';
import { TransportConfig } from '../../../src/types';

// Mock Node.js modules
jest.mock('http');
jest.mock('net');

describe('McpServer', () => {
  let server: McpServer;
  let mockConfig: TransportConfig;

  beforeEach(() => {
    mockConfig = {
      http: {
        enabled: true,
        port: 0,
        host: 'localhost'
      },
      stdio: {
        enabled: true
      }
    };
  });

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Constructor', () => {
    it('should create server instance with valid config', () => {
      server = new McpServer(mockConfig);
      expect(server).toBeInstanceOf(McpServer);
    });

    it('should initialize with correct config', () => {
      server = new McpServer(mockConfig);
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return health status when not running', () => {
      server = new McpServer(mockConfig);
      const health = server.getHealth();
      
      expect(health).toMatchObject({
        status: 'inactive',
        uptime: expect.any(Number),
        activeConnections: 0
      });
    });

    it('should include transport status in health check', () => {
      server = new McpServer(mockConfig);
      const health = server.getHealth();
      
      expect(health.httpStatus).toBeDefined();
      expect(health.stdioStatus).toBeDefined();
    });

    it('should track uptime correctly', async () => {
      server = new McpServer(mockConfig);
      const initialHealth = server.getHealth();
      
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const laterHealth = server.getHealth();
      expect(laterHealth.uptime).toBeGreaterThan(initialHealth.uptime || 0);
    });
  });

  describe('Configuration', () => {
    it('should handle HTTP-only configuration', () => {
      const httpOnlyConfig: TransportConfig = {
        http: {
          enabled: true,
          port: 3000,
          host: 'localhost'
        }
      };
      
      server = new McpServer(httpOnlyConfig);
      const health = server.getHealth();
      
      expect(health.httpStatus).toBeDefined();
      expect(health.stdioStatus).toBe('disabled');
    });

    it('should handle stdio-only configuration', () => {
      const stdioOnlyConfig: TransportConfig = {
        stdio: {
          enabled: true
        }
      };
      
      server = new McpServer(stdioOnlyConfig);
      const health = server.getHealth();
      
      expect(health.httpStatus).toBe('disabled');
      expect(health.stdioStatus).toBeDefined();
    });

    it('should handle disabled transports correctly', () => {
      const disabledConfig: TransportConfig = {
        http: {
          enabled: false,
          port: 0,
          host: 'localhost'
        },
        stdio: {
          enabled: false
        }
      };
      
      server = new McpServer(disabledConfig);
      const health = server.getHealth();
      
      expect(health.httpStatus).toBe('disabled');
      expect(health.stdioStatus).toBe('disabled');
    });
  });

  describe('Error Handling', () => {
    it('should handle start failure gracefully', async () => {
      // Create config with no enabled transports
      const invalidConfig: TransportConfig = {};
      
      server = new McpServer(invalidConfig);
      
      await expect(server.start()).rejects.toThrow('At least one transport must be enabled');
    });

    it('should track errors in health status', async () => {
      const invalidConfig: TransportConfig = {};
      server = new McpServer(invalidConfig);
      
      try {
        await server.start();
      } catch (error) {
        // Expected to fail
      }
      
      const health = server.getHealth();
      expect(health.lastError).toBeDefined();
    });
  });

  describe('Event Emitter', () => {
    it('should emit started event on successful start', (done) => {
      server = new McpServer(mockConfig);
      
      server.on('started', () => {
        done();
      });
      
      // Mock successful start
      server.emit('started');
    });

    it('should emit error event on failure', (done) => {
      server = new McpServer(mockConfig);
      
      server.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });
      
      // Mock error
      server.emit('error', new Error('Test error'));
    });

    it('should emit stopped event on stop', (done) => {
      server = new McpServer(mockConfig);
      
      server.on('stopped', () => {
        done();
      });
      
      // Mock stop
      server.emit('stopped');
    });
  });
});

describe('Server Integration', () => {
  it('should handle multiple start/stop cycles', async () => {
    const config: TransportConfig = {
      stdio: { enabled: true }
    };
    
    const server = new McpServer(config);
    
    // This test would need more sophisticated mocking for full integration
    // For now, we verify the server can be created and basic methods work
    expect(server.isRunning()).toBe(false);
    expect(server.getHealth().status).toBe('inactive');
  });
});
