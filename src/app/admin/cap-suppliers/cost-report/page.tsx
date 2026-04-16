
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Checkbox } from '@/components/ui/checkbox';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';


const db = getFirestore(firebaseApp);
const allAccounts = [...s38ChartOfAccounts, ...capChartOfAccounts, ...s39ChartOfAccounts];

function MultiSelectFilter({ title, options, selectedValues, setSelectedValues }: { title: string, options: string[], selectedValues: string[], setSelectedValues: (values: string[]) => void }) {
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
                                ? selectedValues[0]
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
                                    key={option}
                                    value={option}
                                    onSelect={(currentValue) => {
                                        const newSelected = selectedValues.includes(currentValue)
                                            ? selectedValues.filter((v) => v !== currentValue)
                                            : [...selectedValues, currentValue];
                                        setSelectedValues(newSelected);
                                    }}
                                >
                                     <Checkbox
                                        className="mr-2"
                                        checked={selectedValues.includes(option)}
                                        onCheckedChange={(checked) => {
                                             const newSelected = checked
                                                ? [...selectedValues, option]
                                                : selectedValues.filter((v) => v !== option);
                                            setSelectedValues(newSelected);
                                        }}
                                    />
                                    {option}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
             <div className="flex flex-wrap gap-1">
                {selectedValues.map(value => (
                    <Badge key={value} variant="secondary" className="text-xs">
                        {value}
                    </Badge>
                ))}
            </div>
        </div>
    );
}

export default function CostReportPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices for cost report:", error);
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        fetchInvoices();
    }, []);

    const { commissionNumbers, paymentBatches } = useMemo(() => {
        const commissions = new Set(invoices.map(inv => inv.commissionNumber).filter(Boolean));
        const batches = new Set(invoices.map(inv => inv.paymentBatch).filter(Boolean));
        return {
            commissionNumbers: Array.from(commissions).sort(),
            paymentBatches: Array.from(batches)
                .filter(b => b && !isNaN(new Date(b).getTime()))
                .sort((a,b) => new Date(b).getTime() - new Date(a).getTime()),
        };
    }, [invoices]);
    
     const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const commissionMatch = selectedCommissions.length === 0 || (inv.commissionNumber && selectedCommissions.includes(inv.commissionNumber));
            const batchMatch = selectedBatches.length === 0 || (inv.paymentBatch && selectedBatches.some(selectedBatch => {
                try {
                    const formattedSelectedBatch = format(parse(selectedBatch, 'dd MMMM yyyy', new Date()), 'yyyy-MM-dd');
                    return inv.paymentBatch === formattedSelectedBatch;
                } catch (e) {
                    return false;
                }
            }));
            return commissionMatch && batchMatch;
        });
    }, [invoices, selectedCommissions, selectedBatches]);


    const groupedByCommission = useMemo(() => {
        const groups: { [key: string]: { total: number; items: any[] } } = {};

        filteredInvoices.forEach(inv => {
            if (!inv.commissionNumber) return;
            if (!groups[inv.commissionNumber]) {
                groups[inv.commissionNumber] = { total: 0, items: [] };
            }
            inv.lineItems.forEach(item => {
                groups[inv.commissionNumber].total += item.exclusiveAmount;
                groups[inv.commissionNumber].items.push({
                    ...item,
                    invoiceId: inv.id, // Important for editing
                    supplier: inv.supplier,
                    invoiceDate: inv.date,
                    invoiceNumber: inv.invoiceNumber,
                    paymentBatch: inv.paymentBatch,
                    expenseType: inv.expenseType,
                });
            });
        });
        
        Object.values(groups).forEach(group => {
            group.items.sort((a, b) => new Date(a.invoiceDate.split('/').reverse().join('-')).getTime() - new Date(b.invoiceDate.split('/').reverse().join('-')).getTime());
        });

        return Object.entries(groups)
            .map(([commission, data]) => ({ commission, ...data }))
            .sort((a,b) => a.commission.localeCompare(b.commission));

    }, [filteredInvoices]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    const handleEditClick = (invoiceId: string) => {
        const invoiceToEdit = invoices.find(inv => inv.id === invoiceId);
        if (invoiceToEdit) {
            setEditingInvoice(invoiceToEdit);
        }
    };
    
    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, data);
            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };


    const handleExport = () => {
        if (!groupedByCommission.length) return;

        const dataToExport = groupedByCommission.flatMap(group => 
            group.items.map((item: any) => {
                let account;
                switch(item.expenseType) {
                    case 'S38': account = s38ChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    case 'S39': account = s39ChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    case 'CAP': account = capChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    default: account = allAccounts.find(acc => acc.accountNumber === item.accountId);
                }
                return {
                    'Commission Number': group.commission,
                    'Supplier': item.supplier,
                    'Invoice Date': item.invoiceDate,
                    'Invoice Number': item.invoiceNumber,
                    'Ledger Description': item.ledgerDescription || item.description,
                    'Account Code': item.accountId || 'N/A',
                    'Account Name': account ? account.description : 'N/A',
                    'Payment Batch': item.paymentBatch ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : 'N/A',
                    'Exclusive Amount': item.exclusiveAmount,
                    'Expense Type': item.expenseType,
                };
            })
        );
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 50 },
            { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 15 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Cost Report`);
        const commissionTitle = selectedCommissions.length > 0 ? selectedCommissions.join('_') : 'all_commissions';
        XLSX.writeFile(workbook, `Cost_Report_${commissionTitle}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Cost Report</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Filter Report</CardTitle>
                    <CardDescription>
                        Select multiple commission numbers and payment batches to generate a detailed cost report.
                    </CardDescription>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
                        <MultiSelectFilter title="Commission Numbers" options={commissionNumbers} selectedValues={selectedCommissions} setSelectedValues={setSelectedCommissions} />
                        <MultiSelectFilter title="Payment Batches" options={paymentBatches.map(b => format(new Date(b), 'dd MMMM yyyy'))} selectedValues={selectedBatches} setSelectedValues={(values) => setSelectedBatches(values)} />
                        
                        <div className="flex flex-col justify-end">
                             <Button onClick={handleExport} disabled={groupedByCommission.length === 0} className="w-full">
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
                    ) : groupedByCommission.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {selectedCommissions.length > 0 || selectedBatches.length > 0
                                ? 'No costs found for the selected filters.'
                                : 'Select filters to generate a report.'
                            }
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {groupedByCommission.map(group => (
                                <Collapsible key={group.commission} defaultOpen>
                                    <Card>
                                         <CollapsibleTrigger asChild>
                                             <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                                                <div className="flex items-center gap-4">
                                                    <Button variant="ghost" size="icon" className="group-data-[state=open]:rotate-180">
                                                        <ChevronDown className="h-4 w-4 transition-transform"/>
                                                    </Button>
                                                    <CardTitle>{group.commission}</CardTitle>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Total Cost</p>
                                                    <p className="text-xl font-bold">{formatPrice(group.total)}</p>
                                                </div>
                                             </CardHeader>
                                         </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Supplier</TableHead>
                                                            <TableHead>Invoice Date</TableHead>
                                                            <TableHead>Description</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {group.items.map((item, index) => (
                                                            <TableRow key={index} className="cursor-pointer" onClick={() => handleEditClick(item.invoiceId)}>
                                                                <TableCell className="font-medium">{item.supplier}</TableCell>
                                                                <TableCell>{item.invoiceDate}</TableCell>
                                                                <TableCell>{item.ledgerDescription || item.description}</TableCell>
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
