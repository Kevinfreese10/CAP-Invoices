
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Banknote, ChevronDown, Trash2, Upload, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import Papa from 'papaparse';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

type SupplierGroup = {
    supplier: string;
    totalAmount: number;
    invoices: ExtractedInvoice[];
};

function PaymentBatchTable({ title, invoices, totalAmount, onDelete, onUploadPop }: { title: string, invoices: ExtractedInvoice[], totalAmount: number, onDelete: (id: string) => void, onUploadPop: (supplierName: string, file: File) => Promise<void> }) {
    const [openSupplier, setOpenSupplier] = useState<string | null>(null);
    const [uploadingPop, setUploadingPop] = useState<string | null>(null);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };
    
    const groupedBySupplier = useMemo(() => {
        const groups: { [key: string]: SupplierGroup } = {};
        invoices.forEach(invoice => {
            if (!groups[invoice.supplier]) {
                groups[invoice.supplier] = {
                    supplier: invoice.supplier,
                    totalAmount: 0,
                    invoices: [],
                };
            }
            groups[invoice.supplier].totalAmount += invoice.invoiceTotal;
            groups[invoice.supplier].invoices.push(invoice);
        });
        return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [invoices]);

    const handlePopUpload = async (supplierName: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingPop(supplierName);
        await onUploadPop(supplierName, file);
        setUploadingPop(null);
    };

    const handleDownloadRemittance = (supplierGroup: SupplierGroup) => {
        const data = supplierGroup.invoices.map(inv => ({
            'Invoice Number': inv.invoiceNumber,
            'Invoice Date': inv.date,
            'Amount': inv.invoiceTotal,
        }));
        
        data.push({
            'Invoice Number': 'TOTAL',
            'Invoice Date': '',
            'Amount': supplierGroup.totalAmount,
        });

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `Remittance_${supplierGroup.supplier.replace(/\s/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{title}</CardTitle>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Batch Total</p>
                        <p className="text-2xl font-bold">{formatPrice(totalAmount)}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No invoices in this batch.</p>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-right">Total Amount Due</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedBySupplier.map((group) => {
                            const isOpen = openSupplier === group.supplier;
                            const hasPop = group.invoices.every(inv => !!inv.proofOfPaymentUrl);
                            const popUrl = hasPop ? group.invoices[0].proofOfPaymentUrl : null;

                            return (
                                <React.Fragment key={group.supplier}>
                                    <TableRow>
                                        <TableCell className="font-medium">
                                            <Button variant="ghost" className="p-0 hover:bg-transparent -ml-2" onClick={() => setOpenSupplier(isOpen ? null : group.supplier)}>
                                                <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform duration-200", isOpen && "-rotate-90")} />
                                                {group.supplier}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{formatPrice(group.totalAmount)}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            {uploadingPop === group.supplier ? (
                                                <Button size="sm" variant="outline" disabled><Loader2 className="h-4 w-4 animate-spin"/></Button>
                                            ) : hasPop && popUrl ? (
                                                <Button size="sm" variant="outline" asChild>
                                                    <a href={popUrl} target="_blank" rel="noopener noreferrer">View POP</a>
                                                </Button>
                                            ) : (
                                                <>
                                                    <input
                                                        type="file"
                                                        id={`pop-upload-${group.supplier.replace(/\s/g, '-')}`}
                                                        className="hidden"
                                                        accept="application/pdf,image/*"
                                                        onChange={(e) => handlePopUpload(group.supplier, e)}
                                                    />
                                                    <Button size="sm" variant="outline" asChild>
                                                        <label htmlFor={`pop-upload-${group.supplier.replace(/\s/g, '-')}`} className="cursor-pointer">
                                                           <Upload className="mr-2 h-4 w-4"/> Upload POP
                                                        </label>
                                                    </Button>
                                                </>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => handleDownloadRemittance(group)}>
                                                <Download className="mr-2 h-4 w-4"/> Remittance
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    {isOpen && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="p-0">
                                                <div className="p-4 bg-muted/50">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="h-8">Invoice #</TableHead>
                                                                <TableHead className="h-8">Date</TableHead>
                                                                <TableHead className="h-8 text-right">Amount</TableHead>
                                                                <TableHead className="h-8 text-right">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {group.invoices.map(invoice => (
                                                                <TableRow key={invoice.id} className="text-xs">
                                                                    <TableCell className="py-1">{invoice.invoiceNumber}</TableCell>
                                                                    <TableCell className="py-1">{invoice.date}</TableCell>
                                                                    <TableCell className="py-1 text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                                                                    <TableCell className="py-1 text-right">
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        This will permanently delete the invoice for {invoice.supplier} (#{invoice.invoiceNumber}). This action cannot be undone.
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => onDelete(invoice.id)}>Delete Invoice</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
    )
}


export default function PaymentBatchesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'batched_for_payment'), orderBy('paymentBatch', 'asc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching batched invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch batched invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleDeleteFromBatch = async (id: string) => {
         try {
            const docRef = doc(db, 'extractedInvoices', id);
            await deleteDoc(docRef);
            toast({ title: 'Invoice Deleted', description: 'The invoice has been permanently deleted.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const handleUploadPop = async (supplierName: string, file: File) => {
        const invoicesToUpdate = invoices.filter(inv => inv.supplier === supplierName && inv.status === 'batched_for_payment');
        if (invoicesToUpdate.length === 0) {
            toast({ title: 'No invoices found for supplier', variant: 'destructive' });
            return;
        }

        try {
            const storageRef = ref(storage, `proof-of-payments/${supplierName}/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const batch = writeBatch(db);
            invoicesToUpdate.forEach(invoice => {
                const docRef = doc(db, 'extractedInvoices', invoice.id);
                batch.update(docRef, { proofOfPaymentUrl: downloadURL });
            });
            await batch.commit();

            toast({ title: 'Proof of Payment Uploaded!', description: `POP for ${supplierName} has been saved.`});
            fetchInvoices();

        } catch (error) {
            console.error('Error uploading POP:', error);
            toast({ title: 'Upload Failed', description: 'Could not upload the proof of payment.', variant: 'destructive'});
        }
    };
    
    const weeklyBatches = useMemo(() => {
        const batches: { [week: string]: { CAP: ExtractedInvoice[], S38: ExtractedInvoice[] } } = {};
        
        invoices.forEach(inv => {
            const batchKey = inv.paymentBatch || 'Uncategorized';
            if (!batches[batchKey]) {
                batches[batchKey] = { CAP: [], S38: [] };
            }
            if (inv.expenseType === 'CAP') {
                batches[batchKey].CAP.push(inv);
            } else { // S38 or undefined
                batches[batchKey].S38.push(inv);
            }
        });
        
        return Object.entries(batches).map(([batchKey, expenseGroups]) => {
            let title: string;
            if (batchKey === 'this_week') title = 'This Week';
            else if (batchKey === 'month_end') title = 'Month End';
            else if (batchKey === 'Uncategorized') title = 'Uncategorized';
            else {
                try {
                    title = `Payment for ${format(parseISO(batchKey), 'dd MMMM yyyy')}`;
                } catch(e) {
                    title = `Batch: ${batchKey}`;
                }
            }

            return {
                title,
                capTotal: expenseGroups.CAP.reduce((sum, inv) => sum + inv.invoiceTotal, 0),
                s38Total: expenseGroups.S38.reduce((sum, inv) => sum + inv.invoiceTotal, 0),
                ...expenseGroups,
            };
        });
    }, [invoices]);


    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                 <Banknote className="h-8 w-8 text-primary" />
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payment Batches</h1>
                    <p className="text-muted-foreground">Invoices batched and ready for payment processing.</p>
                 </div>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : weeklyBatches.length === 0 ? (
                 <p className="text-center text-muted-foreground py-10">No payment batches found.</p>
            ) : (
                <div className="space-y-12">
                    {weeklyBatches.map((batch, index) => (
                        <div key={index}>
                            <h2 className="text-2xl font-bold mb-4">{batch.title}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <PaymentBatchTable 
                                    title="CAP Expenses"
                                    invoices={batch.CAP}
                                    totalAmount={batch.capTotal}
                                    onDelete={handleDeleteFromBatch}
                                    onUploadPop={handleUploadPop}
                                />
                                 <PaymentBatchTable 
                                    title="S38 Expenses"
                                    invoices={batch.S38}
                                    totalAmount={batch.s38Total}
                                    onDelete={handleDeleteFromBatch}
                                    onUploadPop={handleUploadPop}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
