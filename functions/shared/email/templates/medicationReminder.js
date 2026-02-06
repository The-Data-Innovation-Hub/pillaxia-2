/**
 * Medication reminder email template
 * Ported from Supabase Edge Functions (_shared/email/templates/medicationReminder.ts)
 */

import { escapeHtml } from '../escapeHtml.js';

/**
 * Build the medication list HTML table rows
 * @param {Array<{ med_name: string, dosage: string, dosage_unit: string, form: string, quantity: number, with_food: boolean, scheduled_time: string }>} doses
 */
function buildMedicationRows(doses) {
  return doses
    .map((dose) => {
      const scheduledTime = new Date(dose.scheduled_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const safeName = escapeHtml(dose.med_name);
      const safeDosage = escapeHtml(dose.dosage);
      const safeDosageUnit = escapeHtml(dose.dosage_unit);
      const safeForm = escapeHtml(dose.form);

      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${safeName}</strong><br/>
          <span style="color: #6b7280; font-size: 14px;">
            ${dose.quantity || 1}x ${safeDosage} ${safeDosageUnit} ${safeForm}
            ${dose.with_food ? ' • Take with food' : ''}
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          <strong>${scheduledTime}</strong>
        </td>
      </tr>
    `;
    })
    .join('');
}

/**
 * Generate the medication reminder email HTML
 * @param {{ firstName: string, doses: Array<object> }} data
 * @returns {string}
 */
export function generateMedicationReminderHtml(data) {
  const firstName = escapeHtml(data.firstName || 'there');
  const medicationListHtml = buildMedicationRows(data.doses);
  const doseCount = data.doses.length;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">💊 Medication Reminder</h1>
          </div>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">
            Hi ${firstName},
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">
            You have upcoming medication${doseCount > 1 ? 's' : ''} to take soon:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Medication</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${medicationListHtml}
            </tbody>
          </table>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-top: 24px;">
            Remember to mark your doses as taken in the Pillaxia app to track your adherence.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This reminder was sent by Pillaxia. If you no longer wish to receive these reminders, 
            please update your notification preferences in the app.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate the email subject line
 * @param {number} doseCount
 * @returns {string}
 */
export function generateMedicationReminderSubject(doseCount) {
  return `💊 Medication Reminder: ${doseCount} dose${doseCount > 1 ? 's' : ''} coming up`;
}
