import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('[v0] Email configuration missing. Email sending will be disabled.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.warn('[v0] Email not sent - SMTP not configured');
    return null;
  }

  try {
    const result = await transporter.sendMail({
      from: options.from || process.env.SMTP_FROM || 'noreply@sterlingbank.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return result;
  } catch (error) {
    console.error('[v0] Email sending failed:', error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Verify your Sterling Bank account',
    html: `
      <h2>Verify Your Email</h2>
      <p>Click the link below to verify your account:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Reset your Sterling Bank password',
    html: `
      <h2>Reset Your Password</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `,
  });
}

export async function sendTransactionNotification(email: string, transaction: any) {
  return sendEmail({
    to: email,
    subject: `Transaction Confirmation - ${transaction.type}`,
    html: `
      <h2>Transaction Confirmation</h2>
      <p>Amount: ${transaction.amount}</p>
      <p>Type: ${transaction.type}</p>
      <p>Status: ${transaction.status}</p>
      <p>Date: ${new Date(transaction.createdAt).toLocaleString()}</p>
    `,
  });
}
