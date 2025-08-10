/**
 * Unit tests for ChimePlayer utility
 */

import * as vscode from 'vscode';
import { ChimePlayer } from '../../../src/utils/chimePlayer';

// Mock VS Code API
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((...parts: any[]) => ({ fsPath: parts.join('/'), path: parts.join('/') }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn()
  },
  commands: {
    executeCommand: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

describe('ChimePlayer', () => {
  let chimePlayer: ChimePlayer;
  let mockContext: vscode.ExtensionContext;
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    mockExtensionUri = vscode.Uri.file('/mock/extension/path');
    mockContext = {
      extensionUri: mockExtensionUri,
      subscriptions: []
    } as any;

    chimePlayer = new ChimePlayer(mockExtensionUri, mockContext);
    jest.clearAllMocks();
  });

  afterEach(() => {
    chimePlayer.dispose();
  });

  describe('playChime', () => {
    it('should play chime when enabled', async () => {
      // Mock configuration to enable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const showInformationMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand')
        .mockResolvedValue(undefined);

      await chimePlayer.playChime();

      expect(showInformationMessageSpy).toHaveBeenCalledWith('🔔', { modal: false });
    });

    it('should not play chime when disabled', async () => {
      // Mock configuration to disable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return false;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const showInformationMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      await chimePlayer.playChime();

      expect(showInformationMessageSpy).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Mock configuration to enable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      // Mock showInformationMessage to throw an error
      jest.spyOn(vscode.window, 'showInformationMessage')
        .mockRejectedValue(new Error('Mock error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // This should not throw, error should be caught internally
      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to play chime:', expect.any(Error));
      expect(consoleLogSpy).toHaveBeenCalledWith('\x07'); // ASCII bell character

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('configuration management', () => {
    it('should get extension configuration correctly', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            popupTimeout: 30,
            httpPort: 3000,
            enableStdio: false,
            enableHttp: true,
            logLevel: 'debug'
          };
          return values[key] ?? defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const isEnabled = chimePlayer.isChimeEnabled();
      expect(isEnabled).toBe(true);
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('popupmcp');
    });

    it('should use default values when config is missing', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => defaultValue)
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const isEnabled = chimePlayer.isChimeEnabled();
      expect(isEnabled).toBe(true); // Default value
    });

    it('should update chime enabled setting', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      await chimePlayer.setChimeEnabled(false);

      expect(mockConfig.update).toHaveBeenCalledWith(
        'chimeEnabled',
        false,
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe('lifecycle management', () => {
    it('should dispose properly', () => {
      // Mock internal audio context
      const mockAudioContext = {
        close: jest.fn().mockResolvedValue(undefined)
      };

      (chimePlayer as any).audioContext = mockAudioContext;
      (chimePlayer as any).isInitialized = true;

      chimePlayer.dispose();

      expect(mockAudioContext.close).toHaveBeenCalled();
      expect((chimePlayer as any).audioContext).toBeUndefined();
      expect((chimePlayer as any).audioBuffer).toBeUndefined();
      expect((chimePlayer as any).isInitialized).toBe(false);
    });

    it('should handle dispose when not initialized', () => {
      // Should not throw when disposing uninitialized player
      expect(() => chimePlayer.dispose()).not.toThrow();
    });
  });

  describe('initialization', () => {
    it('should initialize only once', async () => {
      // Mock configuration
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);
      jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);

      // Call playChime multiple times
      await chimePlayer.playChime();
      await chimePlayer.playChime();

      // Internal initialization should only happen once
      expect((chimePlayer as any).isInitialized).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle configuration errors', async () => {
      // Mock getConfiguration to throw an error
      jest.spyOn(vscode.workspace, 'getConfiguration')
        .mockImplementation(() => {
          throw new Error('Configuration error');
        });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\x07');

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle system sound playback errors', async () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);
      
      // Mock system sound to fail
      jest.spyOn(vscode.window, 'showInformationMessage')
        .mockRejectedValue(new Error('System sound failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to play chime:', expect.any(Error));
      expect(consoleLogSpy).toHaveBeenCalledWith('\x07');

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});
