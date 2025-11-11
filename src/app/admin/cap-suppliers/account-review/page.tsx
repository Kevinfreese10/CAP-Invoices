
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, FileCheck2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const db = getFirestore(firebaseApp);
const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

export default function AccountReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'pending_account_review'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices for account review:", error);
            toast({ title: 'Error', description: 'Could not fetch invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleApproveSelected = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: 'No Invoices Selected', description: 'Please select invoices to approve.', variant: 'destructive' });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'pending_third_review' });
            });
            await batch.commit();
            toast({ title: 'Invoices Approved', description: `${selectedInvoices.length} invoice(s) have been moved to 3rd Review.` });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve invoices.', variant: 'destructive'});
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(invoices.map(inv => inv.id));
        } else {
            setSelectedInvoices([]);
        }
    }

    const flatLineItems = useMemo(() => {
        return invoices.flatMap(invoice => 
            invoice.lineItems.map(item => ({
                ...item,
                invoiceId: invoice.id,
                supplier: invoice.supplier,
                invoiceNumber: invoice.invoiceNumber,
            }))
        );
    }, [invoices]);
    
    const getAccountDescription = (accountId?: string) => {
        if (!accountId) return 'N/A';
        const account = allAccounts.find(acc => acc.accountNumber === accountId);
        return account ? account.description : 'Unknown Account';
    }
    
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Account Review</h1>
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button disabled={selectedInvoices.length === 0}>
                    <FileCheck2 className="mr-2 h-4 w-4"/>
                    Approve ({selectedInvoices.length}) for 3rd Review
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will approve {selectedInvoices.length} invoice(s) and move them to the 3rd Review step.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApproveSelected}>
                        Yes, Approve
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoices Pending Account Review</CardTitle>
          <CardDescription>
            These invoices have passed the 2nd review. Please verify the account allocations before sending for final approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : flatLineItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No invoices are pending account review.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"><Checkbox onCheckedChange={handleSelectAll} checked={selectedInvoices.length > 0 && selectedInvoices.length === invoices.length}/></TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Line Description</TableHead>
                            <TableHead>Allocated Account</TableHead>
                            <TableHead className="text-right">Exclusive Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {flatLineItems.map((item, index) => (
                            <TableRow key={`${item.invoiceId}-${index}`}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedInvoices.includes(item.invoiceId)}
                                        onCheckedChange={(checked) => {
                                            setSelectedInvoices(prev => 
                                                checked ? [...prev, item.invoiceId] : prev.filter(id => id !== item.invoiceId)
                                            );
                                        }}
                                    />
                                </TableCell>
                                <TableCell>{item.supplier}</TableCell>
                                <TableCell>{item.invoiceNumber}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{getAccountDescription(item.accountId)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
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
