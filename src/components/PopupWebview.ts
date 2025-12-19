import * as vscode from 'vscode';
// import * as path from 'path'; // Currently unused
import { PopupRequest, PopupResponse } from '../types';
import { micromark } from 'micromark';
import { ChimePlayer } from '../utils/chimePlayer';

/**
 * PopupWebview component handles rendering popups in VS Code webview tabs
 * Implements AC: 1, 2 - Popup renders as HTML/CSS/TS in new tab with title, message, buttons, text field
 */
export class PopupWebview {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private responseCallback?: (response: PopupResponse) => void;
  private onPopupReady?: () => void;
  private chimePlayer: ChimePlayer;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.chimePlayer = new ChimePlayer(extensionUri, context);
  }

  /**
   * Renders a popup in a new VS Code tab
   * @param request - PopupRequest containing title, message, options
   * @param onResponse - Callback for user response
   * @param onReady - Optional callback when popup is ready/visible
   * @param extensionWorkspacePath - Optional workspace path detected by the extension for comparison
   * @param allowEscClose - Whether Escape key closes the popup (default: false)
   */
  public async renderPopup(
    request: PopupRequest, 
    onResponse: (response: PopupResponse) => void,
    onReady?: () => void,
    extensionWorkspacePath?: string,
    allowEscClose = false
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
      this.onPopupReady = onReady;

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
        this.panel.webview.html = this.getHtmlContent(request, this.panel.webview, extensionWorkspacePath, allowEscClose);
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
        
        // Play chime immediately when popup is revealed (synchronous with popup appearance)
        this.chimePlayer.playChime().catch(error => {
          console.error('Error playing chime:', error);
        });
        
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
   * Gets theme-specific CSS classes based on current VS Code theme
   * Prepares hooks for future theme selection (AC: 3)
   */
  private getThemeClasses(): string {
    try {
      // Get current VS Code theme kind
      const themeKind = vscode.window.activeColorTheme?.kind;
      
      // Future: Read themePreference from ExtensionConfig
      // const config = vscode.workspace.getConfiguration('popupMcp') as ExtensionConfig;
      // const themePreference = config.themePreference || 'auto';
      
      switch (themeKind) {
      case vscode.ColorThemeKind.Light:
        return 'theme-light';
      case vscode.ColorThemeKind.Dark:
        return 'theme-dark';
      case vscode.ColorThemeKind.HighContrast:
      case vscode.ColorThemeKind.HighContrastLight:
        return 'theme-high-contrast';
      default:
        return 'theme-dark';
      }
    } catch (error) {
      // Fallback for test environment or when theme API is not available
      return 'theme-dark';
    }
  }

  /**
   * Generates HTML content for the popup webview
   * @param request - PopupRequest data
   * @param webview - Webview instance for resource URIs
   * @param extensionWorkspacePath - Optional workspace path detected by the extension for comparison
   * @returns HTML string
   */
  private getHtmlContent(request: PopupRequest, webview: vscode.Webview, extensionWorkspacePath?: string, allowEscClose = false): string {
    // Generate buttons HTML (options are always {value, label} objects)
    // All buttons should look the same with primary (blue) styling
    const buttonsHtml = request.options.map((option) => {
      return `<button class="popup-button popup-button--primary" data-value="${this.escapeHtml(option.value)}">
        ${this.escapeHtml(option.label)}
      </button>`;
    }).join('\n          ');

    // Get workspace paths for debugging and comparison (AC: 6)
    const aiWorkspacePath = request.workspacePath || 'Not provided by AI';
    const ideWorkspacePath = extensionWorkspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'Unknown';
    
    // Get theme classes for future theme selection hooks
    const themeClasses = this.getThemeClasses();

    return /* html */`<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
      <title>${this.escapeHtml(request.title)}</title>
      <style>
        /* Interactive MCP-inspired Popup Styles */
        :root {
          --popup-bg: var(--vscode-editor-background, #1e1e1e);
          --popup-border: var(--vscode-widget-border, #3c3c3c);
          --popup-text: var(--vscode-foreground, #cccccc);
          --popup-header-bg: var(--vscode-editor-background, #2d2d30);
          --popup-button-primary: #0e639c;
          --popup-button-primary-hover: #1177bb;
          --popup-button-primary-active: #154e75;
          --popup-button-secondary: transparent;
          --popup-button-secondary-hover: var(--vscode-list-hoverBackground, #464647);
          --popup-button-danger: var(--vscode-errorForeground, #f14c4c);
          --popup-shadow: rgba(0, 0, 0, 0.4);
          --popup-radius: 8px;
          --popup-backdrop: rgba(0, 0, 0, 0.8);
          --popup-glow-color: rgba(14, 99, 156, 0.5);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--vscode-font-family, 'Segoe UI'), Tahoma, Geneva, Verdana, sans-serif;
          font-size: var(--vscode-font-size, 13px);
          line-height: 1.5;
          color: var(--popup-text);
          background: var(--popup-backdrop);
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(2px);
        }

        .popup-container {
          max-width: none;
          width: 450px;
          background: var(--popup-bg);
          border: 1px solid var(--popup-border);
          border-radius: var(--popup-radius);
          box-shadow: 0 8px 32px var(--popup-shadow);
          overflow: hidden;
          animation: slideIn 0.2s ease-out, glow 3s ease-in-out infinite;
          text-align: left;
          resize: horizontal;
          overflow: auto;
          min-width: 320px;
          min-height: 240px;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scaleY(0.90);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Pulsating glow effect for attention */
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 8px 32px var(--popup-shadow);
            border-color: var(--popup-border);
          }
          50% {
            box-shadow: 0 8px 32px var(--popup-glow-color);
            border-color: rgba(14, 99, 156, 0.8);
          }
        }

        .popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px 24px;
          background: var(--popup-bg);
          position: relative;
        }

        .popup-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: var(--popup-text);
          flex: 1;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .popup-close {
          background: none;
          border: none;
          color: var(--popup-text);
          font-size: 20px;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease;
        }

        .popup-close:hover {
          background: var(--popup-button-secondary-hover);
          transform: scale(1.1);
          transition: all 0.2s ease;
        }

        .popup-content {
          padding: 0 24px 16px 24px;
        }

        .popup-message {
          margin-bottom: 20px;
          line-height: 1.6;
          font-size: 14px;
          color: var(--popup-text);
        }

        .popup-message strong {
          font-weight: 600;
          color: var(--popup-text);
        }

        .popup-message em {
          font-style: italic;
          color: var(--popup-text);
          opacity: 0.9;
        }

        .popup-message code {
          background: rgba(255, 255, 255, 0.1);
          color: var(--popup-text);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family, 'Monaco'), 'Consolas', monospace;
          font-size: 0.9em;
        }

        .popup-message a {
          color: var(--vscode-textLink-foreground, #3794ff);
          text-decoration: none;
        }

        .popup-message a:hover {
          color: var(--vscode-textLink-activeForeground, #4daafc);
          text-decoration: underline;
        }

        .popup-actions {
          padding: 16px 24px;
          background: var(--popup-bg);
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
        }

        .popup-button {
          padding: 10px 16px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 120px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .popup-button:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .popup-button:active {
          background-color: var(--popup-button-primary-active) !important;
          transition: none !important;
          transform: none !important;
        }

        .popup-button--primary {
          background: var(--popup-button-primary);
          color: #ffffff !important;
        }

        .popup-button--primary:hover:not(:disabled) {
          background: var(--popup-button-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(14, 99, 156, 0.3);
        }

        .popup-button--secondary {
          background: var(--popup-button-secondary);
          color: var(--popup-text);
          border: 1px solid var(--popup-border);
        }

        .popup-button--secondary:hover:not(:disabled) {
          background: var(--popup-button-secondary-hover);
          transform: translateY(-1px);
          border-color: var(--popup-button-primary);
        }

        .popup-button--danger {
          background: var(--popup-button-danger);
          color: #ffffff;
        }

        .popup-button--danger:hover:not(:disabled) {
          background: var(--popup-button-danger);
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(241, 76, 76, 0.3);
        }

        /* Custom text area styles */
        .popup-custom-text {
          padding: 16px 24px;
          background: var(--popup-bg);
          margin-top: 8px;
        }

        .popup-button--custom-text {
          background: transparent;
          color: var(--popup-text);
          border: 1px solid var(--popup-border);
          font-size: 12px;
          padding: 6px 12px;
          min-width: auto;
          margin-top: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .popup-button--custom-text:hover:not(:disabled) {
          background: var(--popup-border);
          border-color: var(--popup-button-primary);
          transform: none;
        }

        .popup-textarea {
          width: 100%;
          min-height: 80px;
          padding: 12px;
          border: 1px solid var(--popup-border);
          border-radius: 4px;
          background: var(--vscode-input-background, #3c3c3c);
          color: var(--popup-text);
          font-family: var(--vscode-font-family, 'Segoe UI'), Tahoma, Geneva, Verdana, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
          transition: border-color 0.2s ease;
        }

        .popup-textarea:focus {
          outline: none;
          border-color: rgba(14, 99, 156, 0.8);
          box-shadow: 0 0 0 2px rgba(14, 99, 156, 0.3), 0 4px 12px rgba(14, 99, 156, 0.2);
        }

        .popup-textarea::placeholder {
          color: var(--vscode-input-placeholderForeground, rgba(204, 204, 204, 0.6));
        }

        .popup-custom-actions {
          margin-top: 12px;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }

        .custom-action-buttons {
          display: flex;
          gap: 8px;
        }

        .popup-timer {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, rgba(204, 204, 204, 0.7));
          margin-top: 6px;
        }

        .popup-timer--header {
          position: absolute;
          top: 6px;
          left: 24px;
          margin-top: 0;
        }

        /* Focus styles for accessibility - static glow effect similar to popup border */
        .popup-button:focus,
        .popup-close:focus {
          outline: 3px solid #031623;
        }

        /* Loading state */
        .popup-button.loading {
          position: relative;
          color: transparent;
        }

        .popup-button.loading::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 16px;
          height: 16px;
          margin: -8px 0 0 -8px;
          border: 2px solid currentColor;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Debug info styles */
        .debug-info {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--popup-border);
          font-size: 11px;
          color: var(--vscode-descriptionForeground, rgba(204, 204, 204, 0.6));
          opacity: 0.7;
        }

        .debug-label {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .debug-path {
          font-family: var(--vscode-editor-font-family, 'Consolas'), monospace;
          word-break: break-all;
          margin-bottom: 12px;
        }

        .debug-path-comparison {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .debug-path-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .debug-path-match {
          font-size: 10px;
          font-weight: 600;
          color: var(--vscode-testing-iconPassed, #4CAF50);
        }

        .debug-path-mismatch {
          font-size: 10px;
          font-weight: 600;
          color: var(--vscode-testing-iconFailed, #F44336);
        }

        /* Responsive design */
        @media (max-width: 480px) {
          body {
            padding: 10px;
          }
          .popup-container {
            margin: 0;
          }
          .popup-header {
            padding: 10px 12px;
          }
          .popup-content {
            padding: 16px;
          }
          .popup-actions {
            padding: 12px;
          }
          .popup-button {
            width: 100%;
            margin: 0;
          }
        }
      </style>
    </head>
    <body class="${themeClasses}">
      <div class="popup-container">
        <div class="popup-header">
          <div class="popup-timer popup-timer--header" id="popupTimer">00:00</div>
          <h2 class="popup-title">${this.escapeHtml(request.title)}</h2>
          <button class="popup-close" id="closeButton" title="Close">×</button>
        </div>

        <div class="popup-content">
          <div class="popup-message">
            ${this.formatContent(request.message)}
          </div>
        </div>

        <div class="popup-actions">
          ${buttonsHtml}
        </div>

        <div class="popup-custom-text">
          <textarea
            id="customTextInput"
            placeholder="Enter your custom response here..."
            rows="3"
            class="popup-textarea"
            style="display: block;"
          ></textarea>
          <div class="popup-custom-actions">
            <button
              class="popup-button popup-button--custom-text"
              id="customTextButton"
              data-action="custom-text"
            >
              Custom text
            </button>
            <div class="custom-action-buttons" id="customActionButtons" style="display: flex;">
              <button
                class="popup-button popup-button--secondary"
                id="cancelCustomTextButton"
              >
                Cancel
              </button>
              <button
                class="popup-button popup-button--primary"
                id="sendCustomTextButton"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <!-- Debug info commented out for cleaner UI - uncomment if needed for debugging
        <div class="debug-info">
          <div class="debug-label">Workspace Path Comparison (Debug):</div>
          <div class="debug-path-comparison">
            <div class="debug-path-item">
              <div class="debug-label">AI Assistant Provided:</div>
              <div class="debug-path">${this.escapeHtml(aiWorkspacePath)}</div>
            </div>
            <div class="debug-path-item">
              <div class="debug-label">IDE Extension Detected:</div>
              <div class="debug-path">${this.escapeHtml(ideWorkspacePath)}</div>
            </div>
            <div class="debug-path-item">
              <div class="${aiWorkspacePath !== 'Not provided by AI' && this.normalizeWorkspacePath(aiWorkspacePath) === this.normalizeWorkspacePath(ideWorkspacePath) ? 'debug-path-match' : 'debug-path-mismatch'}">
                ${aiWorkspacePath !== 'Not provided by AI' && this.normalizeWorkspacePath(aiWorkspacePath) === this.normalizeWorkspacePath(ideWorkspacePath) ? '✓ Paths match - routing should work correctly' : '⚠ Paths differ - this may cause routing issues'}
              </div>
            </div>
          </div>
        </div>
        -->
      </div>

      <script>
        (function() {
          'use strict';

          let isDisposed = false;
          const allowEscClose = ${allowEscClose ? 'true' : 'false'};

          function initializePopup() {
            debugLog('Popup JavaScript initializing...');
            setupEventListeners();
            focusCustomTextInput();
            focusFirstInteractiveElement();
            startTimer();
            
            // Send ready message to extension
            try {
              debugLog('Sending ready message to extension');
              vscode.postMessage({
                command: 'ready'
              });
              debugLog('Ready message sent successfully');
            } catch (e) {
              debugLog('Failed to send ready message', e);
            }
          }

          function setupEventListeners() {
            debugLog('Setting up event listeners...');
            
            // Close button
            const closeButton = document.getElementById('closeButton');
            if (closeButton) {
              closeButton.addEventListener('click', handleClose);
              debugLog('Close button event listener added');
            } else {
              debugLog('Close button not found!');
            }

            // Main action buttons
            const buttons = document.querySelectorAll('.popup-actions .popup-button:not(#customTextButton)');
            debugLog('Found action buttons', { count: buttons.length });
            buttons.forEach((button, index) => {
              button.addEventListener('click', handleButtonClick);
              debugLog('Added event listener to button', { index: index, value: button.getAttribute('data-value') });
            });

            // Custom text functionality
            const customTextButton = document.getElementById('customTextButton');
            const customTextInput = document.getElementById('customTextInput');
            const sendCustomTextButton = document.getElementById('sendCustomTextButton');
            const cancelCustomTextButton = document.getElementById('cancelCustomTextButton');

            if (customTextButton) {
              customTextButton.addEventListener('click', handleCustomTextToggle);
            }
            if (sendCustomTextButton) {
              sendCustomTextButton.addEventListener('click', handleSendCustomText);
            }
            if (cancelCustomTextButton) {
              cancelCustomTextButton.addEventListener('click', handleCancelCustomText);
            }
            if (customTextInput) {
              customTextInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleSendCustomText();
                }
              });
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', handleKeyDown);
          }

          function focusCustomTextInput() {
            const customTextInput = document.getElementById('customTextInput');
            if (customTextInput) {
              setTimeout(() => {
                customTextInput.focus();
              }, 10);
            }
          }

          function startTimer() {
            const timerEl = document.getElementById('popupTimer');
            if (!timerEl) return;

            let elapsed = 0;
            timerEl.textContent = formatTime(elapsed);

            const intervalId = setInterval(() => {
              if (isDisposed) {
                clearInterval(intervalId);
                return;
              }
              elapsed += 1;
              timerEl.textContent = formatTime(elapsed);
            }, 1000);
          }

          function formatTime(totalSeconds) {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
          }

          function handleButtonClick(event) {
            if (isDisposed) return;

            const button = event.currentTarget;
            const value = button.getAttribute('data-value');
            
            debugLog('Button clicked', { value: value });
            
            if (!value) {
              debugLog('Button has no data-value attribute');
              return;
            }

            // Add loading state
            button.classList.add('loading');
            button.disabled = true;

            debugLog('Sending response', { value: value });
            sendResponse(value);
          }

          function handleCustomTextToggle() {
            const customTextInput = document.getElementById('customTextInput');
            const customActionButtons = document.getElementById('customActionButtons');

            if (customTextInput && customActionButtons) {
              const isVisible = customTextInput.style.display !== 'none';
              
              if (isVisible) {
                // Hide custom text input and action buttons
                customTextInput.style.display = 'none';
                customActionButtons.style.display = 'none';
              } else {
                // Show custom text input and action buttons
                customTextInput.style.display = 'block';
                customActionButtons.style.display = 'flex';
                setTimeout(() => {
                  customTextInput.focus();
                }, 10);
              }
            }
          }

          function handleSendCustomText() {
            if (isDisposed) return;

            const customTextInput = document.getElementById('customTextInput');
            const customText = customTextInput ? customTextInput.value.trim() : '';

            if (!customText) {
              // Show error indication
              if (customTextInput) {
                customTextInput.style.borderColor = '#ff4444';
                setTimeout(() => {
                  customTextInput.style.borderColor = '';
                }, 1000);
              }
              return;
            }

            sendResponse(customText);
          }

          function handleCancelCustomText() {
            handleCustomTextToggle(); // This will hide the custom text area
          }

          function handleClose() {
            if (isDisposed) return;
            sendResponse('__CANCELLED__');
          }

          function handleKeyDown(event) {
            if (isDisposed) return;

            switch (event.key) {
              case 'Escape':
                if (allowEscClose) {
                  event.preventDefault();
                  handleClose();
                }
                break;
              case 'Enter':
                // Allow multiline editing in textarea unless Ctrl+Enter is pressed
                if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
                  if (event.ctrlKey) {
                    return; // Ctrl+Enter handled by specific handlers
                  }
                  return; // Plain Enter inserts newline
                }

                // If focus is on a button, trigger click
                if (document.activeElement && document.activeElement.classList.contains('popup-button')) {
                  event.preventDefault();
                  document.activeElement.click();
                } else {
                  // Find primary button and click it
                  const primaryButton = document.querySelector('.popup-button--primary');
                  if (primaryButton) {
                    event.preventDefault();
                    primaryButton.click();
                  }
                }
                break;
            }
          }

          function focusFirstInteractiveElement() {
            // Try to focus the primary button first
            let elementToFocus = document.querySelector('.popup-button--primary');

            // If no primary button, focus the first button
            if (!elementToFocus) {
              elementToFocus = document.querySelector('.popup-button');
            }

            // If no buttons, focus the close button
            if (!elementToFocus) {
              elementToFocus = document.getElementById('closeButton');
            }

            if (elementToFocus) {
              elementToFocus.focus();
            }
          }

          function sendResponse(value) {
            if (isDisposed) return;

            debugLog('sendResponse called', { value: value, vsCodeAvailable: !!vscode });

            try {
              const message = {
                command: 'response',
                value: value
              };
              debugLog('Sending message to extension', message);
              
              vscode.postMessage(message);

              // Mark as disposed to prevent further interactions
              isDisposed = true;

              // Disable all interactive elements
              const interactiveElements = document.querySelectorAll('button, input, textarea, select');
              interactiveElements.forEach(element => {
                element.disabled = true;
              });

              debugLog('Response sent successfully, popup disposed');

            } catch (error) {
              debugLog('Failed to send response', error);
            }
          }

          // Error handling
          window.addEventListener('error', (event) => {
            console.error('Popup error:', event.error);
            
            if (!isDisposed) {
              try {
                vscode.postMessage({
                  command: 'error',
                  error: event.error?.message || 'Unknown error'
                });
              } catch (e) {
                console.error('Failed to report error:', e);
              }
            }
          });

          // Send debug messages to extension log
          function debugLog(message, data) {
            try {
              vscode.postMessage({
                command: 'debug',
                message: message,
                data: data
              });
            } catch (e) {
              console.log('Debug:', message, data);
            }
          }

          // Initialize vscode API and popup
          let vscode;
          try {
            vscode = acquireVsCodeApi();
            debugLog('Popup webview script loaded', { readyState: document.readyState });
            
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initializePopup);
            } else {
              initializePopup();
            }
          } catch (error) {
            console.error('Failed to initialize popup:', error);
          }
        })();
      </script>
    </body>
    </html>`;
  }

  /**
   * Formats content with markdown support
   */
  private formatContent(content: string): string {
    try {
      // Use micromark for proper Markdown parsing
      return micromark(content);
    } catch (error) {
      // Fallback to escaped HTML if markdown parsing fails
      console.warn('Markdown parsing failed, falling back to plain text:', error);
      return this.escapeHtml(content);
    }
  }

  /**
   * Handles messages received from the webview
   */
  private handleWebviewMessage(message: unknown, request: PopupRequest): void {
    try {
      console.log('PopupWebview received message:', message);
      
      // Type guard for message object
      if (typeof message !== 'object' || message === null) {
        throw new Error('Invalid message format received from webview');
      }
      
      const msg = message as { command?: string; value?: string; error?: string };
      console.log('Parsed message:', msg);
      
      if (msg.command === 'ready') {
        console.log('Popup ready message received');
        // Popup is ready, notify extension to play chime
        this.onPopupReady?.();
      } else if (msg.command === 'response' && this.responseCallback) {
        console.log('Response message received:', msg.value);
        // Validate message data
        if (!msg.value || typeof msg.value !== 'string') {
          throw new Error('Invalid response value received from webview');
        }

        const response: PopupResponse = {
          requestId: request.requestId,
          selectedValue: msg.value
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
      } else if (msg.command === 'error') {
        // Handle errors from the webview
        const errorMsg = `Webview error: ${msg.error || 'Unknown error'}`;
        console.error(errorMsg);
        
        vscode.window.showErrorMessage(errorMsg);
        this.dispose();
      } else if (msg.command === 'debug') {
        // Handle debug messages from webview
        const debugMsg = msg as { command: string; message?: string; data?: unknown };
        console.log(`[Webview Debug] ${debugMsg.message}`, debugMsg.data);
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
    if (!unsafe || typeof unsafe !== 'string') {
      return '';
    }
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Normalizes workspace paths for comparison (handles different path separators, etc.)
   */
  private normalizeWorkspacePath(workspacePath: string): string {
    if (!workspacePath) {return '';}
    // Convert to forward slashes and remove trailing slash
    return workspacePath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
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
    
    // Dispose chime player
    this.chimePlayer.dispose();
    
    this.responseCallback = undefined;
    this.onPopupReady = undefined;
  }

  /**
   * Checks if the webview is currently active
   */
  public isActive(): boolean {
    return this.panel !== undefined && this.panel.visible;
  }
}
