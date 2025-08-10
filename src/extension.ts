/**
 * Main VS Code extension entry point
 * Activates and manages the MCP server lifecycle
 */

import * as vscode from 'vscode';
import { McpServer } from './backend/mcpServer';
import { TransportConfig, ExtensionConfig, PopupRequest } from './types';
import { logger } from './utils/logger';
import { PopupWebview } from './components/PopupWebview';
import { ChimePlayer } from './utils/chimePlayer';

let mcpServer: McpServer | undefined;
let popupWebview: PopupWebview | undefined;
let chimePlayer: ChimePlayer | undefined;

/**
 * Extension activation function - called when VS Code starts or extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize logger first
    logger.initialize();
    logger.info('Extension activating...');
    logger.info('Popup MCP Extension starting...');
    
    // Load configuration
    const config = loadConfiguration();
    
    // Initialize popup components
    popupWebview = new PopupWebview(context.extensionUri, context);
    chimePlayer = new ChimePlayer(context.extensionUri, context);
    
    // Create and start MCP server
    const transportConfig = createTransportConfig(config);
    mcpServer = new McpServer(transportConfig);
    
    // Set up server event handlers
    setupServerEventHandlers();
    
    // Start the server
    await mcpServer.start();
    
    // Register commands
    registerCommands(context);
    
    // Register configuration change handler
    registerConfigurationHandler();
    
    logger.info('Extension activated successfully');
    
  } catch (error) {
    const errorMessage = `Failed to activate Popup MCP Extension: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    logger.show();
    
    vscode.window.showErrorMessage(errorMessage);
    throw error;
  }
}

/**
 * Extension deactivation function - called when VS Code shuts down or extension is disabled
 */
export async function deactivate(): Promise<void> {
  try {
    logger.info('Extension deactivating...');
    
    logger.info('Popup MCP Extension shutting down...');
    
    // Stop MCP server
    if (mcpServer) {
      await mcpServer.stop();
      mcpServer = undefined;
    }
    
    // Dispose popup components
    if (popupWebview) {
      popupWebview.dispose();
      popupWebview = undefined;
    }
    
    if (chimePlayer) {
      chimePlayer.dispose();
      chimePlayer = undefined;
    }
    
    logger.info('Extension deactivated successfully');
    logger.dispose();
    
  } catch (error) {
    logger.error('Error during deactivation:', error);
  }
}

/**
 * Loads extension configuration from VS Code settings
 */
function loadConfiguration(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('popupmcp');
  
  return {
    chimeEnabled: config.get('chimeEnabled', true),
    popupTimeout: 30, // Will be implemented in future stories
    httpPort: config.get('httpPort', 0),
    enableStdio: config.get('enableStdio', true),
    enableHttp: config.get('enableHttp', true),
    logLevel: config.get('logLevel', 'info')
  };
}

/**
 * Creates transport configuration from extension settings
 */
function createTransportConfig(config: ExtensionConfig): TransportConfig {
  return {
    http: config.enableHttp ? {
      enabled: true,
      port: config.httpPort,
      host: 'localhost' // Always bind to localhost for security
    } : undefined,
    stdio: config.enableStdio ? {
      enabled: true
    } : undefined
  };
}

/**
 * Sets up event handlers for the MCP server
 */
function setupServerEventHandlers(): void {
  if (!mcpServer) return;
  
  mcpServer.on('started', () => {
    logger.info('MCP Server started successfully');
    
    const health = mcpServer!.getHealth();
    if (health.httpStatus === 'listening') {
      // Get the actual port from server config
      const httpConfig = (mcpServer as any).config?.http;
      const port = httpConfig?.port || 'unknown';
      logger.info(`HTTP transport listening on localhost:${port}`);
      
      // Show info message with server details
      vscode.window.showInformationMessage(
        `Popup MCP Server started on localhost:${port}`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          logger.show();
        }
      });
    }
    
    if (health.stdioStatus === 'active') {
      logger.info('Stdio transport active');
    }
  });
  
  mcpServer.on('stopped', () => {
    logger.info('MCP Server stopped');
  });
  
  mcpServer.on('error', (error) => {
    const errorMessage = `MCP Server error: ${error.message}`;
    logger.error(errorMessage);
    
    // Show error to user
    vscode.window.showErrorMessage(errorMessage, 'Show Output').then(selection => {
      if (selection === 'Show Output') {
        logger.show();
      }
    });
  });
}

