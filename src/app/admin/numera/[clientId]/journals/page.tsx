
'use client';
import { redirect } from 'next/navigation';

export default function NumeraJournalsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/journals`);
  return null;
}
