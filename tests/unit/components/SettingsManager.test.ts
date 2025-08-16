/**
 * Unit tests for SettingsManager component
 * Tests settings persistence, configuration validation, and change listeners
 */

import * as vscode from 'vscode';
import { SettingsManager } from '../../../src/components/SettingsManager';
import { ExtensionConfig } from '../../../src/types';

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
}));

describe('SettingsManager', () => {
  let mockConfig: any;
  let mockGetConfiguration: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock configuration object
    mockConfig = {
      get: jest.fn(),
      update: jest.fn()
    };
    
    // Mock workspace.getConfiguration
    mockGetConfiguration = vscode.workspace.getConfiguration as jest.Mock;
    mockGetConfiguration.mockReturnValue(mockConfig);
  });

  describe('getConfig', () => {
    it('should return default configuration values', () => {
      // Setup mock to return default values
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

      const config = SettingsManager.getConfig();

      expect(config).toEqual({
        chimeEnabled: true,
        chimeVolume: 50,
        popupTimeout: 30,
        httpPort: 9001,
        enableStdio: true,
        enableHttp: true,
        logLevel: 'info'
      });

      expect(mockGetConfiguration).toHaveBeenCalledWith('popupmcp');
    });

    it('should return custom configuration values', () => {
      // Setup mock to return custom values
      const customValues = {
        chimeEnabled: false,
        chimeVolume: 75,
        popupTimeout: 60,
        httpPort: 8080,
        enableStdio: false,
        enableHttp: true,
        logLevel: 'debug' as const
      };

      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        return customValues[key as keyof typeof customValues] ?? defaultValue;
      });

      const config = SettingsManager.getConfig();

      expect(config).toEqual(customValues);
    });
  });

  describe('updateConfig', () => {
    it('should update a single configuration setting', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      await SettingsManager.updateConfig('chimeEnabled', false);

      expect(mockConfig.update).toHaveBeenCalledWith(
        'chimeEnabled',
        false,
        vscode.ConfigurationTarget.Workspace
      );
    });

    it('should update with custom configuration target', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      await SettingsManager.updateConfig(
        'httpPort',
        8080,
        vscode.ConfigurationTarget.Global
      );

      expect(mockConfig.update).toHaveBeenCalledWith(
        'httpPort',
        8080,
        vscode.ConfigurationTarget.Global
      );
    });

    it('should handle update errors gracefully', async () => {
      const error = new Error('Update failed');
      mockConfig.update.mockRejectedValue(error);

      await expect(SettingsManager.updateConfig('chimeEnabled', false))
        .rejects.toThrow('Update failed');
    });
  });

  describe('updateMultipleConfigs', () => {
    it('should update multiple configuration settings', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      const updates: Partial<ExtensionConfig> = {
        chimeEnabled: false,
        chimeVolume: 25,
        httpPort: 8080
      };

      await SettingsManager.updateMultipleConfigs(updates);

      expect(mockConfig.update).toHaveBeenCalledTimes(3);
      expect(mockConfig.update).toHaveBeenCalledWith(
        'chimeEnabled',
        false,
        vscode.ConfigurationTarget.Workspace
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        'chimeVolume',
        25,
        vscode.ConfigurationTarget.Workspace
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        'httpPort',
        8080,
        vscode.ConfigurationTarget.Workspace
      );
    });

    it('should handle partial update failures', async () => {
      mockConfig.update
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Second call fails')) // Second call fails
        .mockResolvedValueOnce(undefined); // Third call succeeds

      const updates: Partial<ExtensionConfig> = {
        chimeEnabled: false,
        chimeVolume: 25,
        httpPort: 8080
      };

      await expect(SettingsManager.updateMultipleConfigs(updates))
        .rejects.toThrow('Second call fails');
    });
  });

  describe('onConfigurationChanged', () => {
    it('should register configuration change listener', () => {
      const mockDisposable = { dispose: jest.fn() };
      const mockOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration as jest.Mock;
      mockOnDidChangeConfiguration.mockReturnValue(mockDisposable);

      const callback = jest.fn();
      const disposable = SettingsManager.onConfigurationChanged(callback);

      expect(mockOnDidChangeConfiguration).toHaveBeenCalled();
      expect(disposable).toBe(mockDisposable);
    });

    it('should call callback when configuration changes', () => {
      const mockDisposable = { dispose: jest.fn() };
      const mockOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration as jest.Mock;
      let changeHandler: (event: any) => void;
      
      mockOnDidChangeConfiguration.mockImplementation((handler) => {
        changeHandler = handler;
        return mockDisposable;
      });

      const callback = jest.fn();
      SettingsManager.onConfigurationChanged(callback);

      // Simulate configuration change
      const mockEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(true)
      };

      // Setup mock to return current config
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

      changeHandler!(mockEvent);

      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('popupmcp');
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        chimeEnabled: true,
        chimeVolume: 50,
        httpPort: 9001
      }));
    });

    it('should not call callback when configuration does not affect popupmcp', () => {
      const mockDisposable = { dispose: jest.fn() };
      const mockOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration as jest.Mock;
      let changeHandler: (event: any) => void;
      
      mockOnDidChangeConfiguration.mockImplementation((handler) => {
        changeHandler = handler;
        return mockDisposable;
      });

      const callback = jest.fn();
      SettingsManager.onConfigurationChanged(callback);

      // Simulate configuration change that doesn't affect popupmcp
      const mockEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(false)
      };

      changeHandler!(mockEvent);

      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('popupmcp');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      await SettingsManager.resetToDefaults();

      expect(mockConfig.update).toHaveBeenCalledTimes(7);
      expect(mockConfig.update).toHaveBeenCalledWith('chimeEnabled', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('chimeVolume', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('popupTimeout', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('httpPort', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('enableStdio', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('enableHttp', undefined, vscode.ConfigurationTarget.Workspace);
      expect(mockConfig.update).toHaveBeenCalledWith('logLevel', undefined, vscode.ConfigurationTarget.Workspace);
    });

    it('should use custom configuration target', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      await SettingsManager.resetToDefaults(vscode.ConfigurationTarget.Global);

      expect(mockConfig.update).toHaveBeenCalledWith('chimeEnabled', undefined, vscode.ConfigurationTarget.Global);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig: Partial<ExtensionConfig> = {
        chimeEnabled: true,
        chimeVolume: 50,
        httpPort: 9001,
        logLevel: 'info'
      };

      expect(SettingsManager.validateConfig(validConfig)).toBe(true);
    });

    it('should reject invalid chime volume', () => {
      const invalidConfig: Partial<ExtensionConfig> = {
        chimeVolume: -1
      };

      expect(SettingsManager.validateConfig(invalidConfig)).toBe(false);

      const invalidConfig2: Partial<ExtensionConfig> = {
        chimeVolume: 101
      };

      expect(SettingsManager.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid http port', () => {
      const invalidConfig: Partial<ExtensionConfig> = {
        httpPort: -1
      };

      expect(SettingsManager.validateConfig(invalidConfig)).toBe(false);

      const invalidConfig2: Partial<ExtensionConfig> = {
        httpPort: 65536
      };

      expect(SettingsManager.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid popup timeout', () => {
      const invalidConfig: Partial<ExtensionConfig> = {
        popupTimeout: 0
      };

      expect(SettingsManager.validateConfig(invalidConfig)).toBe(false);

      const invalidConfig2: Partial<ExtensionConfig> = {
        popupTimeout: -5
      };

      expect(SettingsManager.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid log level', () => {
      const invalidConfig = {
        logLevel: 'invalid' as any
      } as Partial<ExtensionConfig>;

      expect(SettingsManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should accept valid boundary values', () => {
      const validBoundaryConfig: Partial<ExtensionConfig> = {
        chimeVolume: 0,
        httpPort: 0,
        popupTimeout: 1
      };

      expect(SettingsManager.validateConfig(validBoundaryConfig)).toBe(true);

      const validBoundaryConfig2: Partial<ExtensionConfig> = {
        chimeVolume: 100,
        httpPort: 65535
      };

      expect(SettingsManager.validateConfig(validBoundaryConfig2)).toBe(true);
    });
  });
});
