
'use client';

import { redirect } from 'next/navigation';

export default function AgeAnalysisRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/age-analysis`);
  return null;
}
