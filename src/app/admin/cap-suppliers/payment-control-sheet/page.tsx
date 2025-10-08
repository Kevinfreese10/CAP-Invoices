
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';

const db = getFirestore(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

export default function PaymentControlSheetPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'approved_for_payment'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
                setInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching approved for payment invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInvoices();
    }, []);
    
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
        <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Payment Control Sheet</h1>
        <Card>
            <CardHeader>
            <CardTitle>Invoices Approved for Payment</CardTitle>
            <CardDescription>
                These line items from approved invoices are ready for payment processing.
            </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No invoices are currently approved for payment.</p>
                ) : (
                    <div className="space-y-6">
                        {invoices.map((invoice) => (
                             <Card key={invoice.id} className="overflow-hidden">
                                <CardHeader className="bg-muted/50">
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                        <div>
                                            <CardTitle className="text-lg">{invoice.supplier}</CardTitle>
                                            <CardDescription>
                                                Invoice #: {invoice.invoiceNumber} | Date: {invoice.date}
                                                {invoice.commissionNumber && ` | Commission #: ${invoice.commissionNumber}`}
                                            </CardDescription>
                                        </div>
                                        <div className="text-right">
                                             <p className="text-sm text-muted-foreground">Total</p>
                                             <p className="font-bold text-lg">{formatPrice(invoice.invoiceTotal)}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Line Item Description</TableHead>
                                                <TableHead>Allocated Account</TableHead>
                                                <TableHead>Payment Batch</TableHead>
                                                <TableHead className="text-right">Amount (Excl. VAT)</TableHead>
                                                <TableHead className="text-right">VAT</TableHead>
                                                <TableHead className="text-right">Total (Incl. VAT)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invoice.lineItems.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-semibold">{item.description}</TableCell>
                                                    <TableCell>{getAccountDescription(item.accountId)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{invoice.paymentBatch === 'this_week' ? 'This Week' : 'Month End'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatPrice(item.vatAmount)}</TableCell>
                                                    <TableCell className="text-right font-mono font-semibold">{formatPrice(item.exclusiveAmount + item.vatAmount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
        </div>
    );
}
