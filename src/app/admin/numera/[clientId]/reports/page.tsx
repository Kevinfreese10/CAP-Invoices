import { redirect } from 'next/navigation';

export default function ReportsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/numera/${params.clientId}/reports/account-transactions`);
  return null;
}
