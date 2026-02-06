/**
 * Shared email sending utility using Resend API
 * Ported from Supabase Edge Functions (_shared/email/sendEmail.ts)
 */

const DEFAULT_FROM = 'Pillaxia <noreply@thedatainnovationhub.com>';

/**
 * Send an email using the Resend API
 * @param {{ to: string[], subject: string, html: string, from?: string, replyTo?: string }} options
 * @returns {Promise<{ id: string }>}
 */
export async function sendEmail(options) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const { to, subject, html, from = DEFAULT_FROM, replyTo } = options;
  const body = { from, to, subject, html };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }

  const data = await res.json();
  return { id: data.id };
}
