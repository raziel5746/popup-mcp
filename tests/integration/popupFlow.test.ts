/**
 * Integration tests for popup display functionality
 * Tests all acceptance criteria for Story 1.4
 */

import * as vscode from 'vscode';
import { PopupWebview } from '../../src/components/PopupWebview';
import { ChimePlayer } from '../../src/utils/chimePlayer';
import { PopupRequest, PopupResponse } from '../../src/types';

// Mock child_process for chime player tests
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock fs for chime player tests
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

// Enhanced VS Code mocks for this test file
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createWebviewPanel: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue?: any) => defaultValue)
    })),
    onDidChangeConfiguration: jest.fn(),
    workspaceFolders: []
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((...paths: any[]) => ({ fsPath: paths.join('/'), path: paths.join('/') }))
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  ExtensionMode: {
    Test: 3,
    Development: 2,
    Production: 1
  },
  ExtensionContext: jest.fn()
}), { virtual: true });

describe('Popup Flow Integration Tests', () => {
  let extensionContext: vscode.ExtensionContext;
  let popupWebview: PopupWebview;
  let chimePlayer: ChimePlayer;

  beforeEach(async () => {
    // Mock extension context
    extensionContext = {
      extensionUri: vscode.Uri.file(__dirname),
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn()
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        setKeysForSync: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      environmentVariableCollection: {
        persistent: true,
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        get: jest.fn(),
        forEach: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn()
      },
      extensionPath: __dirname,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storageUri: vscode.Uri.file(__dirname),
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      asAbsolutePath: jest.fn((path: string) => path)
    } as any;

    // Initialize components
    popupWebview = new PopupWebview(extensionContext.extensionUri, extensionContext);
    chimePlayer = new ChimePlayer(extensionContext.extensionUri, extensionContext);
  });

  afterEach(() => {
    // Clean up with null checks
    if (popupWebview) {
      popupWebview.dispose();
    }
    if (chimePlayer) {
      chimePlayer.dispose();
    }
  });

  describe('AC1: Popup renders as HTML/CSS/TS in new tab', () => {
    it('should create webview panel with correct title', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'test-001',
        workspacePath: '/test/workspace',
        title: 'Test Popup Title',
        message: 'Test message',
        options: [{ label: 'OK', value: 'ok' }]
      };

      const mockCreateWebviewPanel = jest.spyOn(vscode.window, 'createWebviewPanel');
      mockCreateWebviewPanel.mockReturnValue({
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn()
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      } as any);

      let responseReceived = false;
      await popupWebview.renderPopup(sampleRequest, (response) => {
        responseReceived = true;
      });

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'popupMcp',
        'Test Popup Title',
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );

      mockCreateWebviewPanel.mockRestore();
    });
  });

  describe('AC2: Displays title, message, buttons, and text field', () => {
    it('should generate HTML with all required elements', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'test-002',
        workspacePath: '/test/workspace',
        title: 'Sample Title',
        message: 'Sample message with\nmultiple lines',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      };

      const mockWebview = {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn()
      };

      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      await popupWebview.renderPopup(sampleRequest, () => {});

      // Check that HTML contains all required elements
      const html = mockWebview.html;
      expect(html).toContain('Sample Title');
      expect(html).toContain('Sample message with\nmultiple lines');
      expect(html).toContain('data-value="yes"');
      expect(html).toContain('data-value="no"');
      expect(html).toContain('popup-input');
      expect(html).toContain('freeTextInput');
    });
  });

  describe('AC3: Modern minimalistic AI style', () => {
    it('should include VS Code theme-aware CSS', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'test-003',
        workspacePath: '/test/workspace',
        title: 'Style Test',
        message: 'Testing styles',
        options: [{ label: 'OK', value: 'ok' }]
      };

      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      await popupWebview.renderPopup(sampleRequest, () => {});

      const html = mockWebview.html;
      // Check for VS Code theme variables
      expect(html).toContain('var(--vscode-foreground)');
      expect(html).toContain('var(--vscode-editor-background)');
      expect(html).toContain('var(--vscode-button-background)');
      expect(html).toContain('fadeIn');
      expect(html).toContain('border-radius');
    });
  });

  describe('AC4: Chime sound playback', () => {
    it('should play chime when enabled', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      // Mock VS Code configuration
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          if (key === 'chimeVolume') return 50;
          return defaultValue;
        })
      });

      // Mock fs.existsSync to return true (chime file exists)
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

      // Verify that audio playback was attempted
      expect(spawn).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should not play chime when disabled', async () => {
      // Mock VS Code configuration with chime disabled
      const mockGetConfiguration = jest.spyOn(vscode.workspace, 'getConfiguration');
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return false;
          return defaultValue;
        })
      } as any);

      const mockShowInformationMessage = jest.spyOn(vscode.window, 'showInformationMessage');

      await chimePlayer.playChime();

      expect(mockShowInformationMessage).not.toHaveBeenCalled();

      mockGetConfiguration.mockRestore();
      mockShowInformationMessage.mockRestore();
    });
  });

  describe('AC5: Local testability', () => {
    it('should handle sample popup request correctly', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'local-test',
        workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'test-workspace',
        title: 'Local Test',
        message: 'Testing local functionality',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' }
        ]
      };

      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      let receivedResponse: PopupResponse | undefined;
      await popupWebview.renderPopup(sampleRequest, (response) => {
        receivedResponse = response;
      });

      // Simulate user clicking a button
      const onMessageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      onMessageHandler({ command: 'response', value: 'opt1' });

      expect(receivedResponse).toEqual({
        requestId: 'local-test',
        selectedValue: 'opt1'
      });
    });
  });

  describe('AC6: Workspace path display', () => {
    it('should display workspace path in debug section', async () => {
      const testWorkspacePath = '/custom/test/path';
      const sampleRequest: PopupRequest = {
        requestId: 'debug-test',
        workspacePath: testWorkspacePath,
        title: 'Debug Test',
        message: 'Testing debug info',
        options: [{ label: 'OK', value: 'ok' }]
      };

      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      await popupWebview.renderPopup(sampleRequest, () => {});

      const html = mockWebview.html;
      expect(html).toContain('Workspace Path (Debug)');
      expect(html).toContain(testWorkspacePath);
      expect(html).toContain('debug-info');
    });
  });

  describe('Response handling', () => {
    it('should handle button responses correctly', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'response-test',
        workspacePath: '/test',
        title: 'Response Test',
        message: 'Testing response handling',
        options: [{ label: 'Submit', value: 'submit' }]
      };

      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      let capturedResponse: PopupResponse | undefined;
      await popupWebview.renderPopup(sampleRequest, (response) => {
        capturedResponse = response;
      });

      // Simulate webview message
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'submit' });

      expect(capturedResponse).toEqual({
        requestId: 'response-test',
        selectedValue: 'submit'
      });
    });

    it('should handle free text responses correctly', async () => {
      const sampleRequest: PopupRequest = {
        requestId: 'text-response-test',
        workspacePath: '/test',
        title: 'Text Response Test',
        message: 'Testing text input',
        options: []
      };

      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      let capturedResponse: PopupResponse | undefined;
      await popupWebview.renderPopup(sampleRequest, (response) => {
        capturedResponse = response;
      });

      // Simulate free text input
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'custom user input' });

      expect(capturedResponse).toEqual({
        requestId: 'text-response-test',
        selectedValue: 'custom user input'
      });
    });
  });

  describe('Component lifecycle', () => {
    it('should dispose properly', async () => {
      const mockPanel = {
        webview: { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      // First create a popup to have something to dispose
      const sampleRequest: PopupRequest = {
        requestId: 'dispose-test',
        workspacePath: '/test',
        title: 'Dispose Test',
        message: 'Testing disposal',
        options: [{ label: 'OK', value: 'ok' }]
      };

      await popupWebview.renderPopup(sampleRequest, () => {});
      
      // Now dispose and verify
      popupWebview.dispose();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('should track active state correctly', async () => {
      expect(popupWebview.isActive()).toBe(false);

      const mockPanel = {
        webview: { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn(),
        visible: true
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const sampleRequest: PopupRequest = {
        requestId: 'active-test',
        workspacePath: '/test',
        title: 'Active Test',
        message: 'Testing active state',
        options: [{ label: 'OK', value: 'ok' }]
      };

      await popupWebview.renderPopup(sampleRequest, () => {});
      expect(popupWebview.isActive()).toBe(true);
    });
  });
});
