
'use server';

import nodemailer from 'nodemailer';

type EmailPayload = {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    bcc?: string | string[];
    resellerId?: string;
    attachments?: { filename: string; path: string }[];
    replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, bcc, resellerId, attachments, replyTo }: EmailPayload) {
  
  // Always use environment variables as the single source of truth.
  const smtpConfig = {
      host: process.env.SYSTEM_SMTP_HOST,
      port: process.env.SYSTEM_SMTP_PORT,
      user: process.env.SYSTEM_SMTP_USER,
      pass: process.env.SYSTEM_SMTP_PASS,
  };
  
  const fromAddress = `"My Accountant" <${smtpConfig.user || 'no_reply@myacc.co.za'}>`;
  
  if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      console.error('SMTP configuration is missing from environment variables.');
      throw new Error('Email server is not configured.');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port, 10),
    secure: true, // Use SSL/TLS
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: {
      // This is often required for servers with self-signed certificates
      rejectUnauthorized: false,
    },
  });

  try {
      const info = await transporter.sendMail({
          from: fromAddress,
          to: Array.isArray(to) ? to.join(', ') : to,
          bcc: bcc,
          subject: subject,
          html: html,
          attachments: attachments,
          replyTo: replyTo,
      });
      console.log('Email sent successfully via SMTP:', info.messageId);
      return info;
  } catch (error: any) {
      // Log the detailed error from nodemailer
      console.error('Nodemailer Error:', error);
      throw new Error(`SMTP Error: ${error.code || 'Unknown'} - ${error.message}`);
  }
}
