/**
 * Settings Manager for Popup MCP Extension
 * Handles reading and updating VS Code workspace configuration
 */

import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';

export class SettingsManager {
  private static readonly CONFIG_SECTION = 'popupmcp';

  /**
   * Get current extension configuration
   * @returns Current settings with defaults applied
   */
  public static getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    
    return {
      chimeEnabled: config.get<boolean>('chimeEnabled', true),
      chimeVolume: config.get<number>('chimeVolume', 50),
      popupTimeout: config.get<number>('popupTimeout', 30), // Default 30 seconds
      httpPort: config.get<number>('httpPort', 9001),
      enableStdio: config.get<boolean>('enableStdio', true),
      enableHttp: config.get<boolean>('enableHttp', true),
      logLevel: config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info')
    };
  }

  /**
   * Update a specific configuration setting
   * @param key Configuration key to update
   * @param value New value to set
   * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
   */
  public static async updateConfig<K extends keyof ExtensionConfig>(
    key: K,
    value: ExtensionConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    await config.update(key, value, target);
  }

  /**
   * Update multiple configuration settings at once
   * @param updates Object containing key-value pairs to update
   * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
   */
  public static async updateMultipleConfigs(
    updates: Partial<ExtensionConfig>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    
    // Update all settings in parallel
    const updatePromises = Object.entries(updates).map(([key, value]) =>
      config.update(key, value, target)
    );
    
    await Promise.all(updatePromises);
  }

  /**
   * Listen for configuration changes
   * @param callback Function to call when configuration changes
   * @returns Disposable to stop listening
   */
  public static onConfigurationChanged(
    callback: (config: ExtensionConfig) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.CONFIG_SECTION)) {
        callback(this.getConfig());
      }
    });
  }

  /**
   * Reset configuration to defaults
   * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
   */
  public static async resetToDefaults(
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    
    // Reset all settings to undefined to use defaults
    const resetPromises = [
      config.update('chimeEnabled', undefined, target),
      config.update('chimeVolume', undefined, target),
      config.update('popupTimeout', undefined, target),
      config.update('httpPort', undefined, target),
      config.update('enableStdio', undefined, target),
      config.update('enableHttp', undefined, target),
      config.update('logLevel', undefined, target)
    ];
    
    await Promise.all(resetPromises);
  }

  /**
   * Validate configuration values
   * @param config Configuration to validate
   * @returns True if valid, false otherwise
   */
  public static validateConfig(config: Partial<ExtensionConfig>): boolean {
    // Validate chimeVolume range
    if (config.chimeVolume !== undefined && 
        (config.chimeVolume < 0 || config.chimeVolume > 100)) {
      return false;
    }

    // Validate httpPort range
    if (config.httpPort !== undefined && 
        (config.httpPort < 0 || config.httpPort > 65535)) {
      return false;
    }

    // Validate popupTimeout is positive
    if (config.popupTimeout !== undefined && config.popupTimeout <= 0) {
      return false;
    }

    // Validate logLevel is valid
    if (config.logLevel !== undefined && 
        !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      return false;
    }

    return true;
  }
}
