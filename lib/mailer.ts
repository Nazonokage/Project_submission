import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not set. Add them to .env.local');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

export async function sendOtpEmail(to: string, otp: string) {
  const t = getTransporter();
  await t.sendMail({
    from: `"Project Submissions" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your login code: ${otp}`,
    text: `Your one-time login code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">Your login code</h2>
        <p style="color:#6b7280; margin-top:0;">Expires in 10 minutes.</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px;">
          ${otp}
        </p>
        <p style="color:#6b7280; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
