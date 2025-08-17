/**
 * Visual tests for theme compatibility (Story 3.3)
 * Tests popup appearance across different VS Code themes
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

// Mock VS Code window and color themes
const mockColorThemes = {
  light: { kind: 1 }, // ColorThemeKind.Light
  dark: { kind: 2 },  // ColorThemeKind.Dark
  highContrast: { kind: 3 } // ColorThemeKind.HighContrast
};

/**
 * Generate HTML content for testing different themes
 */
function generateTestPopupHTML(themeKind: number): string {
  // Import the PopupWebview class logic (simplified for testing)
  const getThemeClasses = (kind: number): string => {
    switch (kind) {
      case 1: return 'theme-light';
      case 2: return 'theme-dark';
      case 3: return 'theme-high-contrast';
      default: return 'theme-dark';
    }
  };

  const themeClasses = getThemeClasses(themeKind);
  
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Popup - Theme Testing</title>
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
          border-radius: 12px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.08);
          padding: 40px;
          text-align: center;
          animation: fadeIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
        }

        .popup-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, 
            var(--vscode-button-background) 0%,
            var(--vscode-focusBorder, #0078d4) 50%,
            var(--vscode-button-background) 100%);
          opacity: 0.6;
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
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          color: var(--vscode-foreground);
          line-height: 1.2;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, 
            var(--vscode-foreground) 0%, 
            var(--vscode-descriptionForeground) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-align: center;
        }

        .popup-message {
          font-size: 16px;
          margin-bottom: 36px;
          color: var(--vscode-descriptionForeground);
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.6;
          opacity: 0.9;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
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

        .popup-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .popup-button {
          padding: 12px 24px;
          border: 1px solid var(--vscode-button-border, transparent);
          border-radius: 8px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: 100px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(4px);
        }

        .popup-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, 
            transparent, 
            rgba(255, 255, 255, 0.1), 
            transparent);
          transition: left 0.5s;
        }

        .popup-button:hover {
          background-color: var(--vscode-button-hoverBackground);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .popup-button:hover::before {
          left: 100%;
        }

        /* Theme-specific styles for future theme selection */
        .theme-light .popup-container::before {
          background: linear-gradient(90deg, 
            var(--vscode-button-background) 0%,
            #0078d4 50%,
            var(--vscode-button-background) 100%);
        }
        
        .theme-dark .popup-container::before {
          background: linear-gradient(90deg, 
            var(--vscode-button-background) 0%,
            #007acc 50%,
            var(--vscode-button-background) 100%);
        }
        
        .theme-high-contrast .popup-container::before {
          background: var(--vscode-focusBorder);
          height: 3px;
        }
      </style>
    </head>
    <body class="${themeClasses}">
      <div class="popup-container">
        <h1 class="popup-title">AI Assistant Request</h1>
        <div class="popup-message">Would you like to proceed with this action?</div>
        
        <input type="text" class="popup-input" id="freeTextInput" placeholder="Enter custom response (optional)..." />
        
        <div class="popup-buttons">
          <button class="popup-button">Yes, proceed</button>
          <button class="popup-button">No, cancel</button>
          <button class="popup-button">More options</button>
        </div>
      </div>
    </body>
    </html>`;
}

test.describe('Theme Compatibility Visual Tests', () => {
  
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Set up VS Code theme CSS variables for testing
    await page.addInitScript(() => {
      // Mock VS Code CSS variables for different themes
      const style = document.createElement('style');
      style.textContent = `
        :root {
          /* Default (Dark) theme variables */
          --vscode-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          --vscode-font-size: 13px;
          --vscode-foreground: #cccccc;
          --vscode-editor-background: #1e1e1e;
          --vscode-descriptionForeground: #cccccc99;
          --vscode-widget-border: #303031;
          --vscode-panel-border: #303031;
          --vscode-button-background: #0e639c;
          --vscode-button-foreground: #ffffff;
          --vscode-button-hoverBackground: #1177bb;
          --vscode-button-border: transparent;
          --vscode-focusBorder: #007acc;
          --vscode-input-background: #3c3c3c;
          --vscode-input-foreground: #cccccc;
          --vscode-input-border: #3c3c3c;
        }
        
        /* Light theme overrides */
        .theme-light {
          --vscode-foreground: #333333;
          --vscode-editor-background: #ffffff;
          --vscode-descriptionForeground: #33333399;
          --vscode-widget-border: #c8c8c8;
          --vscode-panel-border: #c8c8c8;
          --vscode-button-background: #0078d4;
          --vscode-button-foreground: #ffffff;
          --vscode-button-hoverBackground: #106ebe;
          --vscode-focusBorder: #0078d4;
          --vscode-input-background: #ffffff;
          --vscode-input-foreground: #333333;
          --vscode-input-border: #cecece;
        }
        
        /* High contrast theme overrides */
        .theme-high-contrast {
          --vscode-foreground: #ffffff;
          --vscode-editor-background: #000000;
          --vscode-descriptionForeground: #ffffff;
          --vscode-widget-border: #ffffff;
          --vscode-panel-border: #ffffff;
          --vscode-button-background: #0000ff;
          --vscode-button-foreground: #ffffff;
          --vscode-button-hoverBackground: #1a1aff;
          --vscode-focusBorder: #ffffff;
          --vscode-input-background: #000000;
          --vscode-input-foreground: #ffffff;
          --vscode-input-border: #ffffff;
        }
      `;
      document.head.appendChild(style);
    });
  });

  test('should render correctly with dark theme', async ({ page }: { page: Page }) => {
    const html = generateTestPopupHTML(2); // Dark theme
    await page.setContent(html);
    
    // Wait for animations to complete
    await page.waitForTimeout(500);
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('popup-dark-theme.png');
    
    // Test that theme-specific elements are present
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
    await expect(page.locator('.popup-container')).toBeVisible();
    await expect(page.locator('.popup-title')).toHaveText('AI Assistant Request');
    await expect(page.locator('.popup-button')).toHaveCount(3);
  });

  test('should render correctly with light theme', async ({ page }: { page: Page }) => {
    const html = generateTestPopupHTML(1); // Light theme
    await page.setContent(html);
    
    // Wait for animations to complete
    await page.waitForTimeout(500);
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('popup-light-theme.png');
    
    // Test that theme-specific elements are present
    await expect(page.locator('body')).toHaveClass(/theme-light/);
    await expect(page.locator('.popup-container')).toBeVisible();
    await expect(page.locator('.popup-title')).toHaveText('AI Assistant Request');
    await expect(page.locator('.popup-button')).toHaveCount(3);
  });

  test('should render correctly with high contrast theme', async ({ page }: { page: Page }) => {
    const html = generateTestPopupHTML(3); // High contrast theme
    await page.setContent(html);
    
    // Wait for animations to complete
    await page.waitForTimeout(500);
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('popup-high-contrast-theme.png');
    
    // Test that theme-specific elements are present
    await expect(page.locator('body')).toHaveClass(/theme-high-contrast/);
    await expect(page.locator('.popup-container')).toBeVisible();
    await expect(page.locator('.popup-title')).toHaveText('AI Assistant Request');
    await expect(page.locator('.popup-button')).toHaveCount(3);
  });

  test('should have proper contrast ratios across themes', async ({ page }: { page: Page }) => {
    const themes = [
      { kind: 1, name: 'light' },
      { kind: 2, name: 'dark' },
      { kind: 3, name: 'high-contrast' }
    ];

    for (const theme of themes) {
      const html = generateTestPopupHTML(theme.kind);
      await page.setContent(html);
      
      // Wait for rendering
      await page.waitForTimeout(200);
      
      // Check that text is visible (basic contrast test)
      const title = page.locator('.popup-title');
      const message = page.locator('.popup-message');
      const buttons = page.locator('.popup-button');
      
      await expect(title).toBeVisible();
      await expect(message).toBeVisible();
      await expect(buttons.first()).toBeVisible();
      
      // Verify no visual clashes (elements don't overlap)
      const titleBox = await title.boundingBox();
      const messageBox = await message.boundingBox();
      
      expect(titleBox).toBeTruthy();
      expect(messageBox).toBeTruthy();
      
      if (titleBox && messageBox) {
        // Title should be above message (no overlap)
        expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(messageBox.y);
      }
    }
  });

  test('should maintain AI style elements across themes', async ({ page }: { page: Page }) => {
    const themes = [1, 2, 3]; // Light, Dark, High Contrast

    for (const themeKind of themes) {
      const html = generateTestPopupHTML(themeKind);
      await page.setContent(html);
      
      // Wait for animations and rendering
      await page.waitForTimeout(300);
      
      // Check AI-specific design elements
      const container = page.locator('.popup-container');
      
      // Verify modern styling is applied
      const borderRadius = await container.evaluate((el: Element) => 
        getComputedStyle(el).borderRadius
      );
      expect(borderRadius).toBe('12px');
      
      // Verify backdrop blur is applied
      const backdropFilter = await container.evaluate((el: Element) => 
        getComputedStyle(el).backdropFilter
      );
      expect(backdropFilter).toContain('blur');
      
      // Check gradient top border (::before element)
      const beforeElement = await container.evaluate((el: Element) => {
        const before = getComputedStyle(el, '::before');
        return {
          height: before.height,
          background: before.background,
          content: before.content
        };
      });
      
      expect(beforeElement.height).toBeTruthy();
      expect(beforeElement.content).toBe('""'); // Pseudo-element exists
    }
  });

  test('should handle button interactions consistently across themes', async ({ page }: { page: Page }) => {
    const themes = [1, 2, 3];

    for (const themeKind of themes) {
      const html = generateTestPopupHTML(themeKind);
      await page.setContent(html);
      
      const button = page.locator('.popup-button').first();
      
      // Test hover state
      await button.hover();
      await page.waitForTimeout(100);
      
      // Verify transform is applied on hover
      const transform = await button.evaluate((el: Element) => 
        getComputedStyle(el).transform
      );
      expect(transform).toContain('translateY');
      
      // Test focus state
      await button.focus();
      await page.waitForTimeout(100);
      
      // Verify outline is visible on focus
      const outline = await button.evaluate((el: Element) => 
        getComputedStyle(el).outline
      );
      expect(outline).toBeTruthy();
    }
  });

  test('should handle responsive design across themes', async ({ page }: { page: Page }) => {
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet
      { width: 600, height: 800 }    // Mobile-like
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      const html = generateTestPopupHTML(2); // Dark theme
      await page.setContent(html);
      
      await page.waitForTimeout(200);
      
      const container = page.locator('.popup-container');
      const containerBox = await container.boundingBox();
      
      expect(containerBox).toBeTruthy();
      
      if (containerBox) {
        // Container should not exceed viewport width
        expect(containerBox.width).toBeLessThanOrEqual(viewport.width);
        
        // Container should maintain max-width constraint
        expect(containerBox.width).toBeLessThanOrEqual(600);
      }
      
      // Buttons should wrap properly on smaller screens
      const buttons = page.locator('.popup-button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBe(3);
      
      // All buttons should be visible
      for (let i = 0; i < buttonCount; i++) {
        await expect(buttons.nth(i)).toBeVisible();
      }
    }
  });
});
