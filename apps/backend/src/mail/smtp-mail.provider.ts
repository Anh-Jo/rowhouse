import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { MailProvider } from './mail.provider';
import type { SendMailOptions } from './mail.d.ts';

export class SmtpMailProvider extends MailProvider {
  private transporter: Transporter;

  constructor() {
    super();
    const smtpHost = env.get('SMTP_HOST');
    const smtpPort = env.get('SMTP_PORT');
    const smtpUser = env.get('SMTP_USER');
    const smtpPass = env.get('SMTP_PASS');

    if (smtpHost && smtpPort) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: env.get('SMTP_SECURE'),
        auth:
          smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      });
    } else {
      // Development: use stream transport; message is returned as Buffer
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail(options);
  }
}
