
'use client';
import { redirect } from 'next/navigation';

export default function NumeraSettingsRedirectPage() {
  redirect('/admin/ai-accountant/allocation-rules');
  return null;
}
