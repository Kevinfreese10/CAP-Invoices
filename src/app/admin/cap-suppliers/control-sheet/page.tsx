
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, CheckCircle2, FileCheck2, XCircle, Eye, Upload, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { s38ChartOfAccounts, capChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { ExtractedInvoice } from '@/lib/types';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import ManualInvoiceForm from '@/components/admin/cap-suppliers/ManualInvoiceForm';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { Input } from '@/components/ui/input';
import { format, isPast, parseISO, endOfDay } from 'date-fns';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];


function AIExtractUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUploadAndExtract = async () => {
        if (!file) {
            toast({ title: 'No file selected', variant: 'destructive' });
            return;
        }

        setIsExtracting(true);
        toast({ title: 'Processing Invoice...', description: 'AI is extracting data. Please wait.' });

        try {
            // 1. Upload file to storage
            const storageRef = ref(storage, `invoices/manual-ai/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            // 2. Convert file to data URL for AI
            const reader = new FileReader();
            const dataUrlPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            const dataUrl = await dataUrlPromise;

            // 3. Extract data using AI
            const result = await extractInvoiceData({ invoiceImage: dataUrl });

             if (!result || !result.supplier || !result.invoiceNumber) {
                throw new Error('AI could not extract required fields from the invoice.');
            }
            
            // 4. Save to Firestore with a status of 'approved' to appear on this page.
            const invoiceData = {
                ...result,
                fileName: file.name,
                fileUrl: downloadURL,
                status: 'pending_review', // Go to review first
                uploadedBy: 'manual_ai_upload',
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ title: 'Upload Successful', description: 'The invoice has been extracted and sent for review.' });
            onUploadComplete();
            setFile(null);
            setIsOpen(false);

        } catch (error) {
            console.error("AI upload error:", error);
            toast({ title: 'Upload Failed', description: 'Could not process the invoice.', variant: 'destructive' });
        } finally {
            setIsExtracting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Upload with AI
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Invoice (AI Extraction)</DialogTitle>
                    <DialogDescription>Select an invoice PDF or image. The AI will extract the details and send it for review.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input id="invoice-file" type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleUploadAndExtract} disabled={!file || isExtracting}>
                        {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Upload and Extract
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ManualUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleSave = async (data: any, file: File) => {
        toast({ title: 'Uploading Invoice...', description: 'Please wait.' });
        try {
            const storageRef = ref(storage, `invoices/manual/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const invoiceData = {
                ...data,
                fileName: file.name,
                fileUrl: downloadURL,
                uploadedBy: 'manual_upload',
                createdAt: serverTimestamp(),
            };
            
            if(data.isPrivate) {
                invoiceData.status = 'batched_for_payment';
                invoiceData.paymentBatch = 'private';
                invoiceData.note = 'Manually added as a private invoice.';
            } else {
                invoiceData.status = 'approved';
                invoiceData.note = 'Manually added to control sheet.';
            }

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ title: 'Upload Successful', description: 'The invoice has been added.' });
            onUploadComplete();
            setIsOpen(false);
        } catch (error) {
            console.error("Manual upload error:", error);
            toast({ title: 'Upload Failed', description: 'Could not save the invoice.', variant: 'destructive' });
        }
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Manual Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Manual Invoice Upload</DialogTitle>
                    <DialogDescription>Enter the invoice details manually. This is useful for invoices the AI cannot read.</DialogDescription>
                </DialogHeader>
                <ManualInvoiceForm onSave={handleSave} onCancel={() => setIsOpen(false)} />
            </DialogContent>
        </Dialog>
    )
}

export default function SecondReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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
        <div className="flex gap-2">
            <AIExtractUploadDialog onUploadComplete={fetchInvoices} />
            <ManualUploadDialog onUploadComplete={fetchInvoices} />
        </div>
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
                                    <TableCell>
                                        <Button asChild variant="ghost" size="icon">
                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-4 w-4" />
                                            </a>
                                        </Button>
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
