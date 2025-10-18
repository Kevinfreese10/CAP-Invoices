
'use client';
import { redirect } from 'next/navigation';

export default function NumeraChartOfAccountsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/chart-of-accounts`);
  return null;
}
