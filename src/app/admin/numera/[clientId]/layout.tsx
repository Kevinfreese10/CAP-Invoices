
'use client';
import { redirect } from 'next/navigation';

export default function NumeraRedirectLayout({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/dashboard`);
  return null;
}
