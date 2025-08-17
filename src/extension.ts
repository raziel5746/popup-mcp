/**
 * Main VS Code extension entry point
 * Activates and manages the MCP server lifecycle
 */

import * as vscode from 'vscode';
import { McpServer } from './backend/mcpServer';
import { TransportConfig, ExtensionConfig, PopupRequest, StatusState, InstanceRole } from './types';
import { logger } from './utils/logger';
import { PopupWebview } from './components/PopupWebview';
import { ChimePlayer } from './utils/chimePlayer';
import { SettingsManager } from './components/SettingsManager';
import { ResponseHandler } from './backend/responseHandler';
import { InstanceCoordinator } from './backend/coordination';
import { WebSocketClient } from './components/WebSocketClient';

let mcpServer: McpServer | undefined;
let popupWebview: PopupWebview | undefined;
let chimePlayer: ChimePlayer | undefined;
let currentWorkspacePath: string | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let chimeStatusBarItem: vscode.StatusBarItem | undefined;
let lastStatusBarText: string | undefined;
let coordinator: InstanceCoordinator | undefined;
let wsClient: WebSocketClient | undefined;
const statusState: StatusState = {
  role: 'inactive',
  isActive: false
};

/**
 * Extension activation function - called when VS Code starts or extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize logger first
    logger.initialize();
    logger.info('Extension activating...');
    logger.info('Popup MCP Extension starting...');
    
    // Detect and store current workspace path
    detectWorkspacePath();
    
    // Load configuration
    const config = loadConfiguration();
    
    // Initialize popup components
    popupWebview = new PopupWebview(context.extensionUri, context);
    chimePlayer = new ChimePlayer(context.extensionUri, context);
    
    // Initialize status bar item
    initializeStatusBar(context);
    
    // Initialize instance coordination FIRST to determine role and allocate ports
    await initializeCoordination(config.httpPort || 9001);
    
    // Only start MCP server if this instance is elected as server
    if (statusState.role === 'server-active' && coordinator) {
      const allocatedPort = coordinator.getAllocatedPort();
      const transportConfig = createTransportConfig(config, allocatedPort);
        
      logger.info('HTTP server always enabled for WebSocket bridge support');
      mcpServer = new McpServer(transportConfig);
      
      // Set up server event handlers
      setupServerEventHandlers();
      
      // Set instance information on MCP server for coordination
      mcpServer.setInstanceId(coordinator.getInstanceId());
      mcpServer.setWorkspacePath(getCurrentWorkspacePath());
      
      // Start the server
      await mcpServer.start();
      
      // Set MCP server reference in request handler for WebSocket routing
      const requestHandler = mcpServer.getRequestHandler();
      requestHandler.setMcpServer(mcpServer);
      
      logger.info(`Server instance started on port ${allocatedPort}`);
    } else if (statusState.role === 'client-active' && coordinator) {
      // Initialize WebSocket client for client instances
      const serverInstance = coordinator.getServerInstance();
      if (serverInstance?.httpPort) {
        await initializeWebSocketClient(serverInstance.httpPort);
      } else {
        logger.warn('No server instance available for WebSocket client connection');
      }
    } else {
      logger.info(`Instance role is ${statusState.role} - MCP server not started on this instance`);
    }
    
    // Set up popup trigger callback
    setupPopupIntegration();
    
    // Register commands
    registerCommands(context);
    
    // Register configuration change handler
    registerConfigurationHandler();
    
    // Register workspace change handler
    registerWorkspaceChangeHandler(context);
    
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
    
    // Stop WebSocket client
    if (wsClient) {
      wsClient.disconnect();
      wsClient = undefined;
    }
    
    // Stop instance coordination
    if (coordinator) {
      await coordinator.stop();
      coordinator = undefined;
    }
    
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
    
    // Dispose status bar items
    if (statusBarItem) {
      statusBarItem.dispose();
      statusBarItem = undefined;
    }
    
    if (chimeStatusBarItem) {
      chimeStatusBarItem.dispose();
      chimeStatusBarItem = undefined;
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
  return SettingsManager.getConfig();
}

/**
 * Sets up popup integration between MCP server and webview components
 */
