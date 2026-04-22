import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  async verifyTransport() {
    this.logger.log(
      `SMTP config | host=${process.env.MAIL_HOST} port=${process.env.MAIL_PORT} secure=${process.env.MAIL_SECURE} user=${process.env.MAIL_USER}`,
    );

    await this.transporter.verify();
    this.logger.log('SMTP transport ready');
  }

  async sendVerificationEmail(params: {
    to: string;
    name: string;
    verificationToken: string;
  }) {
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const from = process.env.MAIL_FROM || 'ZWish <no-reply@example.com>';

    const verificationUrl = `${appBaseUrl}/verify-email?token=${encodeURIComponent(
      params.verificationToken,
    )}`;

    const subject = 'Vérifiez votre adresse email';

    const text = [
      `Bonjour ${params.name},`,
      '',
      'Merci pour votre inscription.',
      'Veuillez vérifier votre adresse email en cliquant sur ce lien :',
      verificationUrl,
      '',
      'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>Vérifiez votre adresse email</h2>
        <p>Bonjour <strong>${this.escapeHtml(params.name)}</strong>,</p>
        <p>Merci pour votre inscription.</p>
        <p>Veuillez vérifier votre adresse email en cliquant sur ce bouton :</p>
        <p>
          <a
            href="${verificationUrl}"
            style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;"
          >
            Vérifier mon email
          </a>
        </p>
        <p>Ou copiez ce lien dans votre navigateur :</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.</p>
      </div>
    `;

    const info = await this.transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });

    this.logger.log(
      `Verification email sent | to=${params.to} messageId=${info.messageId}`,
    );

    return info;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
