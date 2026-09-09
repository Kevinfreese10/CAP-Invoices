'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, CheckCircle, MoreHorizontal, Edit, PlusCircle, FileCheck2, Eye, Shield, Paperclip, FileX2, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice, User } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts, goChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);


export default function PaymentControlSheetPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierFilter, setSupplierFilter] = useState('');
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const getTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val).getTime();
            return isNaN(d) ? 0 : d;
        }
        return 0;
    };

    const toNum = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const clean = String(val).replace(/[^0-9.-]+/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    const fetchInvoices = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'approved_for_payment'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            fetchedInvoices.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching approved for payment invoices:", error);
            toast({ title: 'Error', description: 'Could not load payment control sheet.', variant: 'destructive' });
        } finally {
            if (showLoader) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleBatchApproval = async (overrideBatchDate?: string) => {
        if (selectedInvoices.length === 0) {
            toast({ title: "No invoices selected", variant: "destructive" });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                const updates: any = { status: 'batched_for_payment' };
                if (overrideBatchDate) {
                    updates.paymentBatch = overrideBatchDate;
                }
                batch.update(docRef, updates);
            });
            await batch.commit();

            toast({
                title: `${selectedInvoices.length} Invoice(s) Batched`,
                description: overrideBatchDate
                    ? `The selected invoices have been moved to the ${overrideBatchDate} special batch.`
                    : 'The selected invoices have been moved to the payment batches.',
            });
            setSelectedInvoices([]);
            fetchInvoices(false);
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
            fetchInvoices(false);
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };

    const handleReject = async (id: string, reason: string) => {
        if (!user) return;
        const invoice = invoices.find(inv => inv.id === id);
        if (!invoice) return;

        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'rejected', rejectionReason: reason, rejectedBy: user.uid });
            
            const uploaderSnap = invoice.uploadedBy ? await getDoc(doc(db, 'users', invoice.uploadedBy)) : null;

            if (uploaderSnap?.exists()) {
                const uploaderData = uploaderSnap.data() as User;
                // Only notify if uploader is a supplier
                if (uploaderData.role === 'supplier') {
                    const emailHtml = render(<InvoiceRejectionEmail invoice={invoice} reason={reason} rejectedBy={user.name} />);
                    await sendEmail({
                        to: uploaderData.email,
                        bcc: 'kev@thinkestry.co.za',
                        subject: `Invoice Rejected: ${invoice.supplier} - #${invoice.invoiceNumber}`,
                        html: emailHtml,
                    });
                }
            }

            toast({ title: 'Invoice Rejected', description: 'The invoice has been marked as rejected.' });
            fetchInvoices(false);
        } catch (error) {
            console.error("Error rejecting invoice:", error);
            toast({ title: 'Error', description: 'Could not reject the invoice or send notification.', variant: 'destructive'});
        }
    }

    const handleReturnToThirdReview = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'pending_third_review' });
            toast({ title: 'Invoice Returned', description: 'The invoice has been returned to Third Review.' });
            fetchInvoices(false);
        } catch (error) {
            console.error("Error returning invoice to third review:", error);
            toast({ title: 'Error', description: 'Could not return the invoice.', variant: 'destructive'});
        }
    };

    const formatPrice = (price: any) => {
        const num = toNum(price);
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(num);
    };

    const getAccountDescription = (accountId?: string, expenseType?: 'CAP' | 'S38' | 'S39' | 'GO') => {
        if (!accountId) return { description: 'N/A', number: '' };
        let chart;
        switch(expenseType) {
            case 'S38': chart = s38ChartOfAccounts; break;
            case 'S39': chart = s39ChartOfAccounts; break;
            case 'GO': chart = goChartOfAccounts; break;
            case 'CAP': chart = capChartOfAccounts; break;
            default: chart = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts, ...goChartOfAccounts];
        }
        const account = chart.find(acc => acc.accountNumber === accountId);
        return account ? { description: account.description, number: account.accountNumber } : { description: accountId, number: accountId };
    }

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice =>
            (invoice.supplier || '').toLowerCase().includes(supplierFilter.toLowerCase())
        );
    }, [invoices, supplierFilter]);

    const handleToggleSelect = (id: string, checked: boolean | 'indeterminate') => {
        setSelectedInvoices(prev => 
            checked ? [...prev, id] : prev.filter(i => i !== id)
        );
    }

    const todayString = isMounted ? format(new Date(), 'yyyy-MM-dd') : '';
    const todayFormatted = isMounted ? format(new Date(), 'dd MMM') : '';
    const todayFullFormatted = isMounted ? format(new Date(), 'dd MMMM yyyy') : '';

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Payment Control Sheet</h1>
                <div className="flex items-center gap-2 flex-wrap">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={selectedInvoices.length === 0} className="border-primary/40 hover:bg-primary/10">
                                <FileCheck2 className="mr-2 h-4 w-4 text-primary"/>
                                Special Batch: Today ({todayFormatted || 'Today'})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Batch for Today ({todayFullFormatted || 'Today'})</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will assign {selectedInvoices.length} selected invoice(s) to today&apos;s special payment batch (<strong>{todayString || 'Today'}</strong>) and move them to Payment Batches.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleBatchApproval(todayString || format(new Date(), 'yyyy-MM-dd'))}>
                                    Confirm Special Batch
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

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
                                    This will move {selectedInvoices.length} invoice(s) to the final payment batches using their assigned dates. Are you sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleBatchApproval()}>
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
                                                    <p className="font-bold text-lg">
                                                        {formatPrice((invoice.lineItems || []).reduce((acc, item) => {
                                                            const excl = toNum(item?.exclusiveAmount);
                                                            const vat = toNum(item?.vatAmount);
                                                            const total = excl + vat;
                                                            const payeDed = item?.paye ? total * 0.25 : 0;
                                                            return acc + (total - payeDed);
                                                        }, 0))}
                                                    </p>
                                                </div>
                                                 <Button asChild variant="outline" size="icon">
                                                    <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="icon">
                                                                <Paperclip className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuLabel>Supporting Docs</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {invoice.supportingDocuments.map((doc, i) => (
                                                                <DropdownMenuItem key={i} asChild>
                                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">{doc.fileName}</a>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleReturnToThirdReview(invoice.id)}>
                                                            <RotateCcw className="mr-2 h-4 w-4" /> Return to Third Review
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                    <FileX2 className="mr-2 h-4 w-4" /> Reject
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Reject Invoice?</AlertDialogTitle>
                                                                    <AlertDialogDescription>Please provide a reason for rejection. If this was submitted by a supplier, they will be notified by email.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <Textarea placeholder="e.g., Invoice is a duplicate." id={`rejection-reason-${invoice.id}`} />
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => {
                                                                        const reason = (document.getElementById(`rejection-reason-${invoice.id}`) as HTMLTextAreaElement).value;
                                                                        if(reason) handleReject(invoice.id, reason);
                                                                        else toast({title: 'Reason Required', description: 'Please provide a reason for rejection.', variant: 'destructive'});
                                                                    }}>Reject</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                             </AlertDialogContent>
                                                         </AlertDialog>
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
                                                {(invoice.lineItems || []).map((item, index) => {
                                                    const account = getAccountDescription(item?.accountId, invoice.expenseType);
                                                    return (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-semibold">{item?.ledgerDescription || item?.description || '-'}</TableCell>
                                                        <TableCell>
                                                            <p className="font-semibold">{account.description}</p>
                                                            <p className="text-xs text-muted-foreground">({account.number} - {invoice.expenseType || 'CAP'})</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{invoice.paymentBatch ? String(invoice.paymentBatch).replace(/_/g, ' ') : 'N/A'}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">{formatPrice(item?.exclusiveAmount)}</TableCell>
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
