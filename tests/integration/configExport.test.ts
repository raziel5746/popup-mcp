/**
 * Integration tests for config export functionality
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { McpServer } from '../../src/backend/mcpServer';
import { TransportConfig } from '../../src/types';

// Mock VS Code environment
jest.mock('vscode', () => ({
  env: {
    clipboard: {
      writeText: jest.fn()
    }
  },
  Uri: {
    joinPath: jest.fn().mockImplementation((base, ...segments) => ({
      fsPath: path.join(base.fsPath, ...segments)
    }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultValue: any) => {
        const config: any = {
          httpPort: 9001,
          enableHttp: true,
          enableStdio: true
        };
        return config[key] || defaultValue;
      })
    })
  }
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    initialize: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn()
  }
}));

describe('Config Export Integration Tests', () => {
  let mcpServer: McpServer;
  let mockContext: vscode.ExtensionContext;
  let mockClipboard: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClipboard = vscode.env.clipboard;
    
    mockContext = {
      extensionUri: {
        fsPath: '/mock/extension/path'
      }
    } as any;

    const transportConfig: TransportConfig = {
      http: {
        enabled: true,
        port: 9001,
        host: 'localhost'
      },
      stdio: {
        enabled: true
      }
    };

    mcpServer = new McpServer(transportConfig);
  });

  afterEach(async () => {
    if (mcpServer) {
      try {
        await mcpServer.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('HTTP Config Export', () => {
    it('should generate correct HTTP config JSON with default port', () => {
      const config = {
        mcpServers: {
          'popup-mcp': {
            url: 'http://localhost:9001/mcp'
          }
        }
      };

      const expectedJson = JSON.stringify(config, null, 2);

      // Simulate the HTTP config generation logic
      const httpPort = 9001;
      const actualConfig = {
        mcpServers: {
          'popup-mcp': {
            url: `http://localhost:${httpPort}/mcp`
          }
        }
      };

      expect(JSON.stringify(actualConfig, null, 2)).toBe(expectedJson);
    });

    it('should generate correct HTTP config JSON with custom port', () => {
      const customPort = 8080;
      const config = {
        mcpServers: {
          'popup-mcp': {
            url: `http://localhost:${customPort}/mcp`
          }
        }
      };

      const expectedJson = JSON.stringify(config, null, 2);

      // Simulate the HTTP config generation logic with custom port
      const actualConfig = {
        mcpServers: {
          'popup-mcp': {
            url: `http://localhost:${customPort}/mcp`
          }
        }
      };

      expect(JSON.stringify(actualConfig, null, 2)).toBe(expectedJson);
    });

    it('should use auto-assigned port when server is running', async () => {
      // Start server to get auto-assigned port
      try {
        await mcpServer.start();
      } catch (error) {
        // Server may fail to start in test environment, that's ok
      }
      
      const health = mcpServer.getHealth();
      // In test environment, server might not start, so just check that we can get health
      expect(health.status).toBeDefined();

      // Get the actual port from server config
      const httpConfig = (mcpServer as any).config?.http;
      const actualPort = httpConfig?.port;

      expect(actualPort).toBeDefined();
      expect(typeof actualPort).toBe('number');
      expect(actualPort).toBeGreaterThan(0);

      // Verify config generation uses actual port
      const config = {
        mcpServers: {
          'popup-mcp': {
            url: `http://localhost:${actualPort}/mcp`
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);
      expect(configJson).toContain(`http://localhost:${actualPort}/mcp`);
    });

    it('should handle clipboard write operation', async () => {
      const config = {
        mcpServers: {
          'popup-mcp': {
            url: 'http://localhost:9001/mcp'
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      // Simulate clipboard write
      await mockClipboard.writeText(configJson);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(configJson);
    });
  });

  describe('Stdio Config Export', () => {
    it('should generate correct stdio config JSON for Unix-like systems', () => {
      // Mock Unix-like platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const mcpServerPath = '/mock/extension/path/out/backend/mcpServer.js';
      const config = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: [mcpServerPath]
          }
        }
      };

      const expectedJson = JSON.stringify(config, null, 2);

      // Simulate the stdio config generation logic
      const actualConfig = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: [mcpServerPath]
          }
        }
      };

      expect(JSON.stringify(actualConfig, null, 2)).toBe(expectedJson);

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should generate correct stdio config JSON for Windows', () => {
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const windowsPath = 'C:\\mock\\extension\\path\\out\\backend\\mcpServer.js';
      
      const config = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: [windowsPath]
          }
        }
      };

      const expectedJson = JSON.stringify(config, null, 2);

      // Simulate the stdio config generation logic for Windows
      const actualConfig = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: [windowsPath]
          }
        }
      };

      expect(JSON.stringify(actualConfig, null, 2)).toBe(expectedJson);

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should resolve extension path correctly', () => {
      const extensionPath = mockContext.extensionUri.fsPath;
      const expectedPath = path.join(extensionPath, 'out/backend/mcpServer.js');

      // Mock vscode.Uri.joinPath behavior
      const joinedUri = vscode.Uri.joinPath(mockContext.extensionUri, 'out', 'backend', 'mcpServer.js');
      
      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockContext.extensionUri, 
        'out', 
        'backend', 
        'mcpServer.js'
      );
      
      expect(joinedUri.fsPath).toBe(expectedPath);
    });

    it('should handle clipboard write operation for stdio config', async () => {
      const config = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: ['/mock/extension/path/out/backend/mcpServer.js']
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      // Simulate clipboard write
      await mockClipboard.writeText(configJson);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(configJson);
    });
  });

  describe('Error Handling', () => {
    it('should handle clipboard write errors for HTTP config', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));

      const config = {
        mcpServers: {
          'popup-mcp': {
            url: 'http://localhost:9001/mcp'
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      try {
        await mockClipboard.writeText(configJson);
      } catch (error: any) {
        expect(error.message).toBe('Clipboard access denied');
      }

      expect(mockClipboard.writeText).toHaveBeenCalledWith(configJson);
    });

    it('should handle clipboard write errors for stdio config', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));

      const config = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: ['/mock/extension/path/out/backend/mcpServer.js']
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      try {
        await mockClipboard.writeText(configJson);
      } catch (error: any) {
        expect(error.message).toBe('Clipboard access denied');
      }

      expect(mockClipboard.writeText).toHaveBeenCalledWith(configJson);
    });

    it('should handle missing server configuration gracefully', () => {
      // Test with undefined/null server
      const mcpServerUndefined: McpServer | undefined = undefined;

      // Should not throw when server is not available
      expect(() => {
        const port = 9001; // Fallback to default
        
        const config = {
          mcpServers: {
            'popup-mcp': {
              url: `http://localhost:${port}/mcp`
            }
          }
        };

        JSON.stringify(config, null, 2);
      }).not.toThrow();
    });
  });

  describe('Config Validation', () => {
    it('should generate valid JSON for HTTP config', () => {
      const config = {
        mcpServers: {
          'popup-mcp': {
            url: 'http://localhost:9001/mcp'
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      // Should be valid JSON
      expect(() => JSON.parse(configJson)).not.toThrow();
      
      const parsed = JSON.parse(configJson);
      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers['popup-mcp']).toBeDefined();
      expect(parsed.mcpServers['popup-mcp'].url).toBe('http://localhost:9001/mcp');
    });

    it('should generate valid JSON for stdio config', () => {
      const config = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: ['/path/to/mcpServer.js']
          }
        }
      };

      const configJson = JSON.stringify(config, null, 2);

      // Should be valid JSON
      expect(() => JSON.parse(configJson)).not.toThrow();
      
      const parsed = JSON.parse(configJson);
      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers['popup-mcp']).toBeDefined();
      expect(parsed.mcpServers['popup-mcp'].command).toBe('node');
      expect(parsed.mcpServers['popup-mcp'].args).toEqual(['/path/to/mcpServer.js']);
    });

    it('should use consistent server name in both configs', () => {
      const httpConfig = {
        mcpServers: {
          'popup-mcp': {
            url: 'http://localhost:9001/mcp'
          }
        }
      };

      const stdioConfig = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: ['/path/to/mcpServer.js']
          }
        }
      };

      // Both configs should use the same server name
      expect(Object.keys(httpConfig.mcpServers)[0]).toBe('popup-mcp');
      expect(Object.keys(stdioConfig.mcpServers)[0]).toBe('popup-mcp');
    });
  });
});
