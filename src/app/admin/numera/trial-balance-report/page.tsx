
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

type TrialBalanceReportData = {
    clientName: string;
    fromDate: string;
    toDate: string;
    data: {
        accountNumber: string;
        description: string;
        debit: number;
        credit: number;
    }[];
};

export default function TrialBalanceReportPage() {
    const [reportData, setReportData] = useState<TrialBalanceReportData | null>(null);

    useEffect(() => {
        const data = sessionStorage.getItem('trialBalanceReportData');
        if (data) {
            setReportData(JSON.parse(data));
        }
    }, []);
    
    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' });
    }

    if (!reportData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>No report data found. Please generate a report first.</p>
            </div>
        );
    }
    
    const totalDebits = reportData.data.reduce((acc, item) => acc + item.debit, 0);
    const totalCredits = reportData.data.reduce((acc, item) => acc + item.credit, 0);

    return (
        <div className="p-8 bg-white">
            <Card className="w-full max-w-4xl mx-auto shadow-none border-none">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{reportData.clientName}</CardTitle>
                    <CardDescription className="text-lg">Trial Balance</CardDescription>
                    <CardDescription>
                        For the period: {reportData.fromDate} to {reportData.toDate}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <Button variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">Account</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right w-[150px]">Debit</TableHead>
                                <TableHead className="text-right w-[150px]">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.data.map(item => (
                                <TableRow key={item.accountNumber}>
                                    <TableCell className="font-mono">{item.accountNumber}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="font-bold text-base">Totals</TableCell>
                                <TableCell className="text-right font-bold font-mono text-base">{formatCurrency(totalDebits)}</TableCell>
                                <TableCell className="text-right font-bold font-mono text-base">{formatCurrency(totalCredits)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
             <style jsx global>{`
                @media print {
                  body {
                    -webkit-print-color-adjust: exact;
                  }
                  .no-print {
                    display: none;
                  }
                }
            `}</style>
        </div>
    );
}
