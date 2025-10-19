
'use client';

import { redirect } from 'next/navigation';

export default function CustomerLedgerRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/customer-ledger`);
  return null;
}
