/**
 * Jest setup file for test configuration
 */

// Mock VS Code API for tests
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue?: any) => defaultValue)
    })),
    onDidChangeConfiguration: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  ExtensionContext: jest.fn()
}), { virtual: true });

// Mock Node.js modules that might not be available in test environment
jest.mock('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, host, callback) => callback && callback()),
    close: jest.fn((callback) => callback && callback()),
    on: jest.fn(),
    address: jest.fn(() => ({ port: 3000 }))
  }))
}));

jest.mock('net', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  })),
  AddressInfo: jest.fn()
}));

// Set up global test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Mock console methods to reduce noise in test output
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods after each test
  jest.restoreAllMocks();
});
