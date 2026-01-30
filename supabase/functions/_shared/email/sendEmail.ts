/**
 * Shared email sending utility using Resend API
 */

export interface EmailResult {
  id: string;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

const DEFAULT_FROM = "Pillaxia <noreply@thedatainnovationhub.com>";

/**
 * Send an email using the Resend API
 * @param options - Email configuration options
 * @returns The email ID from Resend
 * @throws Error if the API call fails
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { to, subject, html, from = DEFAULT_FROM, replyTo } = options;

  const body: Record<string, unknown> = {
    from,
    to,
    subject,
    html,
  };

  if (replyTo) {
    body.reply_to = replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
