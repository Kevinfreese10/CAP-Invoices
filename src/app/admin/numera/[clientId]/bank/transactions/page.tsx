
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ImportedTransaction } from '@/lib/types';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function BankTransactionsPage() {
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();

    useEffect(() => {
        const fetchClientAndTransactions = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'clients', clientId);
                const clientSnap = await getDoc(clientRef);

                if (clientSnap.exists()) {
                    const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                    setClient(clientData);
                    setTransactions(clientData.importedTransactions || []);
                } else {
                    toast({ title: 'Error', description: 'Client not found.', variant: 'destructive' });
                }
            } catch (e) {
                toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchClientAndTransactions();
    }, [clientId, toast]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };
    
    const getAccountName = (accountId: string) => {
        return client?.chartOfAccounts?.find(acc => acc.id === accountId)?.description || accountId;
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Bank Transactions</CardTitle>
                    <CardDescription>
                        A list of all imported, unallocated bank transactions for this client.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No transactions have been imported yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Bank Account</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(new Date(tx.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>{getAccountName(tx.bankAccountId)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
