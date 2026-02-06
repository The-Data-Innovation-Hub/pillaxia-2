/**
 * HTML escape utility for XSS prevention in email templates
 * Ported from Supabase Edge Functions (_shared/email/escapeHtml.ts)
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}
