
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, CheckCircle2, FileCheck2, XCircle, Eye, FileX2, Mail, Paperclip } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { s38ChartOfAccounts, capChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { ExtractedInvoice, User } from '@/lib/types';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { Input } from '@/components/ui/input';
import { format, isPast, parseISO, endOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { Textarea } from '@/components/ui/textarea';


const db = getFirestore(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];


export default function SecondReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

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

    const handleSaveAndApprove = async (id: string, data: any) => {
        try {
            // First, save the data
            const docRef = doc(db, 'extractedInvoices', id);
            const dataToSave = {
                ...data,
                commissionNumber: data.commissionNumber || null,
                paymentBatch: data.paymentBatch || null,
                expenseType: data.expenseType || null,
                note: data.note || null,
            };
            await updateDoc(docRef, dataToSave);
            
            // Then, approve
            await updateDoc(docRef, { status: 'pending_account_review' });

            toast({ title: 'Saved & Approved', description: 'The invoice has been updated and sent to Account Review.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error saving and approving:", error);
            toast({ title: 'Error', description: 'Could not save and approve the invoice.', variant: 'destructive' });
        }
    };
    
    const handleApproveForNextStep = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'pending_account_review' });
            toast({ title: 'Invoice Approved for Account Review', description: 'The invoice has been moved to the next review step.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve for account review.', variant: 'destructive'});
        }
    };

    const handleReject = async (id: string, reason: string) => {
        if (!user) return;
        const invoice = invoices.find(inv => inv.id === id);
        if (!invoice) return;

        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'rejected', rejectionReason: reason, rejectedBy: user.uid });
            
            const uploader = invoice.uploadedBy ? await getDoc(doc(db, 'users', invoice.uploadedBy)) : null;

            if (uploader?.exists()) {
                const uploaderData = uploader.data() as User;
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
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reject the invoice or send notification.', variant: 'destructive'});
        }
    }

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
                return <Badge>{status.replace(/_/g, ' ')}</Badge>;
        }
    }
    
    const calculatePayableAmount = (invoice: ExtractedInvoice) => {
        return invoice.lineItems.reduce((acc, item) => {
            const lineValue = item.exclusiveAmount + item.vatAmount;
            const payeDeduction = item.paye ? lineValue * 0.25 : 0;
            return acc + (lineValue - payeDeduction);
        }, 0);
    };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">2nd Review</h1>
      </div>
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
                            <TableHead className="text-right">Amount Payable</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => {
                            let isBatchDatePast = false;
                            let batchDateLabel: string | undefined = undefined;

                            if (invoice.paymentBatch) {
                                try {
                                    const parsedDate = parseISO(invoice.paymentBatch);
                                    if (!isNaN(parsedDate.valueOf())) { // Check if date is valid
                                        isBatchDatePast = isPast(endOfDay(parsedDate));
                                        batchDateLabel = format(parsedDate, 'dd MMM yyyy');
                                    }
                                } catch (e) {
                                    // Not a valid date string
                                }
                            }

                            const isApprovalDisabled = 
                                !invoice.paymentBatch || 
                                isBatchDatePast ||
                                !invoice.expenseType || 
                                !invoice.lineItems.some(item => !!item.accountId) ||
                                invoice.status === 'approved_for_payment';
                            
                            const amountPayable = calculatePayableAmount(invoice);

                            return (
                                <TableRow key={invoice.id}>
                                    <TableCell>
                                        {getStatusBadge(invoice.status)}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <p>{invoice.supplier}</p>
                                        {invoice.note && <p className="text-xs text-muted-foreground italic mt-1">Note: {invoice.note}</p>}
                                    </TableCell>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>
                                        {invoice.paymentBatch ? (
                                            <Badge variant={isBatchDatePast ? 'destructive' : 'outline'}>
                                                {batchDateLabel || invoice.paymentBatch.replace(/_/g, ' ')}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">Not set</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell className="flex items-center gap-1">
                                        <Button asChild variant="ghost" size="icon">
                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                    </TableCell>
                                    <TableCell className="text-right font-mono">R {amountPayable.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleApproveForNextStep(invoice.id)} disabled={isApprovalDisabled}>
                                                    <FileCheck2 className="mr-2 h-4 w-4" /> Approve for Account Review
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
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
                onSaveAndApprove={handleSaveAndApprove}
                onCancel={() => setEditingInvoice(null)} 
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}
