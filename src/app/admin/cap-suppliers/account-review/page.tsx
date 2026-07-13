
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, serverTimestamp, addDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, FileCheck2, Eye, Edit, MoreHorizontal, PlusCircle, Upload, Shield, Paperclip, CheckSquare, Square, FileX2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExtractedInvoice, User } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts, goChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import ManualInvoiceForm from '@/components/admin/cap-suppliers/ManualInvoiceForm';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { Textarea } from '@/components/ui/textarea';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

function AIExtractUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isPrivate, setIsPrivate] = useState(true);
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
                toast({
                    title: 'Extraction Failed',
                    description: 'The AI could not read the required details from the invoice. Please try a clearer image or use the manual upload.',
                    variant: 'destructive',
                    duration: 9000,
                });
                setIsExtracting(false);
                return;
            }
            
            // 4. Save to Firestore with a status based on privacy
            const invoiceData = {
                ...result,
                fileName: file.name,
                fileUrl: downloadURL,
                status: isPrivate ? 'batched_for_payment' : 'pending_review',
                paymentBatch: isPrivate ? 'private' : null,
                isPrivate: isPrivate,
                uploadedBy: 'manual_ai_upload',
                createdAt: serverTimestamp(),
                note: isPrivate ? 'Manually added as a private invoice via AI upload.' : null,
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ 
                title: 'Upload Successful', 
                description: isPrivate 
                    ? 'The invoice has been extracted and added to the private batch.'
                    : 'The invoice has been extracted and sent for review.' 
            });
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
                    <DialogDescription>Select an invoice PDF or image. The AI will extract the details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input id="invoice-file" type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="is-private" checked={isPrivate} onCheckedChange={(checked) => setIsPrivate(Boolean(checked))} />
                        <label htmlFor="is-private" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Mark as Private & Confidential
                        </label>
                    </div>
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
                status: 'batched_for_payment',
                paymentBatch: 'private',
                note: 'Manually added as a private invoice.',
                isPrivate: true,
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ title: 'Upload Successful', description: 'The invoice has been added to the private batch.' });
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
                    <DialogDescription>Enter the invoice details manually. This will add it directly to the private & confidential payment batch.</DialogDescription>
                </DialogHeader>
                <ManualInvoiceForm onSave={handleSave} onCancel={() => setIsOpen(false)} />
            </DialogContent>
        </Dialog>
    )
}

