'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, CheckCircle2, FileCheck2, XCircle, Eye, Shield } from 'lucide-react';
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
import { format, isPast, parseISO, endOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';

const db = getFirestore(firebaseApp);
const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];

export default function PrivateSecondReview() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();
    const { user } = useAuth();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'approved'), where('isPrivate', '==', true), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching private invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch approved private invoices.', variant: 'destructive'});
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
        if (!user) return;
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
            
            await updateDoc(docRef, { 
                status: 'pending_account_review',
                approvedBy: user.uid 
            });

            toast({ title: 'Saved & Approved', description: 'The invoice has been updated and sent to Account Review.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error saving and approving:", error);
            toast({ title: 'Error', description: 'Could not save and approve the invoice.', variant: 'destructive' });
        }
    };
    
    const handleApproveForNextStep = async (id: string) => {
        if (!user) return;
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { 
                status: 'pending_account_review',
                approvedBy: user.uid 
            });
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

    const calculatePayableAmount = (invoice: ExtractedInvoice) => {
        return invoice.lineItems.reduce((acc, item) => {
            const lineValue = item.exclusiveAmount + item.vatAmount;
            const payeDeduction = item.paye ? lineValue * 0.25 : 0;
            return acc + (lineValue - payeDeduction);
        }, 0);
    };

  return (
    <Card className="mb-8 border-purple-200 shadow-sm">
        <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
          <CardTitle className="text-purple-900">Private Invoices - Pending 2nd Review</CardTitle>
          <CardDescription>
            These private invoices have passed 1st review and are waiting for your approval to proceed to Account Review.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            {isLoading ? (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No private invoices pending 2nd review.</p>
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
                                    if (!isNaN(parsedDate.valueOf())) {
                                        isBatchDatePast = isPast(endOfDay(parsedDate));
                                        batchDateLabel = format(parsedDate, 'dd MMM yyyy');
                                    }
                                } catch (e) {}
                            }

                            const isApprovalDisabled = 
                                invoice.lineItems.length === 0 || 
                                !invoice.commissionNumber || 
                                !invoice.expenseType ||
                                invoice.lineItems.some(item => !item.accountId) ||
                                (invoice.paymentBatch !== 'private' && isBatchDatePast);

                            return (
                                <TableRow key={invoice.id}>
                                    <TableCell>
                                         <Badge variant={'success'}>
                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                            Approved (1st Review)
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>
                                        {invoice.paymentBatch === 'private' ? (
                                            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                                                <Shield className="mr-1 h-3 w-3" />
                                                Private Batch
                                            </Badge>
                                        ) : invoice.paymentBatch ? (
                                             <Badge variant={isBatchDatePast ? 'destructive' : 'secondary'} className={isBatchDatePast ? '' : 'bg-green-100 text-green-800 border-green-200'}>
                                                 {batchDateLabel || invoice.paymentBatch}
                                             </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs italic">Uncategorized</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>
                                        <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underline">
                                            <Eye className="mr-1 h-4 w-4" />
                                            View PDF
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        R {calculatePayableAmount(invoice).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setEditingInvoice(invoice)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleApproveForNextStep(invoice.id)} disabled={isApprovalDisabled} className="text-green-600">
                                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve for Account Review
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuSeparator />
                                                
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-orange-600">
                                                            <XCircle className="mr-2 h-4 w-4" /> Reject Invoice
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Reject Invoice?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Please provide a reason for rejecting this invoice. An email will be sent to the supplier (if applicable).
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <form onSubmit={(e) => {
                                                            e.preventDefault();
                                                            const reason = new FormData(e.currentTarget).get('reason') as string;
                                                            if (reason) {
                                                                handleReject(invoice.id, reason);
                                                                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                                                            }
                                                        }}>
                                                            <div className="py-4">
                                                                <input name="reason" placeholder="Rejection reason..." className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required />
                                                            </div>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <Button type="submit" variant="destructive">Reject</Button>
                                                            </AlertDialogFooter>
                                                        </form>
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the invoice data. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(invoice.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
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

            <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Invoice - {editingInvoice?.invoiceNumber}</DialogTitle>
                    </DialogHeader>
                    {editingInvoice && (
                        <EditInvoiceForm 
                            invoice={editingInvoice} 
                            onSave={handleSave} 
                            onCancel={() => setEditingInvoice(null)}
                            onSaveAndApprove={handleSaveAndApprove}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </CardContent>
    </Card>
  );
}
