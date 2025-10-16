
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount, ImportedTransaction } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Loader2, ArrowRight, Banknote, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function AIAccountantClientDashboardPage() {
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const clientId = params.clientId as string;

    useEffect(() => {
        if (!clientId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch client data
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                
                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
                } else {
                    console.error("Client not found");
                }

                // Fetch transactions
                const transactionsQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'));
                const transactionsSnapshot = await getDocs(transactionsQuery);
                const fetchedTransactions = transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));
                setTransactions(fetchedTransactions);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientId]);

    const bankAccounts = useMemo(() => {
        if (!client?.chartOfAccounts) return [];
        return client.chartOfAccounts.filter(acc => acc.accountNumber.startsWith('8400-'))
            .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    }, [client]);

    const accountSummaries = useMemo(() => {
        return bankAccounts.map(account => {
            const accountTransactions = transactions.filter(tx => tx.bankAccountId === account.id);
            const unallocatedTransactions = accountTransactions.filter(tx => tx.status === 'new');
            const balance = accountTransactions.reduce((sum, tx) => sum + tx.amount, 0);
            
            const lastImportDate = accountTransactions.length > 0
                ? new Date(Math.max(...accountTransactions.map(tx => new Date(tx.date).getTime())))
                : null;

            return {
                ...account,
                balance,
                unallocatedCount: unallocatedTransactions.length,
                lastImportDate
            };
        });
    }, [bankAccounts, transactions]);


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!client) {
        return <p>Client not found.</p>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Bank Accounts Overview</CardTitle>
                    <CardDescription>
                        A summary of all linked bank accounts for {client.companyName || client.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {accountSummaries.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <Banknote className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-medium">No Bank Accounts Found</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                You need to create a bank account before you can import transactions.
                            </p>
                            <Button asChild className="mt-4">
                                <Link href={`/admin/ai-accountant/${clientId}/bank/transactions`}>Go to Banking</Link>
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bank Account</TableHead>
                                    <TableHead className="text-right">Current Balance</TableHead>
                                    <TableHead className="text-center">Unallocated</TableHead>
                                    <TableHead>Last Import</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accountSummaries.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell>
                                            <p className="font-semibold">{acc.description}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{acc.accountNumber}</p>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(acc.balance)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                 {acc.unallocatedCount > 0 && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {acc.unallocatedCount}
                                            </div>
                                        </TableCell>
                                        <TableCell>{acc.lastImportDate ? format(acc.lastImportDate, 'dd MMMM yyyy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                             <Button asChild variant="outline" size="sm">
                                                <Link href={`/admin/ai-accountant/${clientId}/bank/transactions`}>
                                                    View Account <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Other Information</CardTitle>
                    <CardDescription>
                        More widgets and information will be added here soon.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>...</p>
                </CardContent>
            </Card>
        </div>
    );
}
