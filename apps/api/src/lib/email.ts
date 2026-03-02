const INVITE_BASE_URL = process.env.INVITE_BASE_URL || 'http://localhost:5173';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@enrich-skills.local';

async function getTransporter() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const nodemailer = await import('nodemailer');
    return nodemailer.default.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: SMTP_PORT === '465',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return null;
}

export async function sendInviteEmail(to: string, token: string, testTitle?: string): Promise<void> {
  const inviteUrl = `${INVITE_BASE_URL}/invite?token=${encodeURIComponent(token)}`;
  const subject = testTitle
    ? `You're invited to take a test: ${testTitle}`
    : "You're invited to join Enrich Skills";
  const html = `
    <p>You have been invited to join Enrich Skills.</p>
    ${testTitle ? `<p>You have been assigned to the test: <strong>${testTitle}</strong>.</p>` : ''}
    <p>Click the link below to create your account and complete your profile. This link expires in 2 days.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:6px;">Accept invite & sign up</a></p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>If you didn't expect this email, you can ignore it.</p>
  `;

  const transporter = await getTransporter();
  if (transporter) {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
  } else {
    // Dev fallback: log the link (no nodemailer required)
    console.log('[Invite email not configured - invite link for', to, ']:', inviteUrl);
  }
}
