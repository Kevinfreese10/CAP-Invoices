
'use client';
import { redirect } from 'next/navigation';

export default function NumeraAccountTransactionsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/account-transactions`);
  return null;
}
