
'use server';

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { users } from '@/lib/data';

type EmailPayload = {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    resellerId?: string;
}

export async function sendEmail({ to, subject, html, from, resellerId }: EmailPayload) {
  
  // Logic to decide which email service to use
  const reseller = users.find(u => u.id === resellerId && u.role === 'reseller');
  const admin = users.find(u => u.role === 'admin');

  const smtpConfig = reseller?.smtpDetails || admin?.smtpDetails;
  const fromAddress = from || smtpConfig?.user || 'onboarding@resend.dev';
  
  if (smtpConfig && smtpConfig.host && smtpConfig.pass) {
    // Use Nodemailer with SMTP
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port, 10),
      secure: parseInt(smtpConfig.port, 10) === 465, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html,
        });
        console.log('Email sent successfully via SMTP:', info.messageId);
        return info;
    } catch (error) {
        console.error('Nodemailer Error:', error);
        throw new Error('Failed to send email via SMTP.');
    }
  } else {
    // Fallback to Resend - might fail if no API key
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Email sending will likely fail.');
        throw new Error('Email provider is not configured. Missing RESEND_API_KEY and no SMTP settings found.');
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
        const { data, error } = await resend.emails.send({
        from: from || 'onboarding@resend.dev',
        to: to,
        subject: subject,
        html: html,
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
