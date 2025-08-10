/**
 * Project Structure Validation Script
 * Validates that all required directories and files exist according to unified project structure
 * This is a basic validation that will be replaced with proper Jest tests in Story 1.3
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Project Structure Validation', () => {
  const projectRoot = path.resolve(__dirname, '../../');

  it('validates root files existence', () => {
    expect(fs.existsSync(path.join(projectRoot, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, '.gitignore'))).toBe(true);
  });

  it('validates README content', () => {
    const content = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
    expect(content).toContain('Popup MCP Extension');
    expect(content).toContain('Development Environment Setup');
  });

  it('validates .gitignore content', () => {
    const content = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    expect(content).toContain('.env');
    // ... existing code ... (for additional patterns)
    const requiredPatterns = [
      'node_modules/',
      'dist/',
      '*.vsix',
      '.env',
      '*.log',
      'coverage/',
      '.DS_Store',
      'Thumbs.db'
    ];
    requiredPatterns.forEach(pattern => {
      expect(content).toContain(pattern);
    });
  });

  it('validates directory structure', () => {
    const testsDir = path.join(projectRoot, 'tests');
    expect(fs.existsSync(testsDir)).toBe(true);
    expect(fs.existsSync(path.join(testsDir, 'unit'))).toBe(true);
    expect(fs.existsSync(path.join(testsDir, 'integration'))).toBe(true);
    expect(fs.existsSync(path.join(testsDir, 'e2e'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'docs'))).toBe(true);
  });

  it('validates git repository', () => {
    expect(fs.existsSync(path.join(projectRoot, '.git'))).toBe(true);
  });
});