#!/usr/bin/env node
/**
 * Standalone MCP Server for stdio transport
 * This file is executed as a separate process by AI assistants
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';
// import * as path from 'path'; // Currently unused

// Server instance
const server = new McpServer({
  name: 'popup-mcp',
  version: '0.1.0',
  capabilities: {
    tools: {}
  }
});

// Connection to VS Code extension (if available)
let extensionClient: WebSocket | undefined;
let isExtensionConnected = false;

// Map to store pending requests
const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout | null;
}>();

/**
 * Connect to VS Code extension via WebSocket
 */
async function connectToExtension(): Promise<void> {
  return new Promise((resolve, reject) => {
    const extensionPort = parseInt(process.env.POPUP_MCP_PORT || '9001', 10);
    const extensionHost = 'localhost';
    
    console.error(`[MCP] 🔌 Attempting to connect to VS Code extension at ws://${extensionHost}:${extensionPort}`);
    
    extensionClient = new WebSocket(`ws://${extensionHost}:${extensionPort}/ws`);
    
    extensionClient.on('open', () => {
      console.error('[MCP] 🔗 WebSocket connection established with VS Code extension');
      isExtensionConnected = true;
      resolve();
    });
    
    extensionClient.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'response' && message.requestId) {
          const pending = pendingRequests.get(message.requestId);
          if (pending) {
            if (pending.timeout) {
              clearTimeout(pending.timeout);
            }
            pending.resolve(message.response);
            pendingRequests.delete(message.requestId);
          }
        }
      } catch (error) {
        console.error('[MCP] ❌ Error parsing message from extension:', error);
      }
    });
    
    extensionClient.on('close', () => {
      console.error('[MCP] 🔌 Extension connection closed');
      isExtensionConnected = false;
      extensionClient = undefined;
    });
    
    extensionClient.on('error', (error) => {
      console.error('[MCP] ❌ Extension connection error:', error.message);
      isExtensionConnected = false;
      extensionClient = undefined;
      reject(error);
    });
    
    // Connection timeout
    setTimeout(() => {
      if (!isExtensionConnected) {
        console.error('[MCP] ⏰ Extension connection timed out');
        extensionClient?.close();
        reject(new Error('Extension connection timeout'));
      }
    }, 5000);
  });
}

/**
 * Send popup request to VS Code extension
 */
async function requestPopup(options: any): Promise<any> {
  if (!isExtensionConnected || !extensionClient || extensionClient.readyState !== WebSocket.OPEN) {
    throw new Error('VS Code extension not connected');
  }

  const requestId = `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 30000);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    const message = {
      type: 'popup_request',
      requestId,
      options
    };

    extensionClient!.send(JSON.stringify(message));
  });
}

/**
 * Register MCP tools
 */
function registerTools(): void {
  console.error('[MCP] 🔧 Registering tools...');

  // Tool: Trigger Popup
  server.tool(
    'triggerPopup',
    'Trigger a popup in VS Code for user input. Shows a dialog with title, message, and optional buttons for user interaction.',
    {
      title: z.string().describe('Title of the popup'),
      message: z.string().describe('Message to display to the user'),
      options: z.array(z.string()).optional().describe('Array of button options for user selection'),
      workspacePath: z.string().optional().describe('Required workspace path to target specific VS Code instance. AI assistants should include their current workspace path here for proper routing in multi-instance environments.')
    },
    async ({ title, message, options, workspacePath }) => {
      try {
        console.error(`[MCP] 🎯 Triggering popup: ${title}`);
        console.error(`[MCP] 📍 Workspace path provided: ${workspacePath || 'Not provided'}`);
        
        // Convert options to the format expected by our popup system
        const formattedOptions = options ? options.map(opt => ({ label: opt, value: opt })) : [];
        
        const response = await requestPopup({
          title,
          message,
          options: formattedOptions,
          workspacePath
        });

        console.error(`[MCP] ✅ Popup response received: ${response.selectedValue}`);

        return {
          content: [
            {
              type: 'text',
              text: `User selected: ${response.selectedValue}`
            }
          ]
        };
      } catch (error) {
        console.error('[MCP] ❌ Popup error:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ]
        };
      }
    }
  );

  console.error('[MCP] ✅ Tools registered successfully');
}

/**
 * Main function to start the MCP server
 */
async function main() {
  console.error('[MCP] 🚀 Starting Popup MCP Server (stdio transport)...');

  // Try to connect to VS Code extension
  try {
    await connectToExtension();
    console.error('[MCP] ✅ Connected to VS Code extension');
  } catch (error) {
    console.error('[MCP] ⚠️ Could not connect to VS Code extension:', error instanceof Error ? error.message : error);
    console.error('[MCP] 📝 Tools will be registered but may not function without extension');
  }

  // Register tools
  registerTools();

  // Start stdio transport
  console.error('[MCP] 📟 Starting stdio transport...');
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('[MCP] 🚀 MCP server ready on stdio transport');
  console.error('[MCP] 📡 Waiting for AI assistant connections...');
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('\n[MCP] 🛑 Received SIGINT, shutting down...');
  if (extensionClient) {
    extensionClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n[MCP] 🛑 Received SIGTERM, shutting down...');
  if (extensionClient) {
    extensionClient.close();
  }
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
