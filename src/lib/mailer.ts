export interface MailSendResult {
  delivered: boolean;
  provider: 'resend' | 'console';
  devPreview?: {
    enabled: boolean;
    verifyUrl?: string;
    code?: string;
  };
}

function buildEmailHtml(params: {
  eyebrow: string;
  heading: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  code?: string;
  footerNote: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${params.heading}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background-color:#09090B;color:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background-color:#121215;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
      <tr>
        <td style="padding:36px 32px;text-align:center;background:radial-gradient(circle at top,rgba(212,175,55,0.16),transparent 65%);">
          <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.24em;color:#FAFAFA;font-weight:600;">KINOSTREAM</div>
          <div style="margin-top:6px;font-size:10px;letter-spacing:0.26em;color:#71717A;text-transform:uppercase;">BY ZEROPULSE</div>
          <div style="margin-top:24px;font-size:11px;letter-spacing:0.2em;color:#D4AF37;text-transform:uppercase;font-weight:600;">${params.eyebrow}</div>
          <h1 style="margin:10px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:500;color:#FAFAFA;">${params.heading}</h1>
          <p style="margin:14px auto 0;max-width:400px;font-size:14px;line-height:1.6;color:#A1A1AA;">${params.bodyText}</p>
          ${
            params.ctaUrl && params.ctaLabel
              ? `<div style="margin-top:28px;">
                  <a href="${params.ctaUrl}" style="display:inline-block;padding:14px 32px;background-color:#D4AF37;color:#09090B;text-decoration:none;border-radius:9999px;font-size:14px;font-weight:700;">${params.ctaLabel}</a>
                </div>`
              : ''
          }
          ${
            params.code
              ? `<div style="margin:28px auto 0;display:inline-block;padding:16px 28px;background-color:#09090B;border:1px solid rgba(212,175,55,0.4);border-radius:16px;font-family:Georgia,serif;font-size:32px;letter-spacing:0.32em;color:#E2C275;font-weight:700;">${params.code}</div>`
              : ''
          }
          <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#71717A;">${params.footerNote}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const from =
    process.env.EMAIL_FROM?.trim() || 'KinoStream <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }

  return true;
}

export async function sendVerificationLinkEmail(params: {
  to: string;
  verifyUrl: string;
}): Promise<MailSendResult> {
  const subject = 'Verify your email for KinoStream';
  const html = buildEmailHtml({
    eyebrow: 'Step 1 · Email Verification',
    heading: 'Confirm Your Email Address',
    bodyText:
      'Tap the button below to verify your email address. Once confirmed, we will send your 6-digit KinoStream access code.',
    ctaLabel: 'Verify Email Address',
    ctaUrl: params.verifyUrl,
    footerNote:
      'This verification link expires in 15 minutes. If you did not request sign-in access, you can safely ignore this message.',
  });

  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  if (hasResend) {
    await sendViaResend({ to: params.to, subject, html });
    return { delivered: true, provider: 'resend' };
  }

  console.info(
    `\n[KinoStream Auth] Verification Link for ${params.to}:\n${params.verifyUrl}\n`
  );

  return {
    delivered: true,
    provider: 'console',
    devPreview:
      process.env.NODE_ENV === 'development'
        ? { enabled: true, verifyUrl: params.verifyUrl }
        : undefined,
  };
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
}): Promise<MailSendResult> {
  const subject = `Your KinoStream Verification Code: ${params.code}`;
  const html = buildEmailHtml({
    eyebrow: 'Step 2 · 6-Digit Access Code',
    heading: 'Your KinoStream Access Code',
    bodyText:
      'Enter this 6-digit verification code on your KinoStream sign-in screen to unlock full access.',
    code: params.code,
    footerNote:
      'This code expires in 15 minutes. Never share this code with anyone.',
  });

  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  if (hasResend) {
    await sendViaResend({ to: params.to, subject, html });
    return { delivered: true, provider: 'resend' };
  }

  console.info(
    `\n[KinoStream Auth] 6-Digit Verification Code for ${params.to}: ${params.code}\n`
  );

  return {
    delivered: true,
    provider: 'console',
    devPreview:
      process.env.NODE_ENV === 'development'
        ? { enabled: true, code: params.code }
        : undefined,
  };
}
