
'use client';
import { redirect } from 'next/navigation';

export default function NumeraRedirectPage() {
  redirect('/admin/ai-accountant/customers');
  return null;
}
