
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, CheckCircle2, FileCheck2, XCircle, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { s38ChartOfAccounts, capChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { ExtractedInvoice } from '@/lib/types';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';


const db = getFirestore(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

export default function SecondReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch approved invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            const dataToSave = {
                ...data,
                commissionNumber: data.commissionNumber || null,
                paymentBatch: data.paymentBatch || null,
                expenseType: data.expenseType || null,
            };
            await updateDoc(docRef, dataToSave);
            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };
    
    const handleApproveForPayment = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'approved_for_payment' });
            toast({ title: 'Invoice Approved for Payment', description: 'The invoice has been moved to the payment control sheet.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve for payment.', variant: 'destructive'});
        }
    };

    const handleDelete = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted', description: 'The invoice has been removed.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const getStatusBadge = (status: ExtractedInvoice['status']) => {
        switch(status) {
            case 'approved':
                return (
                    <Badge variant={'success'}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Approved
                    </Badge>
                );
            case 'approved_for_payment':
                 return (
                    <Badge variant={'payment'}>
                        <FileCheck2 className="mr-1 h-3 w-3" />
                        Approved for Payment
                    </Badge>
                );
             case 'rejected':
                return (
                    <Badge variant={'destructive'}>
                        <XCircle className="mr-1 h-3 w-3" />
                        Rejected
                    </Badge>
                );
            default:
                return <Badge>{status.replace('_', ' ')}</Badge>;
        }
    }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">2nd Review</h1>
      <Card>
        <CardHeader>
          <CardTitle>Approved Invoices</CardTitle>
          <CardDescription>
            These invoices have been reviewed and approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No approved invoices yet.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Payment Batch</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>View Invoice</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => {
                            const isApprovalDisabled = 
                                !invoice.paymentBatch || 
                                !invoice.expenseType || 
                                !invoice.lineItems.every(item => !!item.accountId) ||
                                invoice.status === 'approved_for_payment';

                            return (
                                <TableRow key={invoice.id}>
                                    <TableCell>
                                        {getStatusBadge(invoice.status)}
                                    </TableCell>
                                    <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>
                                        {invoice.paymentBatch ? (
                                            <Badge variant="outline">{invoice.paymentBatch.replace(/_/g, ' ')}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">Not set</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>
                                        <Button asChild variant="ghost" size="icon">
                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">R {invoice.invoiceTotal.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleApproveForPayment(invoice.id)} disabled={isApprovalDisabled}>
                                                    <FileCheck2 className="mr-2 h-4 w-4" /> Approve for Payment
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the invoice for {invoice.supplier}.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(invoice.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
      <Dialog open={!!editingInvoice} onOpenChange={(isOpen) => !isOpen && setEditingInvoice(null)}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Edit Invoice: {editingInvoice?.supplier}</DialogTitle>
                <DialogDescription>Review and correct the extracted data.</DialogDescription>
            </DialogHeader>
            <EditInvoiceForm 
                invoice={editingInvoice} 
                onSave={handleSave} 
                onCancel={() => setEditingInvoice(null)} 
            />
        </DialogContent>
      </Dialog>

    </div>
  );
}
