
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import React, { useState, useEffect } from "react";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useParams } from "next/navigation";

const db = getFirestore(firebaseApp);

function TrialBalance({ chartOfAccounts }: { chartOfAccounts: ChartOfAccount[] }) {
    if (!chartOfAccounts) {
        return <p>Chart of accounts not found for this client.</p>;
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {chartOfAccounts.map(account => (
                    <TableRow key={account.id}>
                        <TableCell>{account.accountNumber} - {account.description}</TableCell>
                        <TableCell className="text-right font-mono">0.00</TableCell>
                        <TableCell className="text-right font-mono">0.00</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export default function ReportsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                setIsLoading(true);
                const docRef = doc(db, 'clients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);

  const reports = [
    { title: 'Trial Balance', description: 'View the trial balance for a selected period.', component: client ? <TrialBalance chartOfAccounts={client.chartOfAccounts || []} /> : <p>Loading client data...</p> },
    { title: 'General Ledger', description: 'See a detailed list of all transactions for each account.', component: <p>General Ledger report is under construction.</p> },
    // More reports can be added here
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Financial Reports</CardTitle>
          <CardDescription>
            Select a report to view for this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.title}>
              <CardHeader>
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <DateRangePicker />
              </CardContent>
              <CardContent>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                            View Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>{report.title}</DialogTitle>
                            <DialogDescription>
                                Report generated for the selected date range.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="border rounded-lg overflow-y-auto flex-grow">
                            {isLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : report.component}
                        </div>
                    </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
