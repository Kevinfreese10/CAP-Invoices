'use server';

import nodemailer from 'nodemailer';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';

const db = getFirestore(firebaseApp);

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
  
  let fromAddress: string;
  let transportConfig: any;

  if (resellerId) {
    const resellerRef = doc(db, 'users', resellerId);
    const resellerSnap = await getDoc(resellerRef);
    if (resellerSnap.exists()) {
      const resellerData = resellerSnap.data() as User;
      if (resellerData.smtpDetails) {
        transportConfig = {
          host: resellerData.smtpDetails.host,
          port: parseInt(resellerData.smtpDetails.port, 10),
          secure: parseInt(resellerData.smtpDetails.port, 10) === 465,
          auth: {
            user: resellerData.smtpDetails.user,
            pass: resellerData.smtpDetails.pass,
          },
          tls: { rejectUnauthorized: false },
        };
        fromAddress = `"${resellerData.companyName || resellerData.name}" <${resellerData.smtpDetails.user}>`;
      }
    }
  }

  // Fallback to system default if reseller config is not found or not provided
  if (!transportConfig) {
    const systemSmtpConfig = {
      host: (process.env.SYSTEM_SMTP_HOST || '').trim(),
      port: (process.env.SYSTEM_SMTP_PORT || '').trim(),
      user: (process.env.SYSTEM_SMTP_USER || '').trim(),
      pass: (process.env.SYSTEM_SMTP_PASS || '').trim(),
    };
    
    if (!systemSmtpConfig.host || !systemSmtpConfig.port || !systemSmtpConfig.user || !systemSmtpConfig.pass) {
        console.error('Default SMTP configuration is missing from environment variables.');
        throw new Error('Email server is not configured.');
    }

    transportConfig = {
      host: systemSmtpConfig.host,
      port: parseInt(systemSmtpConfig.port, 10),
      secure: parseInt(systemSmtpConfig.port, 10) === 465,
      auth: {
        user: systemSmtpConfig.user,
        pass: systemSmtpConfig.pass,
      },
      tls: { rejectUnauthorized: false },
    };
    fromAddress = `"CAP Payments Portal" <${systemSmtpConfig.user}>`;
  }
  
  if (from) {
      fromAddress = from;
  }

  const transporter = nodemailer.createTransport(transportConfig);

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
      console.log('Email sent successfully:', info.messageId);
      return info;
  } catch (error: any) {
      console.error('Nodemailer Error:', error);
      throw new Error(`SMTP Error: ${error.code || 'Unknown'} - ${error.message}`);
  }
}
