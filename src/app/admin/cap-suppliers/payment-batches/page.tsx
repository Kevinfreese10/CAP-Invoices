
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Banknote, ChevronDown, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const db = getFirestore(firebaseApp);

type SupplierGroup = {
    supplier: string;
    totalAmount: number;
    invoices: ExtractedInvoice[];
};

function PaymentBatchTable({ title, invoices, totalAmount, onDelete }: { title: string, invoices: ExtractedInvoice[], totalAmount: number, onDelete: (id: string) => void }) {
    const [openSupplier, setOpenSupplier] = useState<string | null>(null);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };
    
    const groupedBySupplier = useMemo(() => {
        const groups: { [key: string]: SupplierGroup } = {};
        invoices.forEach(invoice => {
            if (!groups[invoice.supplier]) {
                groups[invoice.supplier] = {
                    supplier: invoice.supplier,
                    totalAmount: 0,
                    invoices: [],
                };
            }
            groups[invoice.supplier].totalAmount += invoice.invoiceTotal;
            groups[invoice.supplier].invoices.push(invoice);
        });
        return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [invoices]);


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
                            <TableHead className="text-right">Total Amount Due</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedBySupplier.map((group) => {
                            const isOpen = openSupplier === group.supplier;
                            return (
                                <React.Fragment key={group.supplier}>
                                    <TableRow>
                                        <TableCell className="font-medium">
                                            <Button variant="ghost" className="p-0 hover:bg-transparent -ml-2" onClick={() => setOpenSupplier(isOpen ? null : group.supplier)}>
                                                <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform duration-200", isOpen && "-rotate-90")} />
                                                {group.supplier}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{formatPrice(group.totalAmount)}</TableCell>
                                    </TableRow>
                                    {isOpen && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="p-0">
                                                <div className="p-4 bg-muted/50">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="h-8">Invoice #</TableHead>
                                                                <TableHead className="h-8">Date</TableHead>
                                                                <TableHead className="h-8 text-right">Amount</TableHead>
                                                                <TableHead className="h-8 text-right">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {group.invoices.map(invoice => (
                                                                <TableRow key={invoice.id} className="text-xs">
                                                                    <TableCell className="py-1">{invoice.invoiceNumber}</TableCell>
                                                                    <TableCell className="py-1">{invoice.date}</TableCell>
                                                                    <TableCell className="py-1 text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                                                                    <TableCell className="py-1 text-right">
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        This action cannot be undone. This will permanently delete the invoice for {invoice.supplier} (#{invoice.invoiceNumber}).
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => onDelete(invoice.id)}>Delete</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            )
                        })}
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
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'batched_for_payment'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching batched invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch batched invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleDelete = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted', description: 'The invoice has been removed from the batch.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

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
                        onDelete={handleDelete}
                    />
                    <PaymentBatchTable 
                        title="Month End Payments"
                        invoices={monthEndBatch}
                        totalAmount={monthEndTotal}
                        onDelete={handleDelete}
                    />
                </div>
            )}
        </div>
    );
}
