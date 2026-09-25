'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Banknote, ChevronDown, Trash2, Upload, Download, MoreHorizontal, Edit, AlertTriangle, Eye, Archive, AlertCircle, Sparkles, Maximize2, Minimize2, EyeOff } from 'lucide-react';
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
    duplicateInvoiceNumbers?: string[];
    hasDiscrepancy: boolean;
    hasPreviousPaye: boolean;
    isFirstTimeSupplier: boolean;
};

function PaymentBatchTable({ 
    title, 
    invoices: batchInvoices, 
    allInvoices, 
    totalAmount, 
    totalPAYE, 
    onDelete, 
    onUploadPop, 
    onEdit, 
    batchKey, 
    onRemovePop,
    isMaximized,
    onToggleMaximize,
    onHide,
    canHide,
}: { 
    title: string, 
    invoices: ExtractedInvoice[], 
    allInvoices: ExtractedInvoice[], 
    totalAmount: number, 
    totalPAYE: number, 
    onDelete: (id: string, isArchive: boolean) => void, 
    onUploadPop: (supplierName: string, file: File, batchKey: string) => Promise<void>, 
    onEdit: (invoice: ExtractedInvoice) => void, 
    batchKey: string, 
    onRemovePop: (supplierName: string, batchKey: string) => Promise<void>,
    isMaximized?: boolean,
    onToggleMaximize?: () => void,
    onHide?: () => void,
    canHide?: boolean,
}) {
    const [openSupplier, setOpenSupplier] = useState<string | null>(null);
    const [uploadingPop, setUploadingPop] = useState<string | null>(null);
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const [cardStyle, setCardStyle] = useState<{ width?: string, height?: string }>({});

    // Track all suppliers who have had PAYE deductions in any invoice history
    const payeSuppliersInHistory = useMemo(() => {
        const set = new Set<string>();
        (allInvoices || []).forEach(inv => {
            if (inv.lineItems && inv.lineItems.some(li => li.paye)) {
                set.add((inv.supplier || '').toLowerCase().trim());
            }
        });
        return set;
    }, [allInvoices]);

    // Track all suppliers who have had at least one PAID invoice in history before/outside of this batch
    const paidSuppliersInHistory = useMemo(() => {
        const set = new Set<string>();
        (allInvoices || []).forEach(inv => {
            if (inv.status === 'paid') {
                if (batchKey && inv.paymentBatch && inv.paymentBatch.match(/^\d{4}-\d{2}-\d{2}$/) && batchKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    if (inv.paymentBatch < batchKey) {
                        set.add((inv.supplier || '').toLowerCase().trim());
                    }
                } else if (inv.paymentBatch !== batchKey) {
                    set.add((inv.supplier || '').toLowerCase().trim());
                }
            }
        });
        return set;
    }, [allInvoices, batchKey]);

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
                    hasPreviousPaye: false,
                    isFirstTimeSupplier: false,
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
            const invoiceNumberCounts = group.invoices.reduce((acc, inv) => {
                const num = (inv.invoiceNumber || '').trim();
                if (num) {
                    acc[num] = (acc[num] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const duplicateNums = Object.keys(invoiceNumberCounts).filter(num => invoiceNumberCounts[num] > 1);
            group.hasDuplicates = duplicateNums.length > 0;
            group.duplicateInvoiceNumbers = duplicateNums;

            // Check for discrepancy: Sum of extracted totals vs Calculated totals (Net + PAYE)
            // Using a small epsilon to account for floating point math
            const calculatedGross = group.totalAmount + group.totalPAYE;
            group.hasDiscrepancy = Math.abs(group.totalInvoiceGross - calculatedGross) > 0.05;

            // Flag if supplier has had PAYE deductions in previous invoices
            const normalizedSupplier = (group.supplier || '').toLowerCase().trim();
            group.hasPreviousPaye = payeSuppliersInHistory.has(normalizedSupplier);

            // Flag if supplier is receiving payment for the first time (no prior paid invoices in history)
            group.isFirstTimeSupplier = !paidSuppliersInHistory.has(normalizedSupplier);
        });

        return Object.values(groups).sort((a, b) => a.supplier.localeCompare(b.supplier));
    }, [batchInvoices, payeSuppliersInHistory, paidSuppliersInHistory]);

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

    const isFullWidth = isMaximized;

    return (
        <Card 
            ref={cardRef} 
            style={isFullWidth ? { width: '100%' } : cardStyle} 
            className={cn(
                "resize overflow-auto min-h-[300px] flex flex-col flex-1 max-w-full transition-all duration-200",
                isFullWidth ? "w-full min-w-full" : "min-w-[350px]"
            )}
        >
            <CardHeader className="flex-none pb-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <CardTitle className="min-w-fit">{title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 ml-auto">
                        <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                            <Download className="mr-2 h-4 w-4" /> Download Batch
                        </Button>
                        <div className="text-right min-w-fit">
                            <p className="text-sm text-muted-foreground">Batch Total Payable</p>
                            <p className="text-xl sm:text-2xl font-bold whitespace-nowrap">{formatPrice(totalAmount)}</p>
                        </div>
                        <div className="flex items-center gap-1 border-l pl-2">
                            {onToggleMaximize && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn("h-8 w-8", isMaximized && "bg-accent text-accent-foreground font-bold")}
                                                onClick={onToggleMaximize}
                                            >
                                                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{isMaximized ? "Restore card width" : "Maximize card (Full Width)"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {onHide && canHide && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                                                onClick={onHide}
                                            >
                                                <EyeOff className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Hide / close this table to make other table wider</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
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
                                                {group.hasDuplicates && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="destructive" className="ml-2 flex items-center gap-1 cursor-help font-medium text-xs">
                                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                                    Duplicate Inv #
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p className="font-bold text-destructive flex items-center gap-1">
                                                                    <AlertTriangle className="h-3.5 w-3.5" /> Duplicate Invoice Number Warning
                                                                </p>
                                                                <p className="text-xs mt-1">
                                                                    Multiple invoices in this batch share the exact same invoice number: <strong>{group.duplicateInvoiceNumbers?.join(', ')}</strong>. Please verify if this is a duplicate entry.
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
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
                                                {group.totalPAYE > 0 ? (
                                                    <Badge variant="destructive" className="ml-2">PAYE</Badge>
                                                ) : group.hasPreviousPaye ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className="ml-2 border-amber-500/50 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-help flex items-center gap-1 font-medium text-xs"
                                                                >
                                                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                                                    Prev PAYE
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p className="font-bold text-amber-600 flex items-center gap-1">
                                                                    <AlertTriangle className="h-3.5 w-3.5" /> Historical PAYE Supplier
                                                                </p>
                                                                <p className="text-xs mt-1">
                                                                    This supplier had PAYE deducted on previous invoices, but has <strong>R0.00 PAYE</strong> in this batch. Please verify if PAYE deduction should apply.
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : null}
                                                {group.isFirstTimeSupplier && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className="ml-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 cursor-help flex items-center gap-1 font-medium text-xs"
                                                                >
                                                                    <Sparkles className="h-3 w-3 text-emerald-600" />
                                                                    1st Payment
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p className="font-bold text-emerald-600 flex items-center gap-1">
                                                                    <Sparkles className="h-3.5 w-3.5" /> 1st Time Supplier Payment
                                                                </p>
                                                                <p className="text-xs mt-1">
                                                                    This supplier has no prior paid invoices in payment history. Please ensure banking details and vendor verification have been verified.
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
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
                                                                const lineTotalSum = invoice.lineItems.reduce((s, li) => s + (Number(li.exclusiveAmount) || 0) + (Number(li.vatAmount) || 0), 0);
                                                                const safeInvoiceTotal = Number(invoice.invoiceTotal) || 0;
                                                                const hasLineDiscrepancy = Math.abs(safeInvoiceTotal - lineTotalSum) > 0.01;

                                                                return (
                                                                <TableRow key={invoice.id} className="text-xs">
                                                                    <TableCell className="py-1 flex items-center gap-2">
                                                                        {invoice.invoiceNumber}
                                                                        {group.duplicateInvoiceNumbers?.includes((invoice.invoiceNumber || '').trim()) && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge variant="destructive" className="text-[10px] cursor-help flex items-center gap-1">
                                                                                            <AlertTriangle className="h-3 w-3" /> Duplicate #{invoice.invoiceNumber}
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="max-w-xs text-xs">
                                                                                        <p className="font-bold">Duplicate Invoice Number</p>
                                                                                        <p className="mt-1">Invoice number <strong>{invoice.invoiceNumber}</strong> appears more than once for this supplier in this batch.</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                        {isAlreadyPaid(invoice) && (
                                                                            <Badge variant="success">Paid</Badge>
                                                                        )}
                                                                        {invoiceHasPaye ? (
                                                                            <Badge variant="destructive">PAYE</Badge>
                                                                        ) : group.hasPreviousPaye ? (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] cursor-help">
                                                                                            No PAYE (Prev PAYE Supplier)
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="max-w-xs text-xs">
                                                                                        Supplier has PAYE history, but PAYE is not applied to this invoice.
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        ) : null}
                                                                        {group.isFirstTimeSupplier && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px] cursor-help">
                                                                                            1st Payment
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="max-w-xs text-xs">
                                                                                        First time supplier payment.
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                        {hasLineDiscrepancy && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <AlertCircle className="h-3 w-3 text-destructive" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>Invoice total (R{safeInvoiceTotal.toFixed(2)}) doesn't match line items (R{lineTotalSum.toFixed(2)})</p>
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
    );
}

function WeeklyBatchSection({
    batch,
    allInvoices,
    onDelete,
    onUploadPop,
    onEdit,
    onRemovePop,
}: {
    batch: {
        title: string;
        batchDate: Date | null;
        batchKey: string;
        capTotal: number;
        capPAYE: number;
        s38Total: number;
        s38PAYE: number;
        s39Total: number;
        s39PAYE: number;
        goTotal: number;
        goPAYE: number;
        CAP: ExtractedInvoice[];
        S38: ExtractedInvoice[];
        S39: ExtractedInvoice[];
        GO: ExtractedInvoice[];
    };
    allInvoices: ExtractedInvoice[];
    onDelete: (id: string, isArchive: boolean) => void;
    onUploadPop: (supplierName: string, file: File, batchKey: string) => Promise<void>;
    onEdit: (invoice: ExtractedInvoice) => void;
    onRemovePop: (supplierName: string, batchKey: string) => Promise<void>;
}) {
    const isBatchInPast = batch.batchDate ? isPast(endOfDay(batch.batchDate)) : false;
    const hasPAYE = batch.capPAYE > 0 || batch.s38PAYE > 0 || batch.s39PAYE > 0 || batch.goPAYE > 0;

    const availableTables = useMemo(() => {
        const list: { key: 'CAP' | 'S38' | 'S39' | 'GO'; title: string; invoices: ExtractedInvoice[]; total: number; paye: number }[] = [];
        if (batch.CAP.length > 0) list.push({ key: 'CAP', title: 'CAP Expenses', invoices: batch.CAP, total: batch.capTotal, paye: batch.capPAYE });
        if (batch.S38.length > 0) list.push({ key: 'S38', title: 'S38 Expenses', invoices: batch.S38, total: batch.s38Total, paye: batch.s38PAYE });
        if (batch.S39.length > 0) list.push({ key: 'S39', title: 'S39 Expenses', invoices: batch.S39, total: batch.s39Total, paye: batch.s39PAYE });
        if (batch.GO.length > 0) list.push({ key: 'GO', title: 'GO Expenses', invoices: batch.GO, total: batch.goTotal, paye: batch.goPAYE });
        return list;
    }, [batch]);

    const [hiddenTableKeys, setHiddenTableKeys] = useState<string[]>([]);
    const [maximizedKey, setMaximizedKey] = useState<string | null>(null);

    const toggleHideTable = (key: string) => {
        setHiddenTableKeys(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            if (next.length === availableTables.length) {
                return prev;
            }
            return next;
        });
        if (maximizedKey === key) {
            setMaximizedKey(null);
        }
    };

    const unhideTable = (key: string) => {
        setHiddenTableKeys(prev => prev.filter(k => k !== key));
    };

    const showAllTables = () => {
        setHiddenTableKeys([]);
        setMaximizedKey(null);
    };

    const focusOnlyTable = (key: string) => {
        const others = availableTables.filter(t => t.key !== key).map(t => t.key);
        setHiddenTableKeys(others);
        setMaximizedKey(key);
    };

    const toggleMaximizeTable = (key: string) => {
        setMaximizedKey(prev => prev === key ? null : key);
    };

    const visibleTables = availableTables.filter(t => !hiddenTableKeys.includes(t.key));

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    return (
        <Collapsible defaultOpen={!isBatchInPast}>
            <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-t-lg border">
                    <div className="flex items-center gap-2">
                        <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                        <h2 className="text-xl font-bold">{batch.title}</h2>
                        {hasPAYE && <Badge variant="destructive">PAYE</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-3">
                        {availableTables.map(t => (
                            <span key={t.key}>
                                <span className="font-semibold text-foreground">{t.key}:</span> {formatPrice(t.total)}
                            </span>
                        ))}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-4 border-x border-b rounded-b-lg">
                {/* Control toolbar when multiple tables exist */}
                {availableTables.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-muted/40 rounded-lg border">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">View:</span>
                            <Button 
                                size="sm" 
                                variant={hiddenTableKeys.length === 0 && !maximizedKey ? "default" : "outline"}
                                className="h-7 text-xs"
                                onClick={showAllTables}
                            >
                                Show All ({availableTables.length})
                            </Button>
                            {availableTables.map(t => {
                                const isFocused = visibleTables.length === 1 && visibleTables[0].key === t.key;
                                return (
                                    <Button
                                        key={t.key}
                                        size="sm"
                                        variant={isFocused ? "default" : "outline"}
                                        className="h-7 text-xs"
                                        onClick={() => focusOnlyTable(t.key)}
                                    >
                                        Focus {t.key} ({formatPrice(t.total)})
                                    </Button>
                                );
                            })}
                        </div>
                        {hiddenTableKeys.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <EyeOff className="h-3.5 w-3.5 text-amber-500" /> Hidden:
                                </span>
                                {hiddenTableKeys.map(k => {
                                    const tableInfo = availableTables.find(t => t.key === k);
                                    return (
                                        <Button
                                            key={k}
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-xs border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium"
                                            onClick={() => unhideTable(k)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" /> Show {tableInfo?.title || k}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-6 items-start">
                    {visibleTables.map((t) => (
                        <PaymentBatchTable
                            key={t.key}
                            title={t.title}
                            batchKey={batch.batchKey}
                            invoices={t.invoices}
                            allInvoices={allInvoices}
                            totalAmount={t.total}
                            totalPAYE={t.paye}
                            onDelete={onDelete}
                            onUploadPop={onUploadPop}
                            onEdit={onEdit}
                            onRemovePop={onRemovePop}
                            isMaximized={maximizedKey === t.key || visibleTables.length === 1}
                            onToggleMaximize={() => toggleMaximizeTable(t.key)}
                            onHide={() => toggleHideTable(t.key)}
                            canHide={availableTables.length > 1 && visibleTables.length > 1}
                        />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}


export default function PaymentBatchesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { user } = useAuth();

    const fetchInvoices = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
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
            if (showLoader) setIsLoading(false);
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
            fetchInvoices(false);
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
            fetchInvoices(false);
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
            fetchInvoices(false);

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
            fetchInvoices(false);

        } catch (error) {
            console.error('Error removing POP:', error);
            toast({ title: 'Removal Failed', description: 'Could not remove the proof of payment.', variant: 'destructive'});
        }
    };
    
    const weeklyBatches = useMemo(() => {
        const batches = {} as Record<string, { CAP: ExtractedInvoice[], S38: ExtractedInvoice[], S39: ExtractedInvoice[], GO: ExtractedInvoice[] }>;
        
        const currentBatches = invoices.filter(inv => 
            (inv.status === 'batched_for_payment' || inv.status === 'paid') && 
            !inv.isPrivate &&
            inv.paymentBatch && 
            inv.paymentBatch !== 'private'
        );

        currentBatches.forEach(inv => {
            if (!inv.paymentBatch) return;
            
            if (!batches[inv.paymentBatch]) {
                batches[inv.paymentBatch] = { CAP: [], S38: [], S39: [], GO: [] };
            }

            if (inv.expenseType === 'CAP') {
                batches[inv.paymentBatch].CAP.push(inv);
            } else if (inv.expenseType === 'S39') {
                batches[inv.paymentBatch].S39.push(inv);
            } else if (inv.expenseType === 'GO') {
                batches[inv.paymentBatch].GO.push(inv);
            } else { // S38 or undefined
                batches[inv.paymentBatch].S38.push(inv);
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
            const goTotals = calculateTotals(expenseGroups.GO);

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
                goTotal: goTotals.totalPayable,
                goPAYE: goTotals.totalPAYE,
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
                    ) : weeklyBatches.map((batch) => (
                        <WeeklyBatchSection
                            key={batch.batchKey}
                            batch={batch}
                            allInvoices={invoices}
                            onDelete={handleRemoveFromBatch}
                            onUploadPop={handleUploadPop}
                            onEdit={setEditingInvoice}
                            onRemovePop={handleRemovePop}
                        />
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
