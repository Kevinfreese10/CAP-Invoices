
import { redirect } from 'next/navigation';

export default function AIAccountantRedirectPage() {
  redirect('/admin/ai-accountant/customers');
  return null;
}
