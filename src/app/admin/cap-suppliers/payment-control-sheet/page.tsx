
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, CheckCircle, MoreHorizontal, Edit, PlusCircle, FileCheck2 } from 'lucide-react';
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
            
            // 4. Save to Firestore
            const invoiceData = {
                ...result,
                fileName: file.name,
                fileUrl: downloadURL,
                status: 'approved_for_payment', // Add directly to this stage
                uploadedBy: 'manual_ai_upload',
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ title: 'Upload Successful', description: 'The invoice has been extracted and added to the sheet.' });
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
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Upload Invoice
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Invoice (AI Extraction)</DialogTitle>
                    <DialogDescription>Select an invoice PDF or image. The AI will extract the details and add it directly to this sheet.</DialogDescription>
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


export default function PaymentControlSheetPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierFilter, setSupplierFilter] = useState('');
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);

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

    const handleFinalApproval = async (invoiceId: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', invoiceId);
            await updateDoc(docRef, { status: 'batched_for_payment' });
            toast({
                title: 'Invoice Batched',
                description: 'The invoice has been moved to the payment batches.',
            });
            fetchInvoices(); // Re-fetch to update the list
        } catch (error) {
            console.error("Error batching invoice:", error);
            toast({
                title: 'Error',
                description: 'Could not move the invoice to payment batches.',
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
        return invoices.filter(invoice =>
            invoice.supplier.toLowerCase().includes(supplierFilter.toLowerCase())
        );
    }, [invoices, supplierFilter]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Payment Control Sheet</h1>
                <AIExtractUploadDialog onUploadComplete={fetchInvoices} />
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
                                            <div>
                                                <CardTitle className="text-lg">{invoice.supplier}</CardTitle>
                                                <CardDescription>
                                                    Invoice #: {invoice.invoiceNumber} | Date: {invoice.date}
                                                    {invoice.commissionNumber && ` | Commission #: ${invoice.commissionNumber}`}
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Amount Payable</p>
                                                    <p className="font-bold text-lg">{formatPrice(invoice.lineItems.reduce((acc, item) => acc + (item.exclusiveAmount + item.vatAmount - ((item.paye ? (item.exclusiveAmount + item.vatAmount) * 0.25 : 0))), 0))}</p>
                                                </div>
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
                                                    <TableHead>Line Item Description</TableHead>
                                                    <TableHead>Allocated Account</TableHead>
                                                    <TableHead>Payment Batch</TableHead>
                                                    <TableHead className="text-right">Amount (Excl. VAT)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoice.lineItems.map((item, index) => {
                                                    const account = getAccountDescription(item.accountId);
                                                    return (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-semibold">{item.description}</TableCell>
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
                                    <CardFooter className="bg-muted/50 p-3 justify-end">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm">
                                                    <FileCheck2 className="mr-2 h-4 w-4"/>
                                                    Batch for Payment
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirm Batching</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will move the invoice for "{invoice.supplier}" to the final payment batches. Are you sure?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleFinalApproval(invoice.id)}>
                                                        Yes, Batch
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </CardFooter>
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
