'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailPayload = {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
}

export async function sendEmail({ to, subject, html, from = 'onboarding@resend.dev' }: EmailPayload) {
  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: to,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw new Error('Failed to send email.');
    }

    console.log('Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
}
