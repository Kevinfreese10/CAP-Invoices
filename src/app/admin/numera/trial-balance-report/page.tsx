
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TrialBalanceReportPage() {
    const router = useRouter();
    useEffect(() => {
        // This page is no longer used, redirect back to the workspace.
        router.replace('/admin/numera/workspace');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <p>This report is now shown in a pop-up. Redirecting...</p>
        </div>
    );
}
