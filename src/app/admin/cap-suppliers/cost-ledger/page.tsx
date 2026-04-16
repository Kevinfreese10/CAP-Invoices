
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ChevronDown, Check, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { format, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';


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
                const q = query(collection(db, 'extractedInvoices'), where('status', 'in', ['batched_for_payment', 'paid']));
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
            .map(b => ({ value: b!, label: format(new Date(b!), 'dd MMMM yyyy') }));
    }, [invoices]);
    
    const filteredLineItems = useMemo(() => {
        const allItems: GroupedLineItem[] = [];
        const targetInvoices = selectedBatches.length > 0
            ? invoices.filter(inv => inv.paymentBatch && selectedBatches.includes(inv.paymentBatch))
            : invoices;
            
        targetInvoices.forEach(invoice => {
            invoice.lineItems.forEach(item => {
                if (item.accountId) {
                    allItems.push({
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
                }
            });
        });
        return allItems;
    }, [invoices, selectedBatches]);

    const groupedByAccount = useMemo(() => {
        const groups: { [key: string]: { account: any; items: GroupedLineItem[]; total: number; expenseType?: 'CAP' | 'S38' | 'S39' } } = {};

        filteredLineItems.forEach(item => {
            if (!item.accountId) return;
            const groupKey = `${item.accountId}-${item.expenseType || 'CAP'}`;

            if (!groups[groupKey]) {
                let accountDetails;
                let chart;
                switch(item.expenseType) {
                    case 'S38': chart = s38ChartOfAccounts; break;
                    case 'S39': chart = s39ChartOfAccounts; break;
                    default: chart = capChartOfAccounts;
                }
                accountDetails = chart.find(acc => acc.accountNumber === item.accountId);
                
                groups[groupKey] = {
                    account: accountDetails || { accountNumber: item.accountId, description: 'Unknown Account' },
                    items: [],
                    total: 0,
                    expenseType: item.expenseType
                };
            }
            groups[groupKey].items.push(item);
            groups[groupKey].total += item.exclusiveAmount;
        });

        for (const groupKey in groups) {
            groups[groupKey].items.sort((a, b) => {
                const dateA = new Date(a.invoiceDate.split('/').reverse().join('-'));
                const dateB = new Date(b.invoiceDate.split('/').reverse().join('-'));
                return dateA.getTime() - dateB.getTime();
            });
        }
        
        return Object.values(groups).sort((a, b) => {
            const numCompare = a.account.accountNumber.localeCompare(b.account.accountNumber);
            if (numCompare !== 0) return numCompare;
            return (a.expenseType || 'CAP').localeCompare(b.expenseType || 'CAP');
        });
    }, [filteredLineItems]);

    const handleExportAll = () => {
        const dataToExport: any[] = [];
        
        const header = [
            'Invoice Date',
            'Supplier',
            'Line Description',
            'Amount (Excl. VAT)',
            'File URL',
        ];

        groupedByAccount.forEach(group => {
            dataToExport.push([`${group.account.accountNumber} - ${group.account.description} (${group.expenseType || 'CAP'})`]);
            dataToExport.push(header);
            
            group.items.forEach(item => {
                dataToExport.push([
                    item.invoiceDate,
                    item.supplier,
                    item.ledgerDescription || item.description,
                    item.exclusiveAmount,
                    item.fileUrl,
                ]);
            });

            dataToExport.push([
                '', '', 'Total for Account:', group.total
            ]);
            
            dataToExport.push([]); 
        });

        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
        
        const colWidths = header.map((_, i) => ({ wch: 20 })); 
        worksheet['!cols'] = colWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Ledger');
        XLSX.writeFile(workbook, `Cost_Ledger_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Cost Ledger</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filter Report</CardTitle>
                    <CardDescription>
                        Select payment batches to generate a detailed cost ledger.
                    </CardDescription>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
                       <MultiSelectFilter 
                           title="Payment Batches" 
                           options={paymentBatches} 
                           selectedValues={selectedBatches} 
                           setSelectedValues={setSelectedBatches} 
                       />
                       <div className="md:col-start-3 flex justify-end">
                           <Button onClick={handleExportAll} disabled={isLoading || filteredLineItems.length === 0}>
                                Export to Excel
                            </Button>
                       </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : groupedByAccount.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {selectedBatches.length > 0 ? "No costs found for the selected filters." : "No batched transactions found. Select a filter to begin."}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {groupedByAccount.map((group) => (
                                <Collapsible key={`${group.account.accountNumber}-${group.expenseType}`}>
                                    <Card>
                                        <CollapsibleTrigger asChild>
                                            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                                                <div className="flex items-center gap-4">
                                                    <Button variant="ghost" size="icon" className="group-data-[state=open]:rotate-180">
                                                        <ChevronDown className="h-4 w-4 transition-transform"/>
                                                    </Button>
                                                    <div>
                                                        <CardTitle>{group.account.description}</CardTitle>
                                                        <CardDescription>Account: {group.account.accountNumber} ({group.expenseType || 'CAP'})</CardDescription>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Total</p>
                                                    <p className="text-xl font-bold">{formatPrice(group.total)}</p>
                                                </div>
                                            </CardHeader>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Invoice Date</TableHead>
                                                            <TableHead>Supplier</TableHead>
                                                            <TableHead>Description</TableHead>
                                                            <TableHead>Commission #</TableHead>
                                                            <TableHead>Payment Batch</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {group.items.map((item, index) => (
                                                            <TableRow key={`${item.invoiceId}-${index}`}>
                                                                <TableCell>{item.invoiceDate}</TableCell>
                                                                <TableCell>{item.supplier}</TableCell>
                                                                <TableCell>{item.ledgerDescription || item.description}</TableCell>
                                                                <TableCell>{item.commissionNumber || 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    {item.paymentBatch ? (
                                                                        <Badge variant="outline">{!isNaN(new Date(item.paymentBatch).getTime()) ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : item.paymentBatch}</Badge>
                                                                    ): 'N/A'}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
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
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
