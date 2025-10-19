
'use client';

import { redirect } from 'next/navigation';

export default function CreditNotesRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/credit-notes`);
  return null;
}
