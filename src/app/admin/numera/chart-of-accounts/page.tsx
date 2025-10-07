
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ChartOfAccountsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // This page is obsolete; functionality has been moved to the workspace.
        router.replace('/admin/numera/workspace');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen">
             <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Redirecting to the Numera workspace...</p>
            </div>
        </div>
    );
}
