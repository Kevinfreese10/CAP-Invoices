
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, FileX2, Eye, RotateCcw, Trash2, Mail, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExtractedInvoice } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { render } from '@react-email/components';
import * as XLSX from 'xlsx';
const db = getFirestore(firebaseApp);

export default function RejectedInvoicesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'rejected'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching rejected invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch rejected invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);
    
    const handleMoveToReview = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'pending_review', rejectionReason: '' });
            toast({ title: 'Invoice Sent for Review', description: 'The invoice has been moved back to the review queue.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not move the invoice.', variant: 'destructive'});
        }
    };
    
    const handleDelete = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted', description: 'The invoice has been permanently removed.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }
    
    const handleResendRejectionEmail = async (invoice: ExtractedInvoice) => {
        if (!user || !user.email) {
            toast({ title: 'Error', description: 'Could not find user to send email to.', variant: 'destructive'});
            return;
        }

        try {
            const emailHtml = render(<InvoiceRejectionEmail invoice={invoice} reason={invoice.rejectionReason || 'No reason provided.'} rejectedBy={user.name} />);

            await sendEmail({
                to: user.email,
                subject: `Invoice Rejected: ${invoice.supplier} - #${invoice.invoiceNumber}`,
                html: emailHtml,
            });

            toast({ title: 'Rejection Email Sent', description: `An email has been sent to ${user.email}.` });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not send the rejection email.', variant: 'destructive'});
        }
    };

    const handleExport = () => {
        if (!invoices.length) return;

        // Group by supplier
        const grouped = invoices.reduce((acc, invoice) => {
            const supplier = invoice.supplier || 'Unknown Supplier';
            if (!acc[supplier]) acc[supplier] = [];
            acc[supplier].push(invoice);
            return acc;
        }, {} as Record<string, ExtractedInvoice[]>);

        const dataToExport = [];
        
        Object.entries(grouped)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([supplier, supplierInvoices]) => {
                dataToExport.push({ 'Supplier': `--- ${supplier} ---` }); // Header row for supplier
                supplierInvoices.forEach(inv => {
                    dataToExport.push({
                        'Supplier': inv.supplier,
                        'Invoice Number': inv.invoiceNumber,
                        'Invoice Date': inv.date,
                        'Total': inv.invoiceTotal,
                        'Reason for Rejection': inv.rejectionReason || 'No reason provided.',
                    });
                });
                dataToExport.push({}); // Empty row
            });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rejected Invoices');
        XLSX.writeFile(workbook, `rejected_invoices_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Rejected Invoices</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
              <CardTitle>Rejected Submissions</CardTitle>
              <CardDescription>
                These invoices were rejected during the review process.
              </CardDescription>
          </div>
          <Button onClick={handleExport} disabled={invoices.length === 0 || isLoading}>
              <Download className="mr-2 h-4 w-4" /> Export to Excel
          </Button>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No rejected invoices.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Reason for Rejection</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell>
                                     <Badge variant={'destructive'}>
                                        <FileX2 className="mr-1 h-3 w-3" />
                                        Rejected
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                <TableCell>{invoice.invoiceNumber}</TableCell>
                                <TableCell className="max-w-xs text-muted-foreground">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="truncate block w-full text-left">{invoice.rejectionReason || 'No reason provided.'}</TooltipTrigger>
                                            <TooltipContent>
                                                <p className="max-w-sm">{invoice.rejectionReason}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                <TableCell className="text-right font-mono">R {invoice.invoiceTotal.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                     <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleResendRejectionEmail(invoice)}>
                                                    <Mail className="mr-2 h-4 w-4" /> Resend Rejection Email
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleMoveToReview(invoice.id)}>
                                                    <RotateCcw className="mr-2 h-4 w-4" /> Move to Review
                                                </DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action is permanent and cannot be undone. This will permanently delete the invoice for {invoice.supplier}.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(invoice.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
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

