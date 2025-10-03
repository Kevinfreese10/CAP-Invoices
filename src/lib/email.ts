

'use server';

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { users } from '@/lib/data';

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
  
  const admin = users.find(u => u.role === 'admin');
  const smtpConfig = admin?.smtpDetails;
  
  let fromAddress: string;
  if (from) {
    fromAddress = from;
  } else {
    fromAddress = `"My Accountant" <${smtpConfig?.user || 'onboarding@resend.dev'}>`;
  }
  
  if (smtpConfig && smtpConfig.host && smtpConfig.pass) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port, 10),
      secure: parseInt(smtpConfig.port, 10) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
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
    } catch (error) {
        console.error('Nodemailer Error:', error);
        throw new Error('Failed to send email via SMTP.');
    }
  } else {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Email sending will likely fail.');
        throw new Error('Email provider is not configured. Missing RESEND_API_KEY and no SMTP settings found.');
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
        const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: to,
        bcc: bcc,
        subject: subject,
        html: html,
        reply_to: replyTo,
        });

        if (error) {
        console.error('Resend Error:', error);
        throw new Error('Failed to send email via Resend.');
        }

        console.log('Email sent successfully via Resend:', data);
        return data;
    } catch (error) {
        console.error('Error in sendEmail with Resend:', error);
        throw error;
    }
  }
}
