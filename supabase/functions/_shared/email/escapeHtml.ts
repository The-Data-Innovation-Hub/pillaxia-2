/**
 * HTML escape utility for XSS prevention in email templates
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param text - The raw text to escape
 * @returns The escaped HTML-safe string
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}
