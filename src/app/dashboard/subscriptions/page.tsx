
'use client';
import { redirect } from 'next/navigation';

export default function SubscriptionsRedirectPage() {
  redirect('/dashboard/ai-accountant/clients');
  return null;
}
