
'use client';

import { redirect } from 'next/navigation';

export default function QuotesRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/quotes`);
  return null;
}
