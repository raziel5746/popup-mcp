/**
 * Mock implementation of micromark for Jest tests
 */

export function micromark(content: string): string {
  // Simple mock that just escapes HTML and handles basic markdown
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
    .replace(/\n/g, '<br>'); // Line breaks
}
