export interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract code blocks from markdown content
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'plaintext',
      code: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return codeBlocks;
}

/**
 * Check if markdown content is complete (no unclosed blocks)
 */
export function isMarkdownComplete(content: string): boolean {
  // Check for unclosed code fences
  const codeFences = content.match(/```/g);
  if (codeFences && codeFences.length % 2 !== 0) {
    return false;
  }

  // Check for unclosed inline code
  const inlineCodeMarkers = content.match(/`/g);
  if (inlineCodeMarkers && inlineCodeMarkers.length % 2 !== 0) {
    return false;
  }

  // Check for unclosed brackets/parentheses in links
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;

  if (openBrackets !== closeBrackets || openParens !== closeParens) {
    return false;
  }

  return true;
}

/**
 * Detect if content is currently inside a code block
 */
export function isInsideCodeBlock(content: string): boolean {
  const codeFences = content.match(/```/g);
  return codeFences !== null && codeFences.length % 2 !== 0;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

/**
 * Format code for display with proper indentation
 */
export function formatCode(code: string): string {
  // Remove common leading whitespace
  const lines = code.split('\n');
  const minIndent = lines
    .filter(line => line.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      return Math.min(min, indent);
    }, Infinity);

  if (minIndent === Infinity || minIndent === 0) {
    return code;
  }

  return lines
    .map(line => line.substring(minIndent))
    .join('\n');
}

/**
 * Detect language from code content heuristics
 */
export function detectLanguage(code: string): string {
  // TypeScript/JavaScript
  if (/^\s*(import|export|const|let|var|function|class|interface|type)\s/.test(code)) {
    return code.includes('interface') || code.includes('type') ? 'typescript' : 'javascript';
  }

  // Python
  if (/^\s*(def|class|import|from|print)\s/.test(code)) {
    return 'python';
  }

  // Java
  if (/^\s*(public|private|protected|class|interface)\s/.test(code)) {
    return 'java';
  }

  // C/C++
  if (/#include\s*</.test(code) || /^\s*(void|int|char|float)\s+\w+\s*\(/.test(code)) {
    return 'cpp';
  }

  // Kotlin
  if (/^\s*(fun|val|var|class|object|interface)\s/.test(code)) {
    return 'kotlin';
  }

  // HTML
  if (/<\/?[a-z][\s\S]*>/i.test(code)) {
    return 'html';
  }

  // CSS
  if (/[.#]?[\w-]+\s*\{[\s\S]*\}/.test(code)) {
    return 'css';
  }

  return 'plaintext';
}
