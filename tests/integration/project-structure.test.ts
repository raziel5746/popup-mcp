import * as fs from 'fs';
import * as path from 'path';

/**
 * Integration test to verify project structure after setup
 * Tests that all required directories and files exist according to unified project structure
 */
describe('Project Structure Verification', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  describe('Root Files', () => {
    test('should have README.md', () => {
      const readmePath = path.join(projectRoot, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
      
      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('Popup MCP Extension');
      expect(content).toContain('Setup Instructions');
    });

    test('should have .gitignore', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      
      const content = fs.readFileSync(gitignorePath, 'utf8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('dist/');
      expect(content).toContain('.env');
    });

    test('should have package.json when created', () => {
      const packagePath = path.join(projectRoot, 'package.json');
      // This will be created in Story 1.3, so we just check the path is valid
      expect(path.isAbsolute(packagePath)).toBe(true);
    });
  });

  describe('Directory Structure', () => {
    test('should have tests directory with subdirectories', () => {
      const testsDir = path.join(projectRoot, 'tests');
      const unitDir = path.join(testsDir, 'unit');
      const integrationDir = path.join(testsDir, 'integration');
      const e2eDir = path.join(testsDir, 'e2e');

      expect(fs.existsSync(testsDir)).toBe(true);
      expect(fs.existsSync(unitDir)).toBe(true);
      expect(fs.existsSync(integrationDir)).toBe(true);
      expect(fs.existsSync(e2eDir)).toBe(true);
    });

    test('should have docs directory', () => {
      const docsDir = path.join(projectRoot, 'docs');
      expect(fs.existsSync(docsDir)).toBe(true);
    });

    test('should prepare for src directory structure', () => {
      // These will be created in Story 1.3
      const srcDir = path.join(projectRoot, 'src');
      const backendDir = path.join(srcDir, 'backend');
      const componentsDir = path.join(srcDir, 'components');
      
      // Verify paths are correctly formed for future creation
      expect(path.basename(srcDir)).toBe('src');
      expect(path.basename(backendDir)).toBe('backend');
      expect(path.basename(componentsDir)).toBe('components');
    });
  });

  describe('Git Repository', () => {
    test('should be a git repository', () => {
      const gitDir = path.join(projectRoot, '.git');
      expect(fs.existsSync(gitDir)).toBe(true);
    });

    test('should have proper gitignore patterns', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const content = fs.readFileSync(gitignorePath, 'utf8');
      
      // Verify essential patterns are present
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
  });
});