function setupPopupIntegration(): void {
  if (!popupWebview || !chimePlayer) {
    logger.error('Cannot setup popup integration - components not initialized');
    return;
  }

  // Only set up server-side integration if this instance has an MCP server
  if (mcpServer) {
    const requestHandler = mcpServer.getRequestHandler();
    
    // Set the current workspace path for MCP coordination
    requestHandler.setExtensionWorkspacePath(getCurrentWorkspacePath());
    
    // Set up coordination mode for server instances
    if (statusState.role === 'server-active' && coordinator) {
      requestHandler.setServerMode();
      // CRITICAL: Pass the coordinator to the request handler for routing
      requestHandler.setCoordinator(coordinator);
    }
    
    // Set up popup trigger callback
    requestHandler.setPopupTriggerCallback(async (request: PopupRequest, responseHandler: ResponseHandler) => {
      try {
        logger.info('Triggering popup for request:', request.requestId);
        logger.info('Workspace paths for popup:', {
          aiProvided: request.workspacePath || 'Not provided',
          extensionDetected: getCurrentWorkspacePath() || 'Not detected'
        });
        
        // Show popup and handle response
        await popupWebview!.renderPopup(request, async (response) => {
          try {
            logger.info('Popup response received:', response);
            
            // Route response back via MCP
            await responseHandler.handlePopupResponse(response);
            
            logger.info('Response successfully routed back to AI');
          } catch (error) {
            logger.error('Error routing popup response:', error);
            
            // Show error notification to user
            vscode.window.showErrorMessage(
              `Failed to send popup response: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }, undefined, getCurrentWorkspacePath());
        
      } catch (error) {
        logger.error('Error triggering popup:', error);
        
        // Show error notification to user
        vscode.window.showErrorMessage(
          `Failed to show popup: ${error instanceof Error ? error.message : String(error)}`
        );
        
        throw error; // Re-throw so the request handler can handle it
      }
    });
  
    logger.info('Popup integration setup complete for server instance');
  } else {
    logger.info('Popup integration setup skipped - this instance is a client');
  }
}

/**
 * Sets up event handlers for the MCP server
 */
function setupServerEventHandlers(): void {
  if (!mcpServer) {return;}
  
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
        const role = statusState.role;
        vscode.window.showInformationMessage(
          `MCP Server is not running on this instance (Role: ${role}). ${role === 'client-active' ? 'This instance forwards requests to the server instance.' : 'This instance is inactive.'}`
        );
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
      const role = statusState.role;
      vscode.window.showInformationMessage(
        `MCP Server is not running on this instance (Role: ${role}). ${role === 'client-active' ? 'This instance forwards requests to the server instance.' : 'This instance is inactive.'}`
      );
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
        workspacePath: getCurrentWorkspacePath(),
        title: 'Test Popup',
        message: 'This is a sample popup to test the functionality.\n\nYou can click a button or enter custom text.',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
          { label: 'Maybe', value: 'maybe' }
        ]
      };
      
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
      }, undefined, getCurrentWorkspacePath());
      
    } catch (error) {
      const errorMessage = `Failed to show test popup: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
    }
  });

  // Copy HTTP config command
  const copyHttpConfigCommand = vscode.commands.registerCommand('popupmcp.copyHttpConfig', async () => {
    try {
      const config = loadConfiguration();
      
      // Get actual port from running server if available
      let port = config.httpPort;
      if (mcpServer) {
        const health = mcpServer.getHealth();
        if (health.httpStatus === 'listening') {
          // Get the actual port from server config
          const httpConfig = (mcpServer as any).config?.http;
          port = httpConfig?.port || config.httpPort;
        }
      }
      
      // Use default port 9001 if not set or auto-assigned (0)
      const actualPort = port || 9001;
      
      const httpConfig = {
        mcpServers: {
          'popup-mcp': {
            url: `http://localhost:${actualPort}/mcp`
          }
        }
      };
      
      const configJson = JSON.stringify(httpConfig, null, 2);
      await vscode.env.clipboard.writeText(configJson);
      
      logger.info('HTTP config copied to clipboard:', configJson);
      vscode.window.showInformationMessage(
        `HTTP MCP config copied to clipboard (port: ${actualPort})`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          logger.show();
        }
      });
      
    } catch (error) {
      const errorMessage = `Failed to copy HTTP config: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
    }
  });

  // Copy stdio config command
  const copyStdioConfigCommand = vscode.commands.registerCommand('popupmcp.copyStdioConfig', async () => {
    try {
      // Use the installed extension path (works for both dev and installed)
      const mcpServerPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'backend', 'mcpServerStdio.js').fsPath;
      
      const stdioConfig = {
        mcpServers: {
          'popup-mcp': {
            command: 'node',
            args: [mcpServerPath]
          }
        }
      };
        
      const configJson = JSON.stringify(stdioConfig, null, 2);
      
      logger.info(`Generated stdio config with extension path: ${mcpServerPath}`);
      await vscode.env.clipboard.writeText(configJson);
      
      logger.info('Stdio config copied to clipboard:', configJson);
      vscode.window.showInformationMessage(
        'Stdio MCP config copied to clipboard',
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          logger.show();
        }
      });
      
    } catch (error) {
      const errorMessage = `Failed to copy stdio config: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
    }
  });
  
  // Show workspace info command
  const showWorkspaceInfoCommand = vscode.commands.registerCommand('popupmcp.showWorkspaceInfo', () => {
    const workspacePath = getCurrentWorkspacePath();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (workspacePath) {
      const folderCount = workspaceFolders?.length || 0;
      const message = [
        '**Current Workspace Path:**',
        `\`${workspacePath}\``,
        '',
        `**Workspace Folders:** ${folderCount}`,
        workspaceFolders?.map((folder, i) => `${i + 1}. ${folder.uri.fsPath}`).join('\n') || 'None'
      ].join('\n');
      
      vscode.window.showInformationMessage(
        'Popup MCP Workspace Information',
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          logger.show();
          logger.info('=== Workspace Information ===');
          logger.info(message);
        }
      });
    } else {
      vscode.window.showInformationMessage(
        'No workspace folder is currently open for Popup MCP routing.',
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          logger.show();
          logger.info('=== Workspace Information ===');
          logger.info('No workspace folder detected');
        }
      });
    }
  });

  // Toggle chime command
  const toggleChimeCommand = vscode.commands.registerCommand('popupmcp.toggleChime', async () => {
    try {
      const currentConfig = SettingsManager.getConfig();
      const newChimeState = !currentConfig.chimeEnabled;
      
      await SettingsManager.updateConfig('chimeEnabled', newChimeState);
      
      // Update the chime status bar immediately
      updateChimeStatusBar();
      
      const statusMessage = newChimeState ? 'Chime enabled' : 'Chime disabled';
      vscode.window.showInformationMessage(`Popup MCP: ${statusMessage}`);
      
      logger.info(`Chime toggled: ${newChimeState}`);
    } catch (error) {
      logger.error('Error toggling chime:', error);
      vscode.window.showErrorMessage('Failed to toggle chime setting');
    }
  });

  // Add commands to context subscriptions for proper cleanup
  context.subscriptions.push(
    healthCheckCommand, 
    statusCommand, 
    testPopupCommand, 
    copyHttpConfigCommand, 
    copyStdioConfigCommand,
    showWorkspaceInfoCommand,
    toggleChimeCommand
  );
}

