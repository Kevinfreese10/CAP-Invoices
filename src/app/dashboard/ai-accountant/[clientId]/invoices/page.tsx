
'use client';
import { redirect } from 'next/navigation';

// This is a temporary redirect. The actual page for client invoices in the dashboard
// will need to be implemented separately if the functionality differs from the admin view.
export default function ClientInvoicesRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/invoices`);
  return null;
}

    