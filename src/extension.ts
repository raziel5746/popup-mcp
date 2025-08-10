/**
 * Main VS Code extension entry point
 * Activates and manages the MCP server lifecycle
 */

import * as vscode from 'vscode';
import { McpServer } from './backend/mcpServer';
import { TransportConfig, ExtensionConfig } from './types';

let mcpServer: McpServer | undefined;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation function - called when VS Code starts or extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    console.log('[Popup MCP] Extension activating...');
    
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Popup MCP');
    outputChannel.appendLine('Popup MCP Extension starting...');
    
    // Load configuration
    const config = loadConfiguration();
    
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
    
    outputChannel.appendLine('Popup MCP Extension activated successfully');
    console.log('[Popup MCP] Extension activated successfully');
    
  } catch (error) {
    const errorMessage = `Failed to activate Popup MCP Extension: ${error instanceof Error ? error.message : String(error)}`;
    console.error('[Popup MCP]', errorMessage);
    
    if (outputChannel) {
      outputChannel.appendLine(`ERROR: ${errorMessage}`);
      outputChannel.show();
    }
    
    vscode.window.showErrorMessage(errorMessage);
    throw error;
  }
}

/**
 * Extension deactivation function - called when VS Code shuts down or extension is disabled
 */
export async function deactivate(): Promise<void> {
  try {
    console.log('[Popup MCP] Extension deactivating...');
    
    if (outputChannel) {
      outputChannel.appendLine('Popup MCP Extension shutting down...');
    }
    
    // Stop MCP server
    if (mcpServer) {
      await mcpServer.stop();
      mcpServer = undefined;
    }
    
    // Dispose output channel
    if (outputChannel) {
      outputChannel.dispose();
    }
    
    console.log('[Popup MCP] Extension deactivated successfully');
    
  } catch (error) {
    console.error('[Popup MCP] Error during deactivation:', error);
    
    if (outputChannel) {
      outputChannel.appendLine(`ERROR during shutdown: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Loads extension configuration from VS Code settings
 */
function loadConfiguration(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('popupmcp');
  
  return {
    chimeEnabled: true, // Will be implemented in future stories
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
    outputChannel.appendLine('MCP Server started successfully');
    
    const health = mcpServer!.getHealth();
    if (health.httpStatus === 'listening') {
      // Get the actual port from server config
      const httpConfig = (mcpServer as any).config?.http;
      const port = httpConfig?.port || 'unknown';
      outputChannel.appendLine(`HTTP transport listening on localhost:${port}`);
      
      // Show info message with server details
      vscode.window.showInformationMessage(
        `Popup MCP Server started on localhost:${port}`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          outputChannel.show();
        }
      });
    }
    
    if (health.stdioStatus === 'active') {
      outputChannel.appendLine('Stdio transport active');
    }
  });
  
  mcpServer.on('stopped', () => {
    outputChannel.appendLine('MCP Server stopped');
  });
  
  mcpServer.on('error', (error) => {
    const errorMessage = `MCP Server error: ${error.message}`;
    outputChannel.appendLine(`ERROR: ${errorMessage}`);
    console.error('[Popup MCP]', errorMessage);
    
    // Show error to user
    vscode.window.showErrorMessage(errorMessage, 'Show Output').then(selection => {
      if (selection === 'Show Output') {
        outputChannel.show();
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
          outputChannel.show();
          outputChannel.appendLine('=== Server Health Check ===');
          healthInfo.forEach(info => outputChannel.appendLine(info));
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
    
    outputChannel.show();
    outputChannel.appendLine('=== MCP Server Status ===');
    
    const health = mcpServer.getHealth();
    outputChannel.appendLine(`Overall Status: ${health.status}`);
    outputChannel.appendLine(`HTTP Transport: ${health.httpStatus || 'disabled'}`);
    outputChannel.appendLine(`Stdio Transport: ${health.stdioStatus || 'disabled'}`);
    outputChannel.appendLine(`Uptime: ${Math.round((health.uptime || 0) / 1000)} seconds`);
    outputChannel.appendLine(`Active Connections: ${health.activeConnections || 0}`);
    
    if (health.lastError) {
      outputChannel.appendLine(`Last Error: ${health.lastError}`);
    }
    
    // Show current configuration
    const config = loadConfiguration();
    outputChannel.appendLine('--- Configuration ---');
    outputChannel.appendLine(`HTTP Enabled: ${config.enableHttp}`);
    outputChannel.appendLine(`HTTP Port: ${config.httpPort || 'auto'}`);
    outputChannel.appendLine(`Stdio Enabled: ${config.enableStdio}`);
    outputChannel.appendLine(`Log Level: ${config.logLevel}`);
  });
  
  // Add commands to context subscriptions for proper cleanup
  context.subscriptions.push(healthCheckCommand, statusCommand);
}

/**
 * Registers configuration change handler to restart server when needed
 */
function registerConfigurationHandler(): void {
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('popupmcp')) {
      outputChannel.appendLine('Configuration changed, restarting MCP server...');
      
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
        
        outputChannel.appendLine('MCP server restarted with new configuration');
        
      } catch (error) {
        const errorMessage = `Failed to restart MCP server: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.appendLine(`ERROR: ${errorMessage}`);
        vscode.window.showErrorMessage(errorMessage);
      }
    }
  });
}
