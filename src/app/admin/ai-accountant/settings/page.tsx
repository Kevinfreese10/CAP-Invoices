'use client';
import Link from 'next/link';

export default function AIASettingsPage() {
    return (
        <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">This page has moved.</h1>
            <p>Master data for AI Accountant is now managed in dedicated sub-pages.</p>
            <div className="mt-4 space-x-4">
                 <Link href="/admin/ai-accountant/chart-of-accounts" className="text-primary underline">Manage Chart of Accounts</Link>
                 <Link href="/admin/ai-accountant/allocation-rules" className="text-primary underline">Manage Allocation Rules</Link>
            </div>
        </div>
    );
}
