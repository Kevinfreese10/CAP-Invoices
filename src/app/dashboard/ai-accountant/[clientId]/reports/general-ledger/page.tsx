
'use client';
import { redirect } from 'next/navigation';

export default function NumeraGeneralLedgerRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/general-ledger`);
  return null;
}
