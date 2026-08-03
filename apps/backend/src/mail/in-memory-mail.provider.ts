import { MailProvider } from './mail.provider';
import type { SendMailOptions } from './mail.d.ts';

export class InMemoryMailProvider extends MailProvider {
  public sentMails: SendMailOptions[] = [];

  async sendMail(options: SendMailOptions): Promise<void> {
    this.sentMails.push(options);
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
  }
}
