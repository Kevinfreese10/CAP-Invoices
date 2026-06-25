'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Banknote, ChevronDown, Trash2, Upload, Download, MoreHorizontal, Edit, AlertTriangle, Eye, Archive, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO, isPast, endOfDay } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import Papa from 'papaparse';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import * as XLSX from 'xlsx';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];

type SupplierGroup = {
    supplier: string;
    totalAmount: number; // Net amount (Inclusive - PAYE)
    totalPAYE: number;
    totalInvoiceGross: number; // Sum of the extracted invoice.invoiceTotal property
    invoices: ExtractedInvoice[];
    hasDuplicates: boolean;
    hasDiscrepancy: boolean;
};

function PaymentBatchTable({ title, invoices: batchInvoices, allInvoices, totalAmount, totalPAYE, onDelete, onUploadPop, onEdit, batchKey, onRemovePop }: { title: string, invoices: ExtractedInvoice[], allInvoices: ExtractedInvoice[], totalAmount: number, totalPAYE: number, onDelete: (id: string, isArchive: boolean) => void, onUploadPop: (supplierName: string, file: File, batchKey: string) => Promise<void>, onEdit: (invoice: ExtractedInvoice) => void, batchKey: string, onRemovePop: (supplierName: string, batchKey: string) => Promise<void> }) {
    const [openSupplier, setOpenSupplier] = useState<string | null>(null);
    const [uploadingPop, setUploadingPop] = useState<string | null>(null);
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const [cardStyle, setCardStyle] = useState<{ width?: string, height?: string }>({});

    useEffect(() => {
        const savedSize = localStorage.getItem(`batchCardSize-${batchKey}`);
        if (savedSize) {
            try {
                const parsed = JSON.parse(savedSize);
                setCardStyle({ width: parsed.width, height: parsed.height });
            } catch (e) {}
        }
    }, [batchKey]);

    useEffect(() => {
        if (!cardRef.current) return;
        let timeoutId: NodeJS.Timeout;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const el = entry.target as HTMLDivElement;
                if (el.style.height || el.style.width) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        localStorage.setItem(`batchCardSize-${batchKey}`, JSON.stringify({
                            width: el.style.width || undefined,
                            height: el.style.height || undefined
                        }));
                    }, 500);
                }
            }
        });
        observer.observe(cardRef.current);
        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [batchKey]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };
    
    const groupedBySupplier = useMemo(() => {
        const groups: { [key: string]: SupplierGroup } = {};
        batchInvoices.forEach(invoice => {
            if (!groups[invoice.supplier]) {
                groups[invoice.supplier] = {
                    supplier: invoice.supplier,
                    totalAmount: 0,
                    totalPAYE: 0,
                    totalInvoiceGross: 0,
                    invoices: [],
                    hasDuplicates: false,
                    hasDiscrepancy: false,
                };
            }
            
            const { payableAmount, payeAmount } = invoice.lineItems.reduce((acc, item) => {
                const lineValue = item.exclusiveAmount + item.vatAmount;
                const payeDeduction = item.paye ? lineValue * 0.25 : 0;
                acc.payableAmount += lineValue - payeDeduction;
                acc.payeAmount += payeDeduction;
                return acc;
            }, { payableAmount: 0, payeAmount: 0 });

            groups[invoice.supplier].totalAmount += payableAmount;
            groups[invoice.supplier].totalPAYE += payeAmount;
            groups[invoice.supplier].totalInvoiceGross += (invoice.invoiceTotal || 0);
            groups[invoice.supplier].invoices.push(invoice);
        });

        // Validation Checks
        Object.values(groups).forEach(group => {
            // Check for duplicates by invoice number
            const invoiceNumbers = group.invoices.map(inv => inv.invoiceNumber);
            group.hasDuplicates = new Set(invoiceNumbers).size !== invoiceNumbers.length;

            // Check for discrepancy: Sum of extracted totals vs Calculated totals (Net + PAYE)
            // Using a small epsilon to account for floating point math
            const calculatedGross = group.totalAmount + group.totalPAYE;
            group.hasDiscrepancy = Math.abs(group.totalInvoiceGross - calculatedGross) > 0.05;
        });

        return Object.values(groups).sort((a, b) => a.supplier.localeCompare(b.supplier));
    }, [batchInvoices]);

    const handlePopUpload = async (supplierName: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingPop(supplierName);
        await onUploadPop(supplierName, file, batchKey);
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
            'Amount': supplierGroup.invoices.reduce((sum, inv) => sum + inv.invoiceTotal, 0),
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

    const payeSummary = useMemo(() => {
        return groupedBySupplier
            .filter(group => group.totalPAYE > 0)
            .sort((a, b) => a.supplier.localeCompare(b.supplier))
            .map(group => ({
                supplier: group.supplier,
                payeAmount: group.totalPAYE,
            }));
    }, [groupedBySupplier]);
    
    const handleDownloadExcel = () => {
        const dataToExport = [];
        const header = [
            "Date", "Invoice Number", "Commission Number", "Supplier", "Line Description", "Exclusive Amount", 
            "VAT", "Line Total", "PAYE Deduction", "Final Payment", 
            "Account Allocation Number", "Account Allocation Description", "Invoice Link"
        ];
        dataToExport.push(header);

        batchInvoices.forEach(invoice => {
            invoice.lineItems.forEach(item => {
                const lineTotal = item.exclusiveAmount + item.vatAmount;
                const payeDeduction = item.paye ? lineTotal * 0.25 : 0;
                const finalPayment = lineTotal - payeDeduction;
                const account = allAccounts.find(acc => acc.accountNumber === item.accountId);
                
                const row = [
                    invoice.date,
                    invoice.invoiceNumber,
                    invoice.commissionNumber || 'N/A',
                    invoice.supplier,
                    item.ledgerDescription || item.description,
                    item.exclusiveAmount,
                    item.vatAmount,
                    lineTotal,
                    payeDeduction,
                    finalPayment,
                    item.accountId || 'N/A',
                    account ? account.description : 'N/A',
                    invoice.fileUrl
                ];
                dataToExport.push(row);
            });
        });

        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, 
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
            { wch: 30 }, { wch: 50 }
        ];

        const currencyFormat = 'R #,##0.00';
        for (let i = 2; i <= dataToExport.length; i++) {
            ['F', 'G', 'H', 'I', 'J'].forEach(col => {
                const cellRef = `${col}${i}`;
                if (worksheet[cellRef] && typeof worksheet[cellRef].v === 'number') {
                    worksheet[cellRef].z = currencyFormat;
                }
            });
        }


        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, title);
        XLSX.writeFile(workbook, `${title.replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast({ title: 'Download Started', description: `Your Excel file for ${title} is being downloaded.`});
    };

    const isAlreadyPaid = (invoice: ExtractedInvoice) => {
        return allInvoices.some(
            (paidInv) =>
                paidInv.status === 'paid' &&
                paidInv.supplier === invoice.supplier &&
                paidInv.invoiceNumber === invoice.invoiceNumber &&
                paidInv.id !== invoice.id
        );
    };

    return (
        <Card ref={cardRef} style={cardStyle} className="resize overflow-auto min-h-[300px] flex flex-col flex-1 min-w-[350px] max-w-full">
            <CardHeader className="flex-none">
                <div className="flex justify-between items-center">
                    <CardTitle>{title}</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                            <Download className="mr-2 h-4 w-4" /> Download Batch
                        </Button>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Batch Total Payable</p>
                            <p className="text-2xl font-bold">{formatPrice(totalAmount)}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {batchInvoices.length === 0 ? (
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
                            const hasPop = group.invoices.every(inv => inv.status === 'paid' && !!inv.proofOfPaymentUrl);
                            const popUrl = hasPop ? group.invoices[0].proofOfPaymentUrl : null;

                            return (
                                <React.Fragment key={group.supplier}>
                                    <TableRow>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center">
                                                <Button variant="ghost" className="p-0 hover:bg-transparent -ml-2" onClick={() => setOpenSupplier(isOpen ? null : group.supplier)}>
                                                    <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform duration-200", isOpen && "-rotate-90")} />
                                                    {group.supplier}
                                                </Button>
                                                {group.hasDuplicates && <AlertTriangle className="h-4 w-4 ml-2 text-destructive" />}
                                                {group.hasDiscrepancy && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="cursor-help ml-2">
                                                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p className="font-bold text-destructive">Discrepancy Warning</p>
                                                                <p className="text-xs">
                                                                    The sum of "Invoice Totals" ({formatPrice(group.totalInvoiceGross)}) does not match the sum of line items being paid ({formatPrice(group.totalAmount + group.totalPAYE)}). Please check data entry.
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                {group.totalPAYE > 0 && <Badge variant="destructive" className="ml-2">PAYE</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{formatPrice(group.totalAmount)}</TableCell>
                                        <TableCell className="text-right">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => handleDownloadRemittance(group)}>
                                                        <Download className="mr-2 h-4 w-4" /> Download Remittance
                                                    </DropdownMenuItem>
                                                    
                                                     {hasPop && popUrl ? (
                                                        <>
                                                            <DropdownMenuItem asChild>
                                                                <a href={popUrl} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer w-full">
                                                                    <Eye className="mr-2 h-4 w-4"/> View POP
                                                                </a>
                                                            </DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Remove POP
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will remove the proof of payment for {group.supplier} for this batch. The invoices will be marked as "Batched for Payment" again.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => onRemovePop(group.supplier, batchKey)}>
                                                                            Yes, Remove POP
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    ) : (
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <input
                                                                type="file"
                                                                id={`pop-upload-${batchKey}-${group.supplier.replace(/\s/g, '-')}`}
                                                                className="hidden"
                                                                accept="application/pdf,image/*"
                                                                onChange={(e) => handlePopUpload(group.supplier, e)}
                                                            />
                                                            <label htmlFor={`pop-upload-${batchKey}-${group.supplier.replace(/\s/g, '-')}`} className="flex items-center cursor-pointer w-full">
                                                                <Upload className="mr-2 h-4 w-4" />
                                                                Upload POP
                                                            </label>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                             </DropdownMenu>
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
                                                            {group.invoices.map(invoice => {
                                                                const invoiceHasPaye = invoice.lineItems.some(item => item.paye);
                                                                // Calculate discrepancy for this specific invoice
                                                                const lineTotalSum = invoice.lineItems.reduce((s, li) => s + li.exclusiveAmount + li.vatAmount, 0);
                                                                const hasLineDiscrepancy = Math.abs(invoice.invoiceTotal - lineTotalSum) > 0.01;

                                                                return (
                                                                <TableRow key={invoice.id} className="text-xs">
                                                                    <TableCell className="py-1 flex items-center gap-2">
                                                                        {invoice.invoiceNumber}
                                                                        {isAlreadyPaid(invoice) && (
                                                                            <Badge variant="success">Paid</Badge>
                                                                        )}
                                                                        {invoiceHasPaye && (
                                                                            <Badge variant="destructive">PAYE</Badge>
                                                                        )}
                                                                        {hasLineDiscrepancy && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <AlertCircle className="h-3 w-3 text-destructive" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>Invoice total (R{invoice.invoiceTotal.toFixed(2)}) doesn't match line items (R{lineTotalSum.toFixed(2)})</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="py-1">{invoice.date}</TableCell>
                                                                    <TableCell className="py-1 text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                                                                    <TableCell className="py-1 text-right">
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-3 w-3" /></a>
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(invoice)}>
                                                                            <Edit className="h-3 w-3" />
                                                                        </Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Archive className="h-3 w-3 text-destructive" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        This will archive the invoice for {invoice.supplier} (#{invoice.invoiceNumber}). This can be viewed on the Archive page.
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => onDelete(invoice.id, true)}>Archive Invoice</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )})}
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
                {payeSummary.length > 0 && (
                    <div className="mt-4 p-4 border-t">
                        <h4 className="font-semibold text-destructive mb-2">PAYE Summary for this Batch</h4>
                        <div className="space-y-1 text-sm">
                            {payeSummary.map(item => (
                                <div key={item.supplier} className="flex justify-between">
                                    <span className="text-muted-foreground">{item.supplier}:</span>
                                    <span className="font-mono">{formatPrice(item.payeAmount)}</span>
                                </div>
                            ))}
                             <Separator className="my-2"/>
                             <div className="flex justify-between font-semibold">
                                <span>Total PAYE Deducted:</span>
                                <span className="font-mono">{formatPrice(totalPAYE)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


export default function PaymentBatchesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { user } = useAuth();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'extractedInvoices'), 
            );
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

    const handleRemoveFromBatch = async (id: string, isArchive: boolean) => {
         try {
            const docRef = doc(db, 'extractedInvoices', id);
            if (isArchive) {
                await updateDoc(docRef, { status: 'archived' });
                toast({ title: 'Invoice Archived', description: 'The invoice has been moved from the batch to the archive.'});
            } else {
                await updateDoc(docRef, { status: 'approved_for_payment' });
                toast({ title: 'Invoice Returned', description: 'The invoice has been returned to the Payment Control Sheet.', variant: 'default'});
            }
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not remove the invoice from the batch.', variant: 'destructive'});
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

    const handleUploadPop = async (supplierName: string, file: File, batchKey: string) => {
        const invoicesToUpdate = invoices.filter(inv => 
            inv.supplier === supplierName && 
            inv.paymentBatch === batchKey &&
            inv.status === 'batched_for_payment'
        );

        if (invoicesToUpdate.length === 0) {
            toast({ title: 'No invoices found for supplier in this batch', variant: 'destructive' });
            return;
        }

        try {
            const storageRef = ref(storage, `proof-of-payments/${supplierName}/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const batch = writeBatch(db);
            invoicesToUpdate.forEach(invoice => {
                const docRef = doc(db, 'extractedInvoices', invoice.id);
                batch.update(docRef, { proofOfPaymentUrl: downloadURL, status: 'paid' });
            });
            await batch.commit();

            toast({ title: 'Proof of Payment Uploaded!', description: `POP for ${supplierName} has been saved and invoices marked as paid.`});
            fetchInvoices();

        } catch (error) {
            console.error('Error uploading POP:', error);
            toast({ title: 'Upload Failed', description: 'Could not upload the proof of payment.', variant: 'destructive'});
        }
    };

    const handleRemovePop = async (supplierName: string, batchKey: string) => {
        const invoicesToUpdate = invoices.filter(inv =>
            inv.supplier === supplierName &&
            inv.paymentBatch === batchKey &&
            inv.status === 'paid'
        );

        if (invoicesToUpdate.length === 0) {
            toast({ title: 'No paid invoices found for this supplier in this batch', variant: 'destructive' });
            return;
        }

        try {
            const batch = writeBatch(db);
            invoicesToUpdate.forEach(invoice => {
                const docRef = doc(db, 'extractedInvoices', invoice.id);
                batch.update(docRef, { proofOfPaymentUrl: null, status: 'batched_for_payment' });
            });
            await batch.commit();

            toast({ title: 'Proof of Payment Removed', description: `POP for ${supplierName} has been removed and invoices are now ready for payment again.`});
            fetchInvoices();

        } catch (error) {
            console.error('Error removing POP:', error);
            toast({ title: 'Removal Failed', description: 'Could not remove the proof of payment.', variant: 'destructive'});
        }
    };
    
    const weeklyBatches = useMemo(() => {
        const batches: { [week: string]: { CAP: ExtractedInvoice[], S38: ExtractedInvoice[], S39: ExtractedInvoice[] } } = {};
        
        const currentBatches = invoices.filter(inv => 
            (inv.status === 'batched_for_payment' || inv.status === 'paid') && 
            !inv.isPrivate &&
            inv.paymentBatch && 
            inv.paymentBatch !== 'private'
        );

        currentBatches.forEach(inv => {
            const batchKey = inv.paymentBatch!;
            
            if (!batches[batchKey]) {
                batches[batchKey] = { CAP: [], S38: [], S39: [] };
            }
            if (inv.expenseType === 'CAP') {
                batches[batchKey].CAP.push(inv);
            } else if (inv.expenseType === 'S39') {
                batches[batchKey].S39.push(inv);
            }
            else { // S38 or undefined
                batches[batchKey].S38.push(inv);
            }
        });
        
        const mappedBatches = Object.entries(batches).map(([batchKey, expenseGroups]) => {
            let title: string;
            let batchDate: Date | null = null;
            
            try {
                batchDate = parseISO(batchKey);
                title = `Payment for ${format(batchDate, 'dd MMMM yyyy')}`;
            } catch(e) {
                title = `Batch: ${batchKey}`;
                batchDate = new Date(9999, 11, 31); // Put invalid dates at the end
            }
            
            const calculateTotals = (invoices: ExtractedInvoice[]) => {
                return invoices.reduce((acc, inv) => {
                    const { payableAmount, payeAmount } = inv.lineItems.reduce((lineAcc, item) => {
                        const lineValue = item.exclusiveAmount + item.vatAmount;
                        const payeDeduction = item.paye ? lineValue * 0.25 : 0;
                        lineAcc.payableAmount += lineValue - payeDeduction;
                        lineAcc.payeAmount += payeDeduction;
                        return lineAcc;
                    }, { payableAmount: 0, payeAmount: 0 });
                    acc.totalPayable += payableAmount;
                    acc.totalPAYE += payeAmount;
                    return acc;
                }, { totalPayable: 0, totalPAYE: 0 });
            };
            
            const capTotals = calculateTotals(expenseGroups.CAP);
            const s38Totals = calculateTotals(expenseGroups.S38);
            const s39Totals = calculateTotals(expenseGroups.S39);

            return {
                title,
                batchDate,
                batchKey,
                capTotal: capTotals.totalPayable,
                capPAYE: capTotals.totalPAYE,
                s38Total: s38Totals.totalPayable,
                s38PAYE: s38Totals.totalPAYE,
                s39Total: s39Totals.totalPayable,
                s39PAYE: s39Totals.totalPAYE,
                ...expenseGroups,
            };
        });

        return mappedBatches.sort((a, b) => {
            if (!a.batchDate) return 1;
            if (!b.batchDate) return -1;
            return b.batchDate.getTime() - a.batchDate.getTime();
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
            ) : (
                <div className="space-y-6">
                    {weeklyBatches.length === 0 ? (
                         <p className="text-center text-muted-foreground py-10">No payment batches found.</p>
                    ) : weeklyBatches.map((batch, index) => {
                        const isBatchInPast = batch.batchDate ? isPast(endOfDay(batch.batchDate)) : false;
                        const hasPAYE = batch.capPAYE > 0 || batch.s38PAYE > 0 || batch.s39PAYE > 0;
                        return(
                        <Collapsible key={index} defaultOpen={!isBatchInPast}>
                             <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 p-3 bg-muted rounded-t-lg border">
                                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                                    <h2 className="text-xl font-bold">{batch.title}</h2>
                                    {hasPAYE && <Badge variant="destructive">PAYE</Badge>}
                                </div>
                             </CollapsibleTrigger>
                             <CollapsibleContent className="space-y-8 p-4 border-x border-b rounded-b-lg">
                                <div className="flex flex-wrap gap-8 items-start">
                                    {batch.CAP.length > 0 && (
                                        <PaymentBatchTable 
                                            title="CAP Expenses"
                                            batchKey={batch.batchKey}
                                            invoices={batch.CAP}
                                            allInvoices={invoices}
                                            totalAmount={batch.capTotal}
                                            totalPAYE={batch.capPAYE}
                                            onDelete={handleRemoveFromBatch}
                                            onUploadPop={handleUploadPop}
                                            onEdit={setEditingInvoice}
                                            onRemovePop={handleRemovePop}
                                        />
                                    )}
                                    {batch.S38.length > 0 && (
                                        <PaymentBatchTable 
                                            title="S38 Expenses"
                                            batchKey={batch.batchKey}
                                            invoices={batch.S38}
                                            allInvoices={invoices}
                                            totalAmount={batch.s38Total}
                                            totalPAYE={batch.s38PAYE}
                                            onDelete={handleRemoveFromBatch}
                                            onUploadPop={handleUploadPop}
                                            onEdit={setEditingInvoice}
                                            onRemovePop={handleRemovePop}
                                        />
                                    )}
                                     {batch.S39.length > 0 && (
                                        <PaymentBatchTable 
                                            title="S39 Expenses"
                                            batchKey={batch.batchKey}
                                            invoices={batch.S39}
                                            allInvoices={invoices}
                                            totalAmount={batch.s39Total}
                                            totalPAYE={batch.s39PAYE}
                                            onDelete={handleRemoveFromBatch}
                                            onUploadPop={handleUploadPop}
                                            onEdit={setEditingInvoice}
                                            onRemovePop={handleRemovePop}
                                        />
                                    )}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )})}
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