/**
 * Registers VS Code commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Health check command
  const healthCheckCommand = vscode.commands.registerCommand('popupmcp.checkHealth', async () => {
    try {
      if (!mcpServer) {
        vscode.window.showWarningMessage('MCP Server is not running');
        return;
      }
      
      const health = mcpServer.getHealth();
      const healthInfo = [
        `Status: ${health.status}`,
        `HTTP: ${health.httpStatus || 'disabled'}`,
        `Stdio: ${health.stdioStatus || 'disabled'}`,
        `Uptime: ${Math.round((health.uptime || 0) / 1000)}s`,
        `Active Connections: ${health.activeConnections || 0}`
      ];
      
      if (health.lastError) {
        healthInfo.push(`Last Error: ${health.lastError}`);
      }
      
      vscode.window.showInformationMessage(
        `MCP Server Health: ${healthInfo.join(', ')}`,
        'Show Details'
      ).then(selection => {
        if (selection === 'Show Details') {
          logger.show();
          logger.info('=== Server Health Check ===');
          healthInfo.forEach(info => logger.info(info));
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Server status command
  const statusCommand = vscode.commands.registerCommand('popupmcp.showServerStatus', () => {
    if (!mcpServer) {
      vscode.window.showWarningMessage('MCP Server is not running');
      return;
    }
    
    logger.show();
    logger.info('=== MCP Server Status ===');
    
    const health = mcpServer.getHealth();
    logger.info(`Overall Status: ${health.status}`);
    logger.info(`HTTP Transport: ${health.httpStatus || 'disabled'}`);
    logger.info(`Stdio Transport: ${health.stdioStatus || 'disabled'}`);
    logger.info(`Uptime: ${Math.round((health.uptime || 0) / 1000)} seconds`);
    logger.info(`Active Connections: ${health.activeConnections || 0}`);
    
    if (health.lastError) {
      logger.info(`Last Error: ${health.lastError}`);
    }
    
    // Show current configuration
    const config = loadConfiguration();
    logger.info('--- Configuration ---');
    logger.info(`HTTP Enabled: ${config.enableHttp}`);
    logger.info(`HTTP Port: ${config.httpPort || 'auto'}`);
    logger.info(`Stdio Enabled: ${config.enableStdio}`);
    logger.info(`Log Level: ${config.logLevel}`);
  });
  
  // Test popup command
  const testPopupCommand = vscode.commands.registerCommand('popupmcp.testPopup', async () => {
    try {
      if (!popupWebview || !chimePlayer) {
        vscode.window.showErrorMessage('Popup components not initialized');
        return;
      }
      
      // Create sample popup request
      const sampleRequest: PopupRequest = {
        requestId: `test-${Date.now()}`,
        workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'No workspace',
        title: 'Test Popup',
        message: 'This is a sample popup to test the functionality.\n\nYou can click a button or enter custom text.',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
          { label: 'Maybe', value: 'maybe' }
        ]
      };
      
      // Play chime if enabled
      await chimePlayer.playChime();
      
      // Show popup and handle response
      await popupWebview.renderPopup(sampleRequest, (response) => {
        logger.info(`Test popup response: ${response.selectedValue}`);
        vscode.window.showInformationMessage(
          `Popup response received: "${response.selectedValue}"`,
          'Show Output'
        ).then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
      });
      
    } catch (error) {
      const errorMessage = `Failed to show test popup: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
    }
  });
  
  // Add commands to context subscriptions for proper cleanup
  context.subscriptions.push(healthCheckCommand, statusCommand, testPopupCommand);
}

/**
 * Registers configuration change handler to restart server when needed
 */
function registerConfigurationHandler(): void {
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('popupmcp')) {
      logger.info('Configuration changed, restarting MCP server...');
      
      try {
        // Stop existing server
        if (mcpServer) {
          await mcpServer.stop();
        }
        
        // Load new configuration and restart
        const config = loadConfiguration();
        const transportConfig = createTransportConfig(config);
        mcpServer = new McpServer(transportConfig);
        
        setupServerEventHandlers();
        await mcpServer.start();
        
        logger.info('MCP server restarted with new configuration');
        
      } catch (error) {
        const errorMessage = `Failed to restart MCP server: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
      }
    }
  });
}
