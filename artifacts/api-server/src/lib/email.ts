import { Resend } from "resend";
import { logger } from "./logger";

let cachedSettings: { apiKey: string; fromEmail: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  if (cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Replit connectors not configured");
  }

  const res = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  );
  const data = await res.json() as { items?: Array<{ settings: { api_key?: string; from_email?: string } }> };
  const conn = data.items?.[0];
  if (!conn?.settings?.api_key) {
    throw new Error("Resend not connected");
  }

  cachedSettings = {
    apiKey: conn.settings.api_key,
    fromEmail: conn.settings.from_email || "onboarding@resend.dev",
  };
  cachedAt = Date.now();
  return cachedSettings;
}

export async function sendOtpEmail(to: string, otp: string, firstName?: string | null): Promise<boolean> {
  try {
    const { apiKey, fromEmail } = await getResendCredentials();
    const client = new Resend(apiKey);

    const greeting = firstName ? `Hi ${firstName},` : "Hello,";

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#0f1724;border:1px solid #1f2937;border-radius:16px;padding:40px;text-align:center;">
      <div style="display:inline-block;width:56px;height:56px;background:rgba(16,185,129,0.12);border-radius:14px;line-height:56px;font-size:28px;margin-bottom:16px;">🛡️</div>
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px 0;">Crestfield Bank</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 32px 0;">Verify your email address</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;text-align:left;margin:0 0 24px 0;">${greeting}</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;text-align:left;margin:0 0 24px 0;">Use the verification code below to complete your account setup. This code is valid for 15 minutes.</p>
      <div style="background:#0a0f1a;border:1px solid #1f2937;border-radius:12px;padding:24px;margin:0 0 24px 0;">
        <div style="color:#10b981;font-size:36px;font-weight:700;letter-spacing:8px;font-family:'SF Mono',Menlo,monospace;">${otp}</div>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;text-align:left;margin:0;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
    </div>
    <p style="color:#4b5563;font-size:12px;text-align:center;margin:24px 0 0 0;">© ${new Date().getFullYear()} Crestfield Bank. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    const text = `${greeting}\n\nYour Crestfield Bank verification code is: ${otp}\n\nThis code is valid for 15 minutes.\n\nIf you didn't request this code, you can safely ignore this email.\n\n— Crestfield Bank`;

    const result = await client.emails.send({
      from: `Crestfield Bank <${fromEmail}>`,
      to,
      subject: `Your Crestfield Bank verification code: ${otp}`,
      html,
      text,
    });

    if (result.error) {
      logger.error({ err: result.error, to }, "Resend returned error sending OTP email");
      return false;
    }
    logger.info({ to, id: result.data?.id }, "OTP email sent");
    return true;
  } catch (e) {
    logger.error({ e, to }, "Failed to send OTP email");
    return false;
  }
}

export async function sendWelcomeEmail(to: string, firstName: string, accountNumber: string): Promise<boolean> {
  try {
    const { apiKey, fromEmail } = await getResendCredentials();
    const client = new Resend(apiKey);

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#0f1724;border:1px solid #1f2937;border-radius:16px;padding:40px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:56px;height:56px;background:rgba(16,185,129,0.12);border-radius:14px;line-height:56px;font-size:28px;">🛡️</div>
      </div>
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px 0;text-align:center;">Welcome to Crestfield Bank</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 32px 0;text-align:center;">Your account is ready</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hi ${firstName},</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px 0;">Thank you for choosing Crestfield Bank. Your account has been successfully created and is ready to use.</p>
      <div style="background:#0a0f1a;border:1px solid #1f2937;border-radius:12px;padding:20px;margin:0 0 24px 0;">
        <div style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Account Number</div>
        <div style="color:#10b981;font-size:20px;font-weight:600;font-family:'SF Mono',Menlo,monospace;">${accountNumber}</div>
      </div>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px 0;">You can now sign in to access your dashboard, send transfers, manage cards, and more.</p>
    </div>
    <p style="color:#4b5563;font-size:12px;text-align:center;margin:24px 0 0 0;">© ${new Date().getFullYear()} Crestfield Bank. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    const result = await client.emails.send({
      from: `Crestfield Bank <${fromEmail}>`,
      to,
      subject: "Welcome to Crestfield Bank",
      html,
      text: `Hi ${firstName},\n\nWelcome to Crestfield Bank! Your account ${accountNumber} is ready to use.\n\n— Crestfield Bank`,
    });

    if (result.error) {
      logger.error({ err: result.error, to }, "Resend returned error sending welcome email");
      return false;
    }
    return true;
  } catch (e) {
    logger.error({ e, to }, "Failed to send welcome email");
    return false;
  }
}
