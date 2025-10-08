
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Banknote } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

function PaymentBatchTable({ title, invoices, totalAmount }: { title: string, invoices: ExtractedInvoice[], totalAmount: number }) {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    const getAccountDescription = (accountId?: string) => {
        if (!accountId) return 'N/A';
        const account = allAccounts.find(acc => acc.accountNumber === accountId);
        return account ? account.description : accountId;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{title}</CardTitle>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Batch Total</p>
                        <p className="text-2xl font-bold">{formatPrice(totalAmount)}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No invoices in this batch.</p>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount (Incl. VAT)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                <TableCell>{invoice.invoiceNumber}</TableCell>
                                <TableCell>{invoice.date}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
    )
}


export default function PaymentBatchesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'batched_for_payment'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
                setInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching batched invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInvoices();
    }, []);

    const thisWeekBatch = useMemo(() => invoices.filter(inv => inv.paymentBatch === 'this_week'), [invoices]);
    const monthEndBatch = useMemo(() => invoices.filter(inv => inv.paymentBatch === 'month_end'), [invoices]);
    
    const thisWeekTotal = useMemo(() => thisWeekBatch.reduce((sum, inv) => sum + inv.invoiceTotal, 0), [thisWeekBatch]);
    const monthEndTotal = useMemo(() => monthEndBatch.reduce((sum, inv) => sum + inv.invoiceTotal, 0), [monthEndBatch]);


    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                 <Banknote className="h-8 w-8 text-primary" />
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payment Batches</h1>
                    <p className="text-muted-foreground">Invoices batched and ready for payment processing.</p>
                 </div>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <PaymentBatchTable 
                        title="This Week's Payments"
                        invoices={thisWeekBatch}
                        totalAmount={thisWeekTotal}
                    />
                    <PaymentBatchTable 
                        title="Month End Payments"
                        invoices={monthEndBatch}
                        totalAmount={monthEndTotal}
                    />
                </div>
            )}
        </div>
    );
}

