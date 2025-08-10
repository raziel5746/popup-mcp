/**
 * Integration tests for popup display functionality
 * Tests all acceptance criteria for Story 1.4
 */

import * as vscode from 'vscode';
import { PopupWebview } from '../../src/components/PopupWebview';
import { ChimePlayer } from '../../src/utils/chimePlayer';
import { PopupRequest, PopupResponse } from '../../src/types';

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
    // Clean up
    popupWebview.dispose();
    chimePlayer.dispose();
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
      // Mock VS Code configuration
      const mockGetConfiguration = jest.spyOn(vscode.workspace, 'getConfiguration');
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'chimeEnabled') return true;
          return defaultValue;
        })
      } as any);

      const mockShowInformationMessage = jest.spyOn(vscode.window, 'showInformationMessage');
      mockShowInformationMessage.mockResolvedValue(undefined);

      const mockExecuteCommand = jest.spyOn(vscode.commands, 'executeCommand');
      mockExecuteCommand.mockResolvedValue(undefined);

      await chimePlayer.playChime();

      expect(mockShowInformationMessage).toHaveBeenCalledWith('🔔', { modal: false });

      mockGetConfiguration.mockRestore();
      mockShowInformationMessage.mockRestore();
      mockExecuteCommand.mockRestore();
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
    it('should dispose properly', () => {
      const mockPanel = {
        webview: { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

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
