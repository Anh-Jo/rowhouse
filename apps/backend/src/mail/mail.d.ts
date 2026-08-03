/** Result of sendMail; with stream transport buffer:true, message can be a Buffer */
export type SendMailResult = {
  message?: Buffer | string;
};

export type SendMailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};