export default function AccountReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();
    const { user } = useAuth();
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const usersQuery = query(collection(db, "users"));
            const usersSnapshot = await getDocs(usersQuery);
            const fetchedUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
            setUsers(fetchedUsers);

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

    const handleReturnToSecondReview = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: "No invoices selected", variant: "destructive" });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'approved' }); // Set status back to 'approved' for 2nd review
            });
            await batch.commit();

            toast({
                title: `${selectedInvoices.length} Invoice(s) Returned`,
                description: 'The selected invoices have been moved back to 2nd Review.',
            });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            console.error("Error returning invoices:", error);
            toast({
                title: 'Error',
                description: 'Could not return the invoices.',
                variant: 'destructive',
            });
        }
    };

    const handleBulkApprove = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: "No invoices selected", variant: "destructive" });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'pending_third_review' });
            });
            await batch.commit();

            toast({
                title: `${selectedInvoices.length} Invoice(s) Approved`,
                description: 'The selected invoices have been moved to 3rd Review.',
            });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            console.error("Error approving invoices:", error);
            toast({
                title: 'Error',
                description: 'Could not approve the invoices.',
                variant: 'destructive',
            });
        }
    };
    
    const handleToggleSelect = (id: string) => {
        setSelectedInvoices(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(invoices.map(i => i.id));
        } else {
            setSelectedInvoices([]);
        }
    };
    
    const handleApprove = async (invoiceId: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', invoiceId);
            await updateDoc(docRef, { status: 'pending_third_review' });
            toast({ title: 'Invoice Approved', description: 'The invoice has been moved to 3rd Review.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve the invoice.', variant: 'destructive'});
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
            fetchInvoices();
        } catch (error) {
            console.error("Error rejecting invoice:", error);
            toast({ title: 'Error', description: 'Could not reject the invoice or send notification.', variant: 'destructive'});
        }
    }
    
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

    const getAccountDescription = (accountId?: string, expenseType?: 'CAP' | 'S38' | 'S39' | 'GO') => {
        if (!accountId) return 'N/A';
        let chart;
        switch(expenseType) {
            case 'S38': chart = s38ChartOfAccounts; break;
            case 'S39': chart = s39ChartOfAccounts; break;
            case 'GO': chart = goChartOfAccounts; break;
            case 'CAP': chart = capChartOfAccounts; break;
            default: chart = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts, ...goChartOfAccounts];
        }
        const account = chart.find(acc => acc.accountNumber === accountId);
        return account ? `${account.accountNumber} - ${account.description}` : accountId;
    }

    const getApproverName = (userId?: string) => {
        if (!userId) return 'N/A';
        const user = users.find(u => u.uid === userId || u.id === userId);
        return user ? user.name : 'Unknown User';
    }
    
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Account Review</h1>
        <div className="flex flex-wrap items-center gap-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={selectedInvoices.length === 0}>
                        Return Selected to 2nd Review ({selectedInvoices.length})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move {selectedInvoices.length} selected invoice(s) back to the 2nd Review stage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReturnToSecondReview}>
                            Yes, Return
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button disabled={selectedInvoices.length === 0}>
                        Approve Selected ({selectedInvoices.length})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Selected Invoices?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move {selectedInvoices.length} selected invoice(s) to the 3rd Review stage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove}>
                            Yes, Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AIExtractUploadDialog onUploadComplete={fetchInvoices} />
            <ManualUploadDialog onUploadComplete={fetchInvoices} />
        </div>
      </div>

      <div className="flex items-center gap-4 py-2 bg-muted/30 px-4 rounded-md border">
            <Checkbox 
                id="select-all" 
                checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                {selectedInvoices.length === invoices.length && invoices.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                Select All ({selectedInvoices.length} of {invoices.length} invoices)
            </label>
      </div>
      
       {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : invoices.length === 0 ? (
             <Card>
                <CardContent className="py-10">
                    <p className="text-center text-muted-foreground">No invoices are pending account review.</p>
                </CardContent>
            </Card>
        ) : (
            <div className="space-y-4">
                 {invoices.map(invoice => (
                    <Card key={invoice.id}>
                        <CardHeader className="bg-muted/50">
                            <div className="flex flex-wrap justify-between items-start gap-2">
                                <div className="flex items-center gap-4">
                                     <Checkbox
                                        checked={selectedInvoices.includes(invoice.id)}
                                        onCheckedChange={() => handleToggleSelect(invoice.id)}
                                        aria-label={`Select invoice ${invoice.id}`}
                                    />
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                          {invoice.supplier}
                                          {invoice.expenseType && <Badge variant="outline">{invoice.expenseType}</Badge>}
                                        </CardTitle>
                                        <CardDescription>
                                            Invoice #: {invoice.invoiceNumber} | Commission #: {invoice.commissionNumber || 'N/A'} | Approved (2nd Review) by: <span className="font-semibold">{getApproverName(invoice.approvedBy)}</span>
                                            {invoice.paymentBatch && invoice.paymentBatch !== 'private' && ` | Payment Batch: ${format(new Date(invoice.paymentBatch), 'dd MMMM yyyy')}`}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
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
                                             <DropdownMenuItem onSelect={() => handleApprove(invoice.id)}>
                                                <FileCheck2 className="mr-2 h-4 w-4" /> Approve for 3rd Review
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Invoice
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
                                        <TableHead>Line Description</TableHead>
                                        <TableHead>Allocated Account</TableHead>
                                        <TableHead className="text-right">Exclusive Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.lineItems.map((item, index) => (
                                        <TableRow key={`${invoice.id}-${index}`}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>{getAccountDescription(item.accountId, invoice.expenseType)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                 ))}
            </div>
        )}
      
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
