
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ChevronDown, Check, ChevronsUpDown, Banknote, FileSpreadsheet } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

type GroupedLineItem = ExtractedInvoice['lineItems'][0] & {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    supplier: string;
    fileUrl: string;
    commissionNumber?: string;
    paymentBatch?: string;
    expenseType?: 'CAP' | 'S38' | 'S39';
};

function MultiSelectFilter({ title, options, selectedValues, setSelectedValues }: { title: string, options: { value: string; label: string }[], selectedValues: string[], setSelectedValues: (values: string[]) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{title}</p>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="truncate">
                            {selectedValues.length === 0
                                ? `Select ${title.toLowerCase()}...`
                                : selectedValues.length === 1
                                ? selectedValues.map(val => options.find(o => o.value === val)?.label).join(', ')
                                : `${selectedValues.length} selected`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder={`Search ${title.toLowerCase()}...`} />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        const newSelected = selectedValues.includes(option.value)
                                            ? selectedValues.filter((v) => v !== option.value)
                                            : [...selectedValues, option.value];
                                        setSelectedValues(newSelected);
                                    }}
                                >
                                     <Checkbox
                                        className="mr-2"
                                        checked={selectedValues.includes(option.value)}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
             <div className="flex flex-wrap gap-1">
                {selectedValues.map(value => (
                    <Badge key={value} variant="secondary" className="text-xs">
                        {options.find(o => o.value === value)?.label || value}
                    </Badge>
                ))}
            </div>
        </div>
    );
}

