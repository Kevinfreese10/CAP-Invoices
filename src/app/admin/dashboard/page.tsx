'use client';
import { redirect } from 'next/navigation';

export default function AdminDashboardPage() {
    redirect('/admin/cap-suppliers/control-sheet');
    return null;
}
