import { Injectable } from '@nestjs/common';
import { env } from '@/config/env';
import { MailProvider } from './mail.provider';
import type { SendMailOptions } from './mail.d.ts';

@Injectable()
export class MailService {
  constructor(private readonly mailProvider: MailProvider) {}

  async sendMail(
    options: Omit<SendMailOptions, 'from'> & { from?: string },
  ): Promise<void> {
    const from = options.from ?? env.get('MAIL_FROM');

    await this.mailProvider.sendMail({ ...options, from });
  }
}
