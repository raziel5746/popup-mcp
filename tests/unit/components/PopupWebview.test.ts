/**
 * Unit tests for PopupWebview component
 */

import * as vscode from 'vscode';
import { PopupWebview } from '../../../src/components/PopupWebview';
import { PopupRequest, PopupResponse } from '../../../src/types';

// Mock VS Code API
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((...parts: any[]) => ({ fsPath: parts.join('/'), path: parts.join('/') }))
  },
  ViewColumn: {
    One: 1
  },
  window: {
    createWebviewPanel: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: []
  },
  commands: {
    executeCommand: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

describe('PopupWebview', () => {
  let popupWebview: PopupWebview;
  let mockContext: vscode.ExtensionContext;
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    mockExtensionUri = vscode.Uri.file('/mock/extension/path');
    mockContext = {
      extensionUri: mockExtensionUri,
      subscriptions: []
    } as any;

    popupWebview = new PopupWebview(mockExtensionUri, mockContext);
  });

  afterEach(() => {
    popupWebview.dispose();
    jest.clearAllMocks();
  });

  describe('renderPopup', () => {
    it('should create webview panel with correct configuration', async () => {
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn()
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      const createWebviewPanelSpy = jest.spyOn(vscode.window, 'createWebviewPanel')
        .mockReturnValue(mockPanel as any);

      const sampleRequest: PopupRequest = {
        requestId: 'test-123',
        workspacePath: '/test/workspace',
        title: 'Test Title',
        message: 'Test message',
        options: [{ label: 'OK', value: 'ok' }]
      };

      await popupWebview.renderPopup(sampleRequest, () => {});

      expect(createWebviewPanelSpy).toHaveBeenCalledWith(
        'popupMcp',
        'Test Title',
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: expect.any(Array)
        })
      );
    });

    it('should set HTML content with escaped values', async () => {
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

      const requestWithSpecialChars: PopupRequest = {
        requestId: 'test-escape',
        workspacePath: '/test/workspace',
        title: 'Title with <script>alert("xss")</script>',
        message: 'Message with "quotes" & ampersands',
        options: [{ label: 'Label with <em>HTML</em>', value: 'value with "quotes"' }]
      };

      await popupWebview.renderPopup(requestWithSpecialChars, () => {});

      const html = mockWebview.html;
      // Check that the XSS content in title/message is escaped, not the legitimate script tag
      expect(html).not.toContain('alert("xss")');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'); // Title should be escaped
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&lt;em&gt;HTML&lt;/em&gt;'); // Button label should be escaped
    });

    it('should handle workspace path correctly', async () => {
      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'workspace-test',
        workspacePath: '/custom/workspace/path',
        title: 'Workspace Test',
        message: 'Testing workspace display',
        options: []
      };

      await popupWebview.renderPopup(request, () => {});

      expect(mockWebview.html).toContain('/custom/workspace/path');
      expect(mockWebview.html).toContain('Workspace Path (Debug)');
    });
  });

  describe('message handling', () => {
    it('should call response callback when receiving response message', async () => {
      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'callback-test',
        workspacePath: '/test',
        title: 'Callback Test',
        message: 'Testing callback',
        options: [{ label: 'Test', value: 'test-value' }]
      };

      let receivedResponse: PopupResponse | undefined;
      const responseCallback = jest.fn((response: PopupResponse) => {
        receivedResponse = response;
      });

      await popupWebview.renderPopup(request, responseCallback);

      // Simulate webview message
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'response', value: 'test-value' });

      expect(responseCallback).toHaveBeenCalledWith({
        requestId: 'callback-test',
        selectedValue: 'test-value'
      });
      expect(receivedResponse).toEqual({
        requestId: 'callback-test',
        selectedValue: 'test-value'
      });
    });

    it('should ignore non-response messages', async () => {
      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'ignore-test',
        workspacePath: '/test',
        title: 'Ignore Test',
        message: 'Testing message ignoring',
        options: []
      };

      const responseCallback = jest.fn();
      await popupWebview.renderPopup(request, responseCallback);

      // Simulate non-response message
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'other', data: 'some data' });

      expect(responseCallback).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle management', () => {
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

      const request: PopupRequest = {
        requestId: 'active-test',
        workspacePath: '/test',
        title: 'Active Test',
        message: 'Testing active state',
        options: []
      };

      await popupWebview.renderPopup(request, () => {});
      expect(popupWebview.isActive()).toBe(true);
    });

    it('should dispose properly', () => {
      const mockPanel = {
        webview: { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      const disposeSpy = jest.fn();
      const mockDisposable = { dispose: disposeSpy };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      // Mock disposables array
      (popupWebview as any).disposables = [mockDisposable];
      (popupWebview as any).panel = mockPanel;

      popupWebview.dispose();

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clean up on panel dispose', async () => {
      const mockPanel = {
        webview: { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'cleanup-test',
        workspacePath: '/test',
        title: 'Cleanup Test',
        message: 'Testing cleanup',
        options: []
      };

      await popupWebview.renderPopup(request, () => {});

      // Simulate panel disposal
      const disposeHandler = mockPanel.onDidDispose.mock.calls[0][0];
      disposeHandler();

      expect(popupWebview.isActive()).toBe(false);
    });
  });

  describe('HTML generation', () => {
    it('should generate valid HTML structure', async () => {
      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'html-test',
        workspacePath: '/test',
        title: 'HTML Test',
        message: 'Testing HTML generation',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' }
        ]
      };

      await popupWebview.renderPopup(request, () => {});

      const html = mockWebview.html;
      
      // Check basic HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      
      // Check required elements
      expect(html).toContain('popup-title');
      expect(html).toContain('popup-message');
      expect(html).toContain('popup-input');
      expect(html).toContain('popup-buttons');
      expect(html).toContain('debug-info');
      
      // Check buttons
      expect(html).toContain('data-value="opt1"');
      expect(html).toContain('data-value="opt2"');
      
      // Check CSS styles
      expect(html).toContain('var(--vscode-');
      expect(html).toContain('fadeIn');
      
      // Check JavaScript
      expect(html).toContain('acquireVsCodeApi()');
      expect(html).toContain('postMessage');
    });

    it('should handle empty options array', async () => {
      const mockWebview = { html: '', onDidReceiveMessage: jest.fn(), postMessage: jest.fn() };
      const mockPanel = {
        webview: mockWebview,
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };

      jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);

      const request: PopupRequest = {
        requestId: 'no-options-test',
        workspacePath: '/test',
        title: 'No Options Test',
        message: 'Testing with no options',
        options: []
      };

      await popupWebview.renderPopup(request, () => {});

      const html = mockWebview.html;
      expect(html).toContain('popup-buttons');
      expect(html).toContain('popup-input'); // Text input should still be available
    });
  });
});
