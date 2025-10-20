
'use client';

import { redirect } from 'next/navigation';

export default function SuppliersRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/suppliers`);
  return null;
}
