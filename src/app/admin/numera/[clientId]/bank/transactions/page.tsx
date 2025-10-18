
'use client';
import { redirect } from 'next/navigation';

export default function NumeraBankTransactionsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/bank/transactions`);
  return null;
}