/**
 * Registers configuration change handler to restart server when needed
 */
function registerConfigurationHandler(): void {
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('popupmcp')) {
      logger.info('Configuration changed, restarting MCP server...');
      
      try {
        // Stop WebSocket client if it exists
        if (wsClient) {
          wsClient.disconnect();
          wsClient = undefined;
        }
        
        // Stop existing server if it exists
        if (mcpServer) {
          await mcpServer.stop();
          mcpServer = undefined;
        }
        
        // Stop coordination
        if (coordinator) {
          await coordinator.stop();
          coordinator = undefined;
        }
        
        // Load new configuration and restart coordination
        const config = loadConfiguration();
        await initializeCoordination(config.httpPort || 9001);
        
        // Only restart MCP server if this instance is elected as server
        if (statusState.role === 'server-active') {
          if (!coordinator) {
            throw new Error('Coordinator should be available for server instances');
          }
          const allocatedPort = (coordinator as InstanceCoordinator).getAllocatedPort();
          const transportConfig = createTransportConfig(config, allocatedPort);
            
          logger.info('HTTP server always enabled for WebSocket bridge support');
          mcpServer = new McpServer(transportConfig);
          
          // Set instance information on MCP server for coordination
          mcpServer.setInstanceId((coordinator as InstanceCoordinator).getInstanceId());
          mcpServer.setWorkspacePath(getCurrentWorkspacePath());
          
          setupServerEventHandlers();
          await mcpServer.start();
          
          // Set MCP server reference in request handler for WebSocket routing
          const requestHandler = mcpServer.getRequestHandler();
          requestHandler.setMcpServer(mcpServer);
        } else if (statusState.role === 'client-active' && coordinator) {
          // Initialize WebSocket client for client instances
          const serverInstance = (coordinator as InstanceCoordinator).getServerInstance();
          if (serverInstance?.httpPort) {
            await initializeWebSocketClient(serverInstance.httpPort);
          }
        }
        
        // Re-setup popup integration
        setupPopupIntegration();
        
        // Update chime status bar with new configuration
        updateChimeStatusBar();
        
        logger.info(`Extension restarted with new configuration (role: ${statusState.role})`);
        
      } catch (error) {
        const errorMessage = `Failed to restart MCP server: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
      }
    }
  });
}

/**
 * Creates transport configuration for MCP server
 * Always enables HTTP for WebSocket bridge (required for stdio communication)
 * @param config Extension configuration
 * @param allocatedPort Port allocated by coordination system (overrides config)
 * @returns Transport configuration object
 */
function createTransportConfig(config: ExtensionConfig, allocatedPort?: number): TransportConfig {
  return {
    http: {
      enabled: true,
      port: allocatedPort || config.httpPort || 9001,
      host: 'localhost'
    },
    stdio: {
      enabled: config.enableStdio !== false // Default to true
    }
  };
}

/**
 * Detects and stores the current workspace path from VS Code workspace API
 * Updates the MCP request handler with the detected path for routing coordination
 */
function detectWorkspacePath(): void {
  try {
    // Get the first workspace folder (most common case)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (workspaceFolders && workspaceFolders.length > 0) {
      currentWorkspacePath = workspaceFolders[0].uri.fsPath;
      logger.info(`Workspace path detected: ${currentWorkspacePath}`);
    } else {
      currentWorkspacePath = undefined;
      logger.info('No workspace folder detected - running without workspace');
    }
    
    // Update the request handler with the new workspace path
    if (mcpServer) {
      const requestHandler = mcpServer.getRequestHandler();
      requestHandler.setExtensionWorkspacePath(getCurrentWorkspacePath());
    }
    
    // Update status bar display
    updateStatusBar();
  } catch (error) {
    logger.error('Error detecting workspace path:', error);
    currentWorkspacePath = undefined;
  }
}

/**
 * Gets the current workspace path for use in popup requests
 * @returns Current workspace path or empty string if no workspace is open
 */
function getCurrentWorkspacePath(): string {
  return currentWorkspacePath || '';
}

/**
 * Registers handler for workspace folder changes to detect dynamic workspace switches
 * Automatically updates workspace path detection when folders are added/removed
 * @param context VS Code extension context for resource cleanup
 */
function registerWorkspaceChangeHandler(context: vscode.ExtensionContext): void {
  // Listen for workspace folder changes
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    logger.info('Workspace folders changed:', {
      added: event.added.length,
      removed: event.removed.length
    });
    
    // Re-detect workspace path
    detectWorkspacePath();
    
    // Log the change for debugging
    if (event.added.length > 0) {
      event.added.forEach(folder => {
        logger.info(`Workspace folder added: ${folder.uri.fsPath}`);
      });
    }
    
    if (event.removed.length > 0) {
      event.removed.forEach(folder => {
        logger.info(`Workspace folder removed: ${folder.uri.fsPath}`);
      });
    }
  });
  
  // Add to context subscriptions for proper cleanup
  context.subscriptions.push(workspaceWatcher);
  
  logger.info('Workspace change handler registered');
}

/**
 * Initializes the status bar item for workspace path display
 * Creates clickable status bar item that shows current workspace for debugging multi-instance scenarios
 * @param context VS Code extension context for resource cleanup
 */
function initializeStatusBar(context: vscode.ExtensionContext): void {
  try {
    // Create main status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100 // Priority
    );
    
    // Set up click command to show workspace details
    statusBarItem.command = 'popupmcp.showWorkspaceInfo';
    
    // Create chime toggle status bar item
    chimeStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99 // Priority (lower than main item)
    );
    
    // Set up click command to toggle chime
    chimeStatusBarItem.command = 'popupmcp.toggleChime';
    
    // Add to context subscriptions for proper cleanup
    context.subscriptions.push(statusBarItem, chimeStatusBarItem);
    
    // Show the status bar items
    statusBarItem.show();
    chimeStatusBarItem.show();
    
    // Initial update
    updateStatusBar();
    updateChimeStatusBar();
    
    logger.info('Status bar item initialized');
  } catch (error) {
    logger.error('Error initializing status bar:', error);
  }
}

/**
 * Updates the status bar item with current workspace information and role
 * Optimized to prevent unnecessary DOM updates by tracking display text changes
 */
function updateStatusBar(): void {
  if (!statusBarItem) {return;}
  
  try {
    const workspacePath = getCurrentWorkspacePath();
    let newText: string;
    let newTooltip: string;
    
    // Get role icon and text
    const roleIcon = getRoleIcon(statusState.role);
    const roleText = getRoleDisplayText(statusState.role);
    
    if (workspacePath) {
      // Extract just the folder name for compact display
      const workspaceName = workspacePath.split(/[\\/]/).pop() || 'Unknown';
      newText = `${roleIcon} ${workspaceName}`;
      newTooltip = `Popup MCP: ${roleText} | Workspace: ${workspacePath}`;
    } else {
      newText = `${roleIcon} No Workspace`;
      newTooltip = `Popup MCP: ${roleText} | No workspace folder detected`;
    }
    
    // Add server info to tooltip if available
    if (statusState.serverInfo && statusState.role === 'client-active') {
      newTooltip += ` | Server: ${statusState.serverInfo.instanceId} (port ${statusState.serverInfo.httpPort})`;
    }
    
    // Only update if text has actually changed to prevent unnecessary DOM operations
    if (lastStatusBarText !== newText) {
      statusBarItem.text = newText;
      statusBarItem.tooltip = newTooltip;
      lastStatusBarText = newText;
      logger.debug(`Status bar updated: ${newText} (${statusState.role})`);
    }
  } catch (error) {
    logger.error('Error updating status bar:', error);
  }
}

/**
 * Updates the chime status bar item with current chime state
 */
function updateChimeStatusBar(): void {
  if (!chimeStatusBarItem) {return;}
  
  try {
    const config = SettingsManager.getConfig();
    const chimeIcon = config.chimeEnabled ? '$(bell)' : '$(bell-slash)';
    const chimeState = config.chimeEnabled ? 'ON' : 'OFF';
    
    chimeStatusBarItem.text = chimeIcon;
    chimeStatusBarItem.tooltip = `Popup MCP chime is ${chimeState} (click to toggle)`;
    
    logger.debug(`Chime status bar updated: ${chimeState}`);
  } catch (error) {
    logger.error('Error updating chime status bar:', error);
  }
}

/**
 * Gets the appropriate icon for the current role
 */
function getRoleIcon(role: InstanceRole): string {
  switch (role) {
  case 'server-active':
    return '$(server-process)';
  case 'client-active':
    return '$(folder)';
  case 'inactive':
  default:
    return '$(circle-slash)';
  }
}

/**
 * Gets display text for the current role
 */
function getRoleDisplayText(role: InstanceRole): string {
  switch (role) {
  case 'server-active':
    return 'Server Active';
  case 'client-active':
    return 'Client Active';
  case 'inactive':
  default:
    return 'Inactive';
  }
}

/**
 * Initializes instance coordination system
 */
async function initializeCoordination(desiredHttpPort: number): Promise<void> {
  try {
    const workspacePath = getCurrentWorkspacePath();
    
    // Create coordinator
    coordinator = new InstanceCoordinator(workspacePath, desiredHttpPort);
    
    // Set up role change handler
    coordinator.on('roleChanged', async (newRole: InstanceRole) => {
      logger.info(`Instance role changed: ${statusState.role} -> ${newRole}`);
      
      const previousRole = statusState.role;
      statusState.role = newRole;
      statusState.isActive = newRole !== 'inactive';
      
      // Handle WebSocket client connections based on role changes
      if (newRole === 'client-active' && previousRole !== 'client-active' && coordinator) {
        // Became a client - initialize WebSocket client
        const serverInstance = coordinator.getServerInstance();
        if (serverInstance?.httpPort) {
          await initializeWebSocketClient(serverInstance.httpPort);
        }
      } else if (previousRole === 'client-active' && newRole !== 'client-active') {
        // No longer a client - disconnect WebSocket client
        if (wsClient) {
          wsClient.disconnect();
          wsClient = undefined;
        }
      }
      
      // Update server info if we're a client
      if (newRole === 'client-active' && coordinator) {
        const serverInstance = coordinator.getServerInstance();
        if (serverInstance) {
          statusState.serverInfo = {
            instanceId: serverInstance.instanceId,
            httpPort: serverInstance.httpPort || 0
          };
        }
      } else {
        statusState.serverInfo = undefined;
      }
      
      // Update status bar
      updateStatusBar();
      
      // Update request handler coordination mode
      updateRequestHandlerCoordination();
    });
    
    // Start coordination (this will determine role and allocate port)
    await coordinator.start();
    
    // Set initial status based on coordinator's role
    statusState.role = coordinator.getCurrentRole();
    statusState.isActive = statusState.role !== 'inactive';
    
    // Update server info if we're a client
    if (statusState.role === 'client-active') {
      const serverInstance = coordinator.getServerInstance();
      if (serverInstance) {
        statusState.serverInfo = {
          instanceId: serverInstance.instanceId,
          httpPort: serverInstance.httpPort || 0
        };
      }
    }
    
    // Update status bar
    updateStatusBar();
    
    logger.info(`Instance coordination initialized with role: ${statusState.role}`);
  } catch (error) {
    logger.error('Failed to initialize instance coordination:', error);
    // Continue without coordination
    statusState.role = 'inactive';
    statusState.isActive = false;
    updateStatusBar();
  }
}

/**
 * Updates request handler with coordination information
 */
function updateRequestHandlerCoordination(): void {
  // Only update if this instance has an MCP server
  if (!mcpServer) {
    logger.debug('No MCP server to update - this instance has no server');
    return;
  }
  
  const requestHandler = mcpServer.getRequestHandler();
  
  // Set coordination mode based on role
  if (statusState.role === 'client-active' && coordinator) {
    // This shouldn't happen since clients don't have MCP servers, but handle gracefully
    logger.warn('Client instance has MCP server - setting client mode');
    requestHandler.setClientMode(coordinator);
  } else if (statusState.role === 'server-active' && coordinator) {
    // For servers, ensure normal operation with coordination
    logger.info('Setting server mode for direct request handling');
    requestHandler.setServerMode();
    requestHandler.setCoordinator(coordinator);
    requestHandler.setMcpServer(mcpServer);
  }
}

/**
 * Initializes WebSocket client for client instances
 */
async function initializeWebSocketClient(serverPort: number): Promise<void> {
  try {
    if (!popupWebview || !chimePlayer) {
      logger.error('Cannot initialize WebSocket client - popup components not ready');
      return;
    }

    logger.info(`Initializing WebSocket client to connect to server on port ${serverPort}`);
    
    wsClient = new WebSocketClient(getCurrentWorkspacePath());
    
    // Set up popup request callback
    wsClient.setCallbacks({
      onPopupRequest: async (request: PopupRequest) => {
        logger.info(`Handling popup request via WebSocket: ${request.requestId}`);
        
        return new Promise((resolve, reject) => {
          // Show popup and handle response
          popupWebview!.renderPopup(request, (response) => {
            logger.info(`WebSocket popup response: ${response.selectedValue}`);
            resolve({ selectedValue: response.selectedValue });
          }, undefined, getCurrentWorkspacePath()).catch(error => {
            logger.error('Error showing WebSocket popup:', error);
            reject(error);
          });
        });
      },
      onServerDisconnected: () => {
        logger.warn('Server disconnected - WebSocket connection lost');
        // Update status to show disconnection but don't trigger elections
        statusState.role = 'inactive';
        statusState.isActive = false;
        statusState.serverInfo = undefined;
        updateStatusBar();
      },
      onServerReconnected: () => {
        logger.info('Server reconnected - WebSocket connection restored');
        // Update status to show reconnection
        statusState.role = 'client-active';
        statusState.isActive = true;
        if (coordinator) {
          const serverInstance = coordinator.getServerInstance();
          if (serverInstance) {
            statusState.serverInfo = {
              instanceId: serverInstance.instanceId,
              httpPort: serverInstance.httpPort || 0
            };
          }
        }
        updateStatusBar();
      }
    });
    
    // Connect to server
    await wsClient.connect(serverPort);
    
    logger.info('WebSocket client initialized and connected');
  } catch (error) {
    logger.error('Failed to initialize WebSocket client:', error);
    if (wsClient) {
      wsClient.disconnect();
      wsClient = undefined;
    }
  }
}
