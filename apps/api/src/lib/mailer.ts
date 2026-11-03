import nodemailer from "nodemailer";
import type { Env } from "../config/env.js";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
}

/** Outgoing email port. SMTP in production (IONOS), Mailpit locally, fake in tests. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export function createSmtpMailer(env: Env): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: env.EMAIL_FROM, ...message });
    },
  };
}

/** In-memory mailer for tests. */
export function createFakeMailer() {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
    },
  } satisfies Mailer & { sent: EmailMessage[] };
}
