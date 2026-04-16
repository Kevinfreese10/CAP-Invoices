

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, CheckCircle, MoreHorizontal, Edit, PlusCircle, FileCheck2, Eye, Shield } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { Checkbox } from '@/components/ui/checkbox';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);


export default function PaymentControlSheetPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierFilter, setSupplierFilter] = useState('');
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

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

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleBatchApproval = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: "No invoices selected", variant: "destructive" });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'batched_for_payment' });
            });
            await batch.commit();

            toast({
                title: `${selectedInvoices.length} Invoice(s) Batched`,
                description: 'The selected invoices have been moved to the payment batches.',
            });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            console.error("Error batching invoices:", error);
            toast({
                title: 'Error',
                description: 'Could not move the invoices to payment batches.',
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
                note: data.note || null,
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    const getAccountDescription = (accountId?: string, expenseType?: 'CAP' | 'S38' | 'S39') => {
        if (!accountId) return { description: 'N/A', number: '' };
        let chart;
        switch(expenseType) {
            case 'S38': chart = s38ChartOfAccounts; break;
            case 'S39': chart = s39ChartOfAccounts; break;
            case 'CAP': chart = capChartOfAccounts; break;
            default: chart = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];
        }
        const account = chart.find(acc => acc.accountNumber === accountId);
        return account ? { description: account.description, number: account.accountNumber } : { description: accountId, number: accountId };
    }

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice =>
            invoice.supplier.toLowerCase().includes(supplierFilter.toLowerCase())
        );
    }, [invoices, supplierFilter]);

    const handleToggleSelect = (id: string, checked: boolean | 'indeterminate') => {
        setSelectedInvoices(prev => 
            checked ? [...prev, id] : prev.filter(i => i !== id)
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Payment Control Sheet</h1>
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button disabled={selectedInvoices.length === 0}>
                                <FileCheck2 className="mr-2 h-4 w-4"/>
                                Batch Selected ({selectedInvoices.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Batching</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will move {selectedInvoices.length} invoice(s) to the final payment batches. Are you sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBatchApproval}>
                                    Yes, Batch
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Invoices Approved for Payment</CardTitle>
                            <CardDescription>
                                These line items from approved invoices are ready for payment processing.
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
                    ) : filteredInvoices.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {invoices.length > 0 ? 'No invoices match the current filter.' : 'No invoices are currently approved for payment.'}
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {filteredInvoices.map((invoice) => (
                                <Card key={invoice.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/50">
                                        <div className="flex flex-wrap justify-between items-center gap-2">
                                            <div className="flex items-center gap-4">
                                                <Checkbox
                                                    id={`select-${invoice.id}`}
                                                    checked={selectedInvoices.includes(invoice.id)}
                                                    onCheckedChange={(checked) => handleToggleSelect(invoice.id, checked)}
                                                />
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {invoice.supplier}
                                                        {invoice.isPrivate && (
                                                            <Badge variant="destructive">
                                                                <Shield className="mr-1 h-3 w-3" /> Private
                                                            </Badge>
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Invoice #: {invoice.invoiceNumber} | Date: {invoice.date}
                                                        {invoice.commissionNumber && ` | Commission #: ${invoice.commissionNumber}`}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Amount Payable</p>
                                                    <p className="font-bold text-lg">{formatPrice(invoice.lineItems.reduce((acc, item) => acc + (item.exclusiveAmount + item.vatAmount - ((item.paye ? (item.exclusiveAmount + item.vatAmount) * 0.25 : 0))), 0))}</p>
                                                </div>
                                                 <Button asChild variant="outline" size="icon">
                                                    <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Ledger Description</TableHead>
                                                    <TableHead>Allocated Account</TableHead>
                                                    <TableHead>Payment Batch</TableHead>
                                                    <TableHead className="text-right">Amount (Excl. VAT)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoice.lineItems.map((item, index) => {
                                                    const account = getAccountDescription(item.accountId, invoice.expenseType);
                                                    return (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-semibold">{item.ledgerDescription || item.description}</TableCell>
                                                        <TableCell>
                                                            <p className="font-semibold">{account.description}</p>
                                                            <p className="text-xs text-muted-foreground">({account.number} - {invoice.expenseType})</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{invoice.paymentBatch ? invoice.paymentBatch.replace(/_/g, ' ') : 'N/A'}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
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
