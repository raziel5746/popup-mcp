/**
 * Project Structure Validation Script
 * Validates that all required directories and files exist according to unified project structure
 * This is a basic validation that will be replaced with proper Jest tests in Story 1.3
 */

const fs = require('fs');
const path = require('path');

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function validateProjectStructure() {
  console.log('🔍 Validating Project Structure...\n');
  
  const projectRoot = path.resolve(__dirname, '../..');
  
  // Validate Root Files
  console.log('📁 Checking Root Files:');
  
  const readmePath = path.join(projectRoot, 'README.md');
  assert(fs.existsSync(readmePath), 'README.md exists');
  
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  assert(readmeContent.includes('Popup MCP Extension'), 'README contains project title');
  assert(readmeContent.includes('Development Environment Setup'), 'README contains development setup instructions');
  
  const gitignorePath = path.join(projectRoot, '.gitignore');
  assert(fs.existsSync(gitignorePath), '.gitignore exists');
  
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  assert(gitignoreContent.includes('node_modules/'), '.gitignore contains node_modules pattern');
  assert(gitignoreContent.includes('dist/'), '.gitignore contains dist pattern');
  assert(gitignoreContent.includes('.env'), '.gitignore contains .env pattern');
  
  // Validate Directory Structure
  console.log('\n📁 Checking Directory Structure:');
  
  const testsDir = path.join(projectRoot, 'tests');
  const unitDir = path.join(testsDir, 'unit');
  const integrationDir = path.join(testsDir, 'integration');
  const e2eDir = path.join(testsDir, 'e2e');
  
  assert(fs.existsSync(testsDir), 'tests directory exists');
  assert(fs.existsSync(unitDir), 'tests/unit directory exists');
  assert(fs.existsSync(integrationDir), 'tests/integration directory exists');
  assert(fs.existsSync(e2eDir), 'tests/e2e directory exists');
  
  const docsDir = path.join(projectRoot, 'docs');
  assert(fs.existsSync(docsDir), 'docs directory exists');
  
  // Validate Git Repository
  console.log('\n📁 Checking Git Repository:');
  
  const gitDir = path.join(projectRoot, '.git');
  assert(fs.existsSync(gitDir), 'Git repository initialized');
  
  // Verify gitignore patterns
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
    assert(gitignoreContent.includes(pattern), `.gitignore contains ${pattern} pattern`);
  });
  
  console.log('\n🎉 All validations passed! Project structure is correct.');
  return true;
}

// Run validation if this file is executed directly
if (require.main === module) {
  try {
    validateProjectStructure();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateProjectStructure };
