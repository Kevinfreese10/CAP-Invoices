
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, CheckCircle, MoreHorizontal, Edit, PlusCircle, FileCheck2, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

export default function ThirdReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierFilter, setSupplierFilter] = useState('');
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [localInvoiceData, setLocalInvoiceData] = useState<ExtractedInvoice[]>([]);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'pending_third_review'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
            setLocalInvoiceData(fetchedInvoices); // Initialize local state
        } catch (error) {
            console.error("Error fetching invoices for 3rd review:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleFinalApproval = async (invoiceId: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', invoiceId);
            await updateDoc(docRef, { status: 'approved_for_payment' });
            toast({
                title: 'Invoice Approved for Payment',
                description: 'The invoice has been moved to the Payment Control Sheet.',
            });
            fetchInvoices(); // Re-fetch to update the list
        } catch (error) {
            console.error("Error approving invoice:", error);
            toast({
                title: 'Error',
                description: 'Could not move the invoice to the payment control sheet.',
                variant: 'destructive',
            });
        }
    };
    
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
    
    const handleLedgerDescriptionChange = (invoiceId: string, lineItemIndex: number, value: string) => {
        setLocalInvoiceData(prevData =>
            prevData.map(invoice => {
                if (invoice.id === invoiceId) {
                    const updatedLineItems = [...invoice.lineItems];
                    updatedLineItems[lineItemIndex] = { ...updatedLineItems[lineItemIndex], ledgerDescription: value };
                    return { ...invoice, lineItems: updatedLineItems };
                }
                return invoice;
            })
        );
    };

    const handleSaveLedgerDescriptions = async (invoiceId: string) => {
        const invoiceToSave = localInvoiceData.find(inv => inv.id === invoiceId);
        if (!invoiceToSave) return;

        toast({ title: 'Saving...', description: 'Saving ledger descriptions.'});
        try {
            const docRef = doc(db, 'extractedInvoices', invoiceId);
            await updateDoc(docRef, { lineItems: invoiceToSave.lineItems });
            toast({ title: 'Saved!', description: 'Ledger descriptions have been updated.'});
            fetchInvoices(); // Refresh from DB to ensure consistency
        } catch (error) {
            toast({ title: 'Error', description: 'Could not save ledger descriptions.', variant: 'destructive'});
            console.error(error);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    const getAccountDescription = (accountId?: string) => {
        if (!accountId) return { description: 'N/A', number: '' };
        const account = allAccounts.find(acc => acc.accountNumber === accountId);
        return account ? { description: account.description, number: account.accountNumber } : { description: accountId, number: accountId };
    }

    const filteredInvoices = useMemo(() => {
        return localInvoiceData.filter(invoice =>
            invoice.supplier.toLowerCase().includes(supplierFilter.toLowerCase())
        );
    }, [localInvoiceData, supplierFilter]);

    const flatLineItems = useMemo(() => {
        return filteredInvoices.flatMap(invoice => 
            invoice.lineItems.map((item, index) => ({
                ...item,
                invoiceId: invoice.id,
                lineItemIndex: index,
                supplier: invoice.supplier,
                invoiceNumber: invoice.invoiceNumber,
                commissionNumber: invoice.commissionNumber || 'N/A',
                isFirstLine: index === 0,
                isLastLine: index === invoice.lineItems.length - 1,
            }))
        );
    }, [filteredInvoices]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">3rd Review</h1>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Invoices Pending Final Approval</CardTitle>
                            <CardDescription>
                                These invoices have passed the second review and are ready for final approval before payment.
                            </CardDescription>
                        </div>
                        <Input
                            placeholder="Filter by supplier..."
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : flatLineItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {invoices.length > 0 ? 'No invoices match the current filter.' : 'No invoices are currently pending 3rd review.'}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Line Description</TableHead>
                                    <TableHead>Ledger Description</TableHead>
                                    <TableHead>Allocated Account</TableHead>
                                    <TableHead>Commission #</TableHead>
                                    <TableHead className="text-right">Exclusive Amount</TableHead>
                                    <TableHead className="text-right w-[200px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flatLineItems.map((item) => {
                                    const account = getAccountDescription(item.accountId);
                                    const invoice = invoices.find(inv => inv.id === item.invoiceId);
                                    
                                    return (
                                        <TableRow key={`${item.invoiceId}-${item.lineItemIndex}`}>
                                            <TableCell className={item.isFirstLine ? "font-semibold" : ""}>{item.isFirstLine ? item.supplier : ''}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>
                                                <Input
                                                    value={item.ledgerDescription || ''}
                                                    onChange={(e) => handleLedgerDescriptionChange(item.invoiceId, item.lineItemIndex, e.target.value)}
                                                    placeholder="Enter ledger description..."
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <p>{account.description}</p>
                                                <p className="text-xs text-muted-foreground">{account.number}</p>
                                            </TableCell>
                                            <TableCell>{item.commissionNumber}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                            <TableCell className="text-right">
                                                {item.isLastLine && invoice && (
                                                    <div className="flex justify-end items-center gap-2">
                                                        <Button size="sm" variant="secondary" onClick={() => handleSaveLedgerDescriptions(invoice.id)}>
                                                            <Save className="mr-2 h-4 w-4" /> Save
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" variant="secondary">
                                                                    <FileCheck2 className="mr-2 h-4 w-4"/>
                                                                    Approve
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Confirm Final Approval</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will move the invoice for "{invoice.supplier}" to the payment control sheet. Are you sure?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleFinalApproval(invoice.id)}>
                                                                        Yes, Approve for Payment
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingInvoice(invoice)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
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

