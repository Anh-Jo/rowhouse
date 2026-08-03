import type { SendMailOptions } from './mail.d.ts';

export abstract class MailProvider {
  abstract sendMail(options: SendMailOptions): Promise<void>;
}
