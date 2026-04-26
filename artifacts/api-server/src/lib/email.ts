// @ts-nocheck
import { Resend } from "resend";
import { logger } from "./logger.js";
import { LOGO_DATA_URL } from "./brand.js";

let cachedSettings: { apiKey: string; fromEmail: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is missing in Vercel.");
  }

  return {
    apiKey,
    // Defaults to Resend's testing email, but you can override it in Vercel later
    fromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  };
}

function emailHeader(): string {
  return `
    <div style="text-align:center;padding:24px 0 16px 0;">
      <img src="${LOGO_DATA_URL}" alt="Crestfield Bank" width="72" height="72" style="display:inline-block;border-radius:18px;background:#fff;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,0.18);" />
      <div style="color:#0f172a;font-size:18px;font-weight:700;letter-spacing:0.2px;margin-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Crestfield Bank</div>
    </div>
  `;
}

function emailFooter(): string {
  return `
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      © ${new Date().getFullYear()} Crestfield Bank · Banking. Technology. Future.
    </p>
  `;
}

function wrapEmail(innerHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    ${emailHeader()}
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;color:#0f172a;">
      ${innerHtml}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

export async function sendOtpEmail(to: string, otp: string, firstName?: string | null): Promise<boolean> {
  try {
    const { apiKey, fromEmail } = await getResendCredentials();
    const client = new Resend(apiKey);

    const greeting = firstName ? `Hi ${firstName},` : "Hello,";

    const inner = `
      <h2 style="color:#0f172a;font-size:20px;margin:0 0 4px 0;text-align:center;font-weight:700;">Verify your email address</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px 0;text-align:center;">Enter this code to continue securely</p>
      <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 12px 0;">${greeting}</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px 0;">Use the verification code below to complete your account setup. This code is valid for 15 minutes.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 20px 0;text-align:center;">
        <div style="color:#0ea271;font-size:32px;font-weight:700;letter-spacing:10px;font-family:'SF Mono',Menlo,monospace;">${otp}</div>
      </div>
      <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
    `;

    const html = wrapEmail(inner);
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

    const inner = `
      <h2 style="color:#0f172a;font-size:22px;margin:0 0 4px 0;text-align:center;font-weight:700;">Welcome to Crestfield Bank</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px 0;text-align:center;">Your account is ready</p>
      <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 12px 0;">Hi ${firstName},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px 0;">Thank you for choosing Crestfield Bank. Your account has been successfully created and is ready to use.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:0 0 20px 0;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Account Number</div>
        <div style="color:#0ea271;font-size:20px;font-weight:600;font-family:'SF Mono',Menlo,monospace;">${accountNumber}</div>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6;margin:0;">You can now sign in to access your dashboard, send transfers, manage cards, and more.</p>
    `;

    const html = wrapEmail(inner);

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
