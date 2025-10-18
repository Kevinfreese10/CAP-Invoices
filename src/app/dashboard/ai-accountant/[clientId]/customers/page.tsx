
'use client';
import { redirect } from 'next/navigation';

export default function NumeraCustomersRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/customers`);
  return null;
}
