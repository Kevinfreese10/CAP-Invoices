
'use client';
import { redirect, useParams } from 'next/navigation';

export default function BankRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/numera/${clientId}/bank/transactions`);
  return null;
}
