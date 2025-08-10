import * as vscode from 'vscode';
import * as path from 'path';
import { PopupRequest, PopupResponse } from '../types';

/**
 * PopupWebview component handles rendering popups in VS Code webview tabs
 * Implements AC: 1, 2 - Popup renders as HTML/CSS/TS in new tab with title, message, buttons, text field
 */
export class PopupWebview {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private responseCallback?: (response: PopupResponse) => void;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {}

  /**
   * Renders a popup in a new VS Code tab
   * @param request - PopupRequest containing title, message, options
   * @param onResponse - Callback for user response
   */
  public async renderPopup(
    request: PopupRequest, 
    onResponse: (response: PopupResponse) => void
  ): Promise<void> {
    try {
      // Validate request
      if (!request || !request.requestId) {
        throw new Error('Invalid popup request: missing requestId');
      }
      if (!request.title || !request.message) {
        throw new Error('Invalid popup request: missing title or message');
      }
      if (!request.options || !Array.isArray(request.options)) {
        throw new Error('Invalid popup request: missing options array');
      }

      // Validate callback
      if (typeof onResponse !== 'function') {
        throw new Error('Invalid onResponse callback');
      }

      // Dispose existing panel if any
      if (this.panel) {
        this.dispose();
      }

      this.responseCallback = onResponse;

      // Create webview panel with error handling
      try {
        this.panel = vscode.window.createWebviewPanel(
          'popupMcp',
          request.title,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(this.extensionUri, 'src', 'views'),
              vscode.Uri.joinPath(this.extensionUri, 'assets')
            ]
          }
        );
      } catch (error) {
        throw new Error(`Failed to create webview panel: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Set webview content with error handling
      try {
        this.panel.webview.html = this.getHtmlContent(request, this.panel.webview);
      } catch (error) {
        this.dispose();
        throw new Error(`Failed to generate HTML content: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        (message) => this.handleWebviewMessage(message, request),
        undefined,
        this.disposables
      );

      // Clean up when panel is disposed
      this.panel.onDidDispose(
        () => this.dispose(),
        undefined,
        this.disposables
      );

      // Show the panel with error handling
      try {
        this.panel.reveal();
      } catch (error) {
        this.dispose();
        throw new Error(`Failed to show webview panel: ${error instanceof Error ? error.message : String(error)}`);
      }

    } catch (error) {
      // Clean up on error
      this.dispose();
      
      // Log error
      console.error('Error rendering popup:', error);
      
      // Show user notification
      vscode.window.showErrorMessage(
        `Failed to render popup: ${error instanceof Error ? error.message : String(error)}`
      );
      
      // Re-throw error for caller to handle
      throw error;
    }
  }

  /**
   * Generates HTML content for the popup webview
   * @param request - PopupRequest data
   * @param webview - Webview instance for resource URIs
   * @returns HTML string
   */
  private getHtmlContent(request: PopupRequest, webview: vscode.Webview): string {
    // Generate buttons HTML
    const buttonsHtml = request.options.map(option => 
      `<button class="popup-button" data-value="${this.escapeHtml(option.value)}">
        ${this.escapeHtml(option.label)}
      </button>`
    ).join('\n        ');

    // Get workspace path for debugging (AC: 6)
    const workspacePath = request.workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'Unknown';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${this.escapeHtml(request.title)}</title>
      <style>
        /* Modern AI-style popup styling that adapts to VS Code themes */
        body {
          font-family: var(--vscode-font-family), 'Segoe UI', system-ui, sans-serif;
          font-size: var(--vscode-font-size, 13px);
          line-height: 1.6;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .popup-container {
          max-width: 600px;
          width: 100%;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          padding: 32px;
          text-align: center;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .popup-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--vscode-foreground);
          line-height: 1.3;
        }

        .popup-message {
          font-size: 16px;
          margin-bottom: 32px;
          color: var(--vscode-descriptionForeground);
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .popup-input {
          width: 100%;
          max-width: 400px;
          padding: 12px 16px;
          margin-bottom: 24px;
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          font-family: inherit;
          font-size: 14px;
          box-sizing: border-box;
        }

        .popup-input:focus {
          outline: none;
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .popup-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .popup-button {
          padding: 10px 20px;
          border: 1px solid var(--vscode-button-border, transparent);
          border-radius: 4px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 80px;
        }

        .popup-button:hover {
          background-color: var(--vscode-button-hoverBackground);
          transform: translateY(-1px);
        }

        .popup-button:active {
          transform: translateY(0);
        }

        .popup-button:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: 2px;
        }

        .debug-info {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          opacity: 0.7;
        }

        .debug-label {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .debug-path {
          font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="popup-container">
        <h1 class="popup-title">${this.escapeHtml(request.title)}</h1>
        <div class="popup-message">${this.escapeHtml(request.message)}</div>
        
        <input type="text" class="popup-input" id="freeTextInput" placeholder="Enter custom response (optional)..." />
        
        <div class="popup-buttons">
          ${buttonsHtml}
        </div>

        <div class="debug-info">
          <div class="debug-label">Workspace Path (Debug):</div>
          <div class="debug-path">${this.escapeHtml(workspacePath)}</div>
        </div>
      </div>

      <script>
        (function() {
          try {
            const vscode = acquireVsCodeApi();
            const buttons = document.querySelectorAll('.popup-button');
            const textInput = document.getElementById('freeTextInput');

            if (!textInput) {
              throw new Error('Text input element not found');
            }

            // Handle button clicks
            buttons.forEach(button => {
              button.addEventListener('click', () => {
                try {
                  const value = button.getAttribute('data-value');
                  if (!value) {
                    throw new Error('Button has no data-value attribute');
                  }
                  sendResponse(value);
                } catch (error) {
                  sendError('Button click error: ' + error.message);
                }
              });
            });

            // Handle Enter key in text input
            textInput.addEventListener('keydown', (e) => {
              try {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  sendResponse(e.target.value.trim());
                }
              } catch (error) {
                sendError('Text input error: ' + error.message);
              }
            });

            function sendResponse(value) {
              try {
                if (!value || typeof value !== 'string') {
                  throw new Error('Invalid response value');
                }
                
                vscode.postMessage({
                  command: 'response',
                  value: value
                });
              } catch (error) {
                sendError('Send response error: ' + error.message);
              }
            }

            function sendError(errorMessage) {
              try {
                vscode.postMessage({
                  command: 'error',
                  error: errorMessage
                });
              } catch (error) {
                console.error('Failed to send error message:', error);
              }
            }

            // Global error handler
            window.addEventListener('error', (e) => {
              sendError('JavaScript error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
            });

            window.addEventListener('unhandledrejection', (e) => {
              sendError('Unhandled promise rejection: ' + e.reason);
            });

            // Focus the text input on load
            textInput.focus();
          } catch (error) {
            console.error('Popup initialization error:', error);
            // Try to send error if vscode is available
            try {
              acquireVsCodeApi().postMessage({
                command: 'error',
                error: 'Popup initialization failed: ' + error.message
              });
            } catch (e) {
              console.error('Failed to send initialization error:', e);
            }
          }
        })();
      </script>
    </body>
    </html>`;
  }

  /**
   * Handles messages received from the webview
   */
  private handleWebviewMessage(message: any, request: PopupRequest): void {
    try {
      if (message.command === 'response' && this.responseCallback) {
        // Validate message data
        if (!message.value || typeof message.value !== 'string') {
          throw new Error('Invalid response value received from webview');
        }

        const response: PopupResponse = {
          requestId: request.requestId,
          selectedValue: message.value
        };
        
        // Call response callback with error handling
        try {
          this.responseCallback(response);
        } catch (error) {
          // Log error but still dispose the webview
          console.error('Error in response callback:', error);
          
          // Show user notification
          vscode.window.showErrorMessage(
            `Error processing popup response: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        
        this.dispose();
      } else if (message.command === 'error') {
        // Handle errors from the webview
        const errorMsg = `Webview error: ${message.error || 'Unknown error'}`;
        console.error(errorMsg);
        
        vscode.window.showErrorMessage(errorMsg);
        this.dispose();
      } else {
        // Unknown message type
        console.warn('Unknown message received from webview:', message);
      }
    } catch (error) {
      const errorMsg = `Error handling webview message: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      
      vscode.window.showErrorMessage(errorMsg);
      this.dispose();
    }
  }

  /**
   * Escapes HTML to prevent XSS attacks
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Disposes of the webview and cleans up resources
   */
  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    
    // Dispose all event listeners
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    this.responseCallback = undefined;
  }

  /**
   * Checks if the webview is currently active
   */
  public isActive(): boolean {
    return this.panel !== undefined && this.panel.visible;
  }
}
