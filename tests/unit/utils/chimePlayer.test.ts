/**
 * Unit tests for ChimePlayer utility
 */

import * as vscode from 'vscode';
import { ChimePlayer } from '../../../src/utils/chimePlayer';

// Mock child_process and fs modules
jest.mock('child_process');
jest.mock('fs');

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

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
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
      const { spawn } = require('child_process');
      const fs = require('fs');
      
      // Mock configuration to enable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            chimeVolume: 50
          };
          return values[key] ?? defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      // Mock fs.existsSync to return true
      fs.existsSync = jest.fn().mockReturnValue(true);

      // Mock spawn to simulate successful audio playback
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10); // Simulate successful completion
          }
        })
      };
      spawn.mockReturnValue(mockProcess);

      await chimePlayer.playChime();

      expect(spawn).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should not play chime when disabled', async () => {
      const { spawn } = require('child_process');
      
      // Mock configuration to disable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return false;
          return defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      await chimePlayer.playChime();

      expect(spawn).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const fs = require('fs');
      
      // Mock configuration to enable chime
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            chimeVolume: 50
          };
          return values[key] ?? defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      // Mock fs.existsSync to return false (file not found)
      fs.existsSync = jest.fn().mockReturnValue(false);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // This should not throw, error should be caught internally
      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith('\x07'); // ASCII bell character

      consoleLogSpy.mockRestore();
    });
  });

  describe('configuration management', () => {
    it('should get extension configuration correctly', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            chimeVolume: 75,
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

  describe('audio file handling', () => {
    it('should handle missing audio file', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      // Mock configuration
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            chimeVolume: 50
          };
          return values[key] ?? defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      // Mock fs.existsSync to return false (file not found)
      fs.existsSync = jest.fn().mockReturnValue(false);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await chimePlayer.playChime();

      expect(spawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\x07');

      consoleLogSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle configuration errors', async () => {
      // Mock getConfiguration to throw an error
      jest.spyOn(vscode.workspace, 'getConfiguration')
        .mockImplementation(() => {
          throw new Error('Configuration error');
        });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith('\x07');

      consoleLogSpy.mockRestore();
    });

    it('should handle audio process errors', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: { [key: string]: any } = {
            chimeEnabled: true,
            chimeVolume: 50
          };
          return values[key] ?? defaultValue;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);
      
      // Mock fs.existsSync to return true
      fs.existsSync = jest.fn().mockReturnValue(true);
      
      // Mock spawn to simulate process error
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process failed')), 10);
          }
        })
      };
      spawn.mockReturnValue(mockProcess);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(chimePlayer.playChime()).resolves.not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith('\x07');

      consoleLogSpy.mockRestore();
    });
  });
});
