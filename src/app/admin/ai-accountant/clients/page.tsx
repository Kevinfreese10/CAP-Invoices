
'use client';
import { redirect } from 'next/navigation';

export default function AIAccountantClientsRedirectPage() {
  redirect('/dashboard/ai-accountant/clients');
  return null;
}
