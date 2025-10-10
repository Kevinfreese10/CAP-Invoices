
import { redirect } from 'next/navigation';

export default function ToolsPage() {
  redirect('/admin/tools/pdf-to-csv');
  return null;
}