export default function CostLedgerPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

    useEffect(() => {
        const fetchBatchedInvoices = async () => {
            setIsLoading(true);
            try {
                // Strictly fetch only batched or paid invoices
                const q = query(
                    collection(db, 'extractedInvoices'), 
                    where('status', 'in', ['batched_for_payment', 'paid'])
                );
                const querySnapshot = await getDocs(q);
                const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
                setInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching batched invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBatchedInvoices();
    }, []);

    const paymentBatches = useMemo(() => {
        const batches = new Set(invoices.map(inv => inv.paymentBatch).filter(Boolean));
        return Array.from(batches)
            .filter(b => b && !isNaN(new Date(b).getTime()))
            .sort((a,b) => new Date(b!).getTime() - new Date(a!).getTime())
            .map(b => ({ value: b!, label: format(parseISO(b!), 'dd MMMM yyyy') }));
    }, [invoices]);
    
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    const groupedByBatch = useMemo(() => {
        const groups: { [batchDate: string]: { 
            batchDate: string;
            batchLabel: string;
            totalPayable: number; // Inclusive - PAYE (for reconciliation)
            accounts: { [accountKey: string]: {
                account: any;
                expenseType: string;
                totalExclusive: number;
                items: GroupedLineItem[];
            }}
        }} = {};

        const targetInvoices = selectedBatches.length > 0
            ? invoices.filter(inv => inv.paymentBatch && selectedBatches.includes(inv.paymentBatch))
            : invoices.filter(inv => !!inv.paymentBatch);

        targetInvoices.forEach(invoice => {
            const batchDate = invoice.paymentBatch!;
            if (!groups[batchDate]) {
                groups[batchDate] = {
                    batchDate,
                    batchLabel: !isNaN(new Date(batchDate).getTime()) ? format(parseISO(batchDate), 'dd MMMM yyyy') : batchDate,
                    totalPayable: 0,
                    accounts: {}
                };
            }

            // Calculate total payable for this invoice (Inclusive - PAYE)
            const invoicePayable = invoice.lineItems.reduce((acc, item) => {
                const inclusive = item.exclusiveAmount + item.vatAmount;
                const paye = item.paye ? inclusive * 0.25 : 0;
                return acc + (inclusive - paye);
            }, 0);
            groups[batchDate].totalPayable += invoicePayable;

            invoice.lineItems.forEach(item => {
                if (!item.accountId) return;
                const accountKey = `${item.accountId}-${invoice.expenseType || 'CAP'}`;

                if (!groups[batchDate].accounts[accountKey]) {
                    let chart;
                    switch(invoice.expenseType) {
                        case 'S38': chart = s38ChartOfAccounts; break;
                        case 'S39': chart = s39ChartOfAccounts; break;
                        default: chart = capChartOfAccounts;
                    }
                    const accountDetails = chart.find(acc => acc.accountNumber === item.accountId);
                    
                    groups[batchDate].accounts[accountKey] = {
                        account: accountDetails || { accountNumber: item.accountId, description: 'Unknown Account' },
                        expenseType: invoice.expenseType || 'CAP',
                        totalExclusive: 0,
                        items: []
                    };
                }

                groups[batchDate].accounts[accountKey].items.push({
                    ...item,
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    invoiceDate: invoice.date,
                    supplier: invoice.supplier,
                    fileUrl: invoice.fileUrl,
                    commissionNumber: invoice.commissionNumber,
                    paymentBatch: invoice.paymentBatch,
                    expenseType: invoice.expenseType,
                });
                groups[batchDate].accounts[accountKey].totalExclusive += item.exclusiveAmount;
            });
        });

        // Sort everything
        return Object.values(groups)
            .sort((a, b) => new Date(b.batchDate).getTime() - new Date(a.batchDate).getTime())
            .map(batch => ({
                ...batch,
                accounts: Object.values(batch.accounts).sort((a, b) => a.account.accountNumber.localeCompare(b.account.accountNumber))
            }));
    }, [invoices, selectedBatches]);

    const handleExport = () => {
        const dataToExport: any[] = [];
        
        groupedByBatch.forEach(batch => {
            dataToExport.push([`PAYMENT BATCH: ${batch.batchLabel}`]);
            dataToExport.push(['Batch Total Payout (Net):', batch.totalPayable]);
            dataToExport.push([]);

            batch.accounts.forEach(group => {
                dataToExport.push([`${group.account.accountNumber} - ${group.account.description} (${group.expenseType})`]);
                dataToExport.push(['Invoice Date', 'Supplier', 'Description', 'Commission #', 'Exclusive Amount']);
                
                group.items.forEach(item => {
                    dataToExport.push([
                        item.invoiceDate,
                        item.supplier,
                        item.ledgerDescription || item.description,
                        item.commissionNumber || 'N/A',
                        item.exclusiveAmount
                    ]);
                });
                dataToExport.push(['', '', '', 'Total Exclusive:', group.totalExclusive]);
                dataToExport.push([]); 
            });
            dataToExport.push(['--------------------------------------------------']);
            dataToExport.push([]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Ledger');
        XLSX.writeFile(workbook, `Cost_Ledger_Consolidated_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Cost Ledger</h1>
                <Button onClick={handleExport} disabled={isLoading || groupedByBatch.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Consolidated Ledger</CardTitle>
                    <CardDescription>
                        Costs grouped by Payment Batch to tie back to bank payouts.
                    </CardDescription>
                    <div className="pt-4 max-w-sm">
                       <MultiSelectFilter 
                           title="Filter Payment Batches" 
                           options={paymentBatches} 
                           selectedValues={selectedBatches} 
                           setSelectedValues={setSelectedBatches} 
                       />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : groupedByBatch.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {selectedBatches.length > 0 ? "No costs found for the selected batches." : "No batched transactions found."}
                        </p>
                    ) : (
                        <div className="space-y-12">
                            {groupedByBatch.map((batch) => (
                                <div key={batch.batchDate} className="space-y-4">
                                    <div className="flex items-center justify-between bg-muted/40 p-4 rounded-lg border border-primary/20">
                                        <div className="flex items-center gap-3">
                                            <Banknote className="h-6 w-6 text-primary" />
                                            <div>
                                                <h2 className="text-xl font-bold">{batch.batchLabel}</h2>
                                                <p className="text-sm text-muted-foreground">Consolidated Payment Batch</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Total Batch Payout (Net)</p>
                                            <p className="text-2xl font-bold text-primary">{formatPrice(batch.totalPayable)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 pl-4 border-l-2">
                                        {batch.accounts.map((group) => (
                                            <Collapsible key={`${batch.batchDate}-${group.account.accountNumber}-${group.expenseType}`}>
                                                <Card className="shadow-none">
                                                    <CollapsibleTrigger asChild>
                                                        <CardHeader className="flex flex-row items-center justify-between py-3 cursor-pointer hover:bg-muted/30">
                                                            <div className="flex items-center gap-4">
                                                                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                                                <div>
                                                                    <p className="font-semibold text-sm">{group.account.description}</p>
                                                                    <p className="text-xs text-muted-foreground">GL: {group.account.accountNumber} ({group.expenseType})</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-bold">{formatPrice(group.totalExclusive)}</p>
                                                            </div>
                                                        </CardHeader>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                        <CardContent className="p-0 border-t">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-muted/10">
                                                                        <TableHead className="h-8">Date</TableHead>
                                                                        <TableHead className="h-8">Supplier</TableHead>
                                                                        <TableHead className="h-8">Ledger Description</TableHead>
                                                                        <TableHead className="h-8">Comm #</TableHead>
                                                                        <TableHead className="h-8 text-right">Exclusive</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.items.map((item, index) => (
                                                                        <TableRow key={`${item.invoiceId}-${index}`} className="text-xs">
                                                                            <TableCell className="py-2">{item.invoiceDate}</TableCell>
                                                                            <TableCell className="py-2 font-medium">{item.supplier}</TableCell>
                                                                            <TableCell className="py-2 italic">{item.ledgerDescription || item.description}</TableCell>
                                                                            <TableCell className="py-2">{item.commissionNumber || 'N/A'}</TableCell>
                                                                            <TableCell className="py-2 text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </CardContent>
                                                    </CollapsibleContent>
                                                </Card>
                                            </Collapsible>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
