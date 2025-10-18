
'use client';
import { redirect } from 'next/navigation';

// This page is now handled by the dashboard AI Accountant clients page.
// This page is now deprecated and redirects to the correct page.
export default function NumeraRedirectPage() {
  redirect('/admin/ai-accountant/dashboard');
  return null;
}
