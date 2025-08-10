/**
 * Centralized logging utility for VS Code extension
 * Uses VS Code Output Channel for proper logging to the Output panel
 */

import * as vscode from 'vscode';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private outputChannel: vscode.OutputChannel | null = null;
  private readonly channelName = 'Popup MCP';

  /**
   * Initialize the logger with VS Code output channel
   * Should be called during extension activation
   */
  initialize(): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel(this.channelName);
    }
  }

  /**
   * Get the output channel instance
   */
  getOutputChannel(): vscode.OutputChannel | null {
    return this.outputChannel;
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Show the output channel to the user
   */
  show(): void {
    if (this.outputChannel) {
      this.outputChannel.show();
    }
  }

  /**
   * Internal logging method that handles both output channel and console
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}` : '';
    
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;

    // Log to output channel if available
    if (this.outputChannel) {
      this.outputChannel.appendLine(logMessage);
    }

    // Also log to console for development/debugging
    // This ensures logs appear in both VS Code output and debug console
    switch (level) {
      case 'error':
        console.error(`[${this.channelName}]`, message, ...args);
        break;
      case 'warn':
        console.warn(`[${this.channelName}]`, message, ...args);
        break;
      case 'debug':
        console.debug(`[${this.channelName}]`, message, ...args);
        break;
      default:
        console.log(`[${this.channelName}]`, message, ...args);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = null;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions for easier importing
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logError = (message: string, ...args: any[]) => logger.error(message, ...args);
export const logDebug = (message: string, ...args: any[]) => logger.debug(message, ...args);
