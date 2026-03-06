import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@enrich-skills.local';
const INVITE_BASE_URL = process.env.INVITE_BASE_URL || 'http://localhost:5173';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendInviteEmail(to: string, token: string, testTitle?: string): Promise<void> {
  const inviteUrl = `${INVITE_BASE_URL}/invite?token=${encodeURIComponent(token)}`;
  const subject = testTitle
    ? `You're invited to take a test: ${testTitle}`
    : "You're invited to join Ranker Ship (by Vihaan Digital Solutions)";

  const html = `
    <p>You have been invited to join Ranker Ship (by Vihaan Digital Solutions).</p>
    ${testTitle ? `<p>You have been assigned to the test: <strong>${testTitle}</strong>.</p>` : ''}
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
