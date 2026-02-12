interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendEmailResult {
  messageId: string;
}

/**
 * Send an email using Resend or SMTP fallback.
 * Configured via environment variables:
 * - EMAIL_PROVIDER: "resend" | "smtp" (default: "smtp")
 * - RESEND_API_KEY: API key for Resend
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP config
 * - EMAIL_FROM: sender address
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER || "smtp";

  if (provider === "resend") {
    return sendViaResend(params);
  }

  return sendViaSmtp(params);
}

async function sendViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const from = process.env.EMAIL_FROM || "noreply@primaria.ro";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { messageId: data.id };
}

async function sendViaSmtp(params: SendEmailParams): Promise<SendEmailResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require("nodemailer") as typeof import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  const from = process.env.EMAIL_FROM || "noreply@primaria.ro";

  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { messageId: info.messageId };
}
