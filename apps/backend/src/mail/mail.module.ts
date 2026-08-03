import { Module } from '@nestjs/common';
import { MailProvider } from './mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';
import { MailService } from './mail.service';

@Module({
  providers: [
    { provide: MailProvider, useClass: SmtpMailProvider },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
