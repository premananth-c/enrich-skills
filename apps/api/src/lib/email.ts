import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@enrich-skills.local';
const INVITE_BASE_URL = process.env.INVITE_BASE_URL || 'http://localhost:5173';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendAdminInviteEmail(to: string, tempPassword: string): Promise<void> {
  const adminUrl = process.env.ADMIN_WEB_URL || 'http://localhost:5174';
  const loginUrl = `${adminUrl}/login`;
  const subject = "You've been invited as an admin on RankerShip";

  const html = `
    <p>You have been invited as an admin on <strong>RankerShip</strong> (by Vihaan Digital Solutions).</p>
    <p>Use the credentials below to log in:</p>
    <table style="border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email:</td><td>${to}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Temporary Password:</td><td><code>${tempPassword}</code></td></tr>
    </table>
    <p>Please change your password after logging in.</p>
    <p>
      <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background:#4338ca;color:#fff;text-decoration:none;border-radius:6px;">
        Log in to Admin Panel
      </a>
    </p>
    <p>Or copy this link: ${loginUrl}</p>
    <p>If you didn't expect this email, you can ignore it.</p>
  `;

  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — admin invite for', to, '| temp password:', tempPassword, '| login:', loginUrl);
    return;
  }

  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export type InviteEmailContext = {
  testTitle?: string;
  batchName?: string;
  courseName?: string;
};

export async function sendInviteEmail(to: string, token: string, context?: InviteEmailContext): Promise<void> {
  const inviteUrl = `${INVITE_BASE_URL}/invite?token=${encodeURIComponent(token)}`;
  const { testTitle, batchName, courseName } = context || {};
  const subjectBits = [
    testTitle && `Test: ${testTitle}`,
    batchName && `Batch: ${batchName}`,
    courseName && `Course: ${courseName}`,
  ].filter(Boolean) as string[];
  const subject =
    subjectBits.length > 0
      ? `You're invited — ${subjectBits.join(' · ')}`
      : "You're invited to join Ranker Ship (by Vihaan Digital Solutions)";

  const html = `
    <p>You have been invited to join Ranker Ship (by Vihaan Digital Solutions).</p>
    ${testTitle ? `<p>You have been assigned to the test: <strong>${testTitle}</strong>.</p>` : ''}
    ${batchName ? `<p>You will be added to the batch: <strong>${batchName}</strong> after you sign up.</p>` : ''}
    ${courseName ? `<p>You will be enrolled in the course: <strong>${courseName}</strong> after you sign up.</p>` : ''}
    <p>Click the link below to create your account and complete your profile. This link expires in 2 days.</p>
    <p>
      <a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:6px;">
        Accept invite &amp; sign up
      </a>
    </p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>If you didn't expect this email, you can ignore it.</p>
  `;

  if (!resend) {
    // Dev fallback — no API key configured yet
    console.log('[email] RESEND_API_KEY not set — invite link for', to, ':', inviteUrl);
    return;
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendMeetingInviteEmail(
  to: string,
  meetingName: string,
  joinUrl: string,
  meetingType: 'interactive_meeting' | 'webinar',
  scheduledAt?: Date | null,
): Promise<void> {
  const typeLabel = meetingType === 'webinar' ? 'Webinar' : 'Live Meeting';
  const subject = `You're invited to a ${typeLabel}: ${meetingName}`;
  const dateStr = scheduledAt
    ? `<p><strong>Scheduled:</strong> ${scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>`
    : '';

  const html = `
    <p>You have been invited to join a <strong>${typeLabel}</strong> on RankerShip.</p>
    <p><strong>${meetingName}</strong></p>
    ${dateStr}
    <p>Click the button below to join when the meeting starts:</p>
    <p>
      <a href="${joinUrl}" style="display:inline-block;padding:10px 20px;background:#4338ca;color:#fff;text-decoration:none;border-radius:6px;">
        Join ${typeLabel}
      </a>
    </p>
    <p>Or copy this link: ${joinUrl}</p>
    <p>If you didn't expect this email, you can ignore it.</p>
  `;

  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — meeting invite for', to, ':', joinUrl);
    return;
  }

  const { error: emailError } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (emailError) {
    console.error('[email] Resend error:', emailError);
    throw new Error(`Failed to send email: ${emailError.message}`);
  }
}
