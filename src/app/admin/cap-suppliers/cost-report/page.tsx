
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Check, ChevronsUpDown, ChevronDown, Download, Calculator, Banknote } from 'lucide-react';
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
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Checkbox } from '@/components/ui/checkbox';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';


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
                                        const newSelected = selectedValues.includes(option)
                                            ? selectedValues.filter((v) => v !== option)
                                            : [...selectedValues, option];
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
            // Strictly only fetch invoices that are in a payment batch or already paid
            const q = query(
                collection(db, 'extractedInvoices'), 
                where('status', 'in', ['batched_for_payment', 'paid'])
            );
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
        const commissions = new Set(invoices.map(inv => inv.commissionNumber).filter((c): c is string => !!c));
        const batches = new Set(invoices.map(inv => inv.paymentBatch).filter((b): b is string => !!b));
        return {
            commissionNumbers: Array.from(commissions).sort(),
            paymentBatches: Array.from(batches)
                .filter(b => b && !isNaN(new Date(b).getTime()))
                .sort((a,b) => new Date(b).getTime() - new Date(a).getTime()),
        };
    }, [invoices]);
    
     const filteredInvoices = useMemo(() => {
        // Change: Only show data if a commission number is selected
        if (selectedCommissions.length === 0) return [];

        return invoices.filter(inv => {
            const commissionMatch = inv.commissionNumber && selectedCommissions.includes(inv.commissionNumber);
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


    const groupedBySupplier = useMemo(() => {
        const groups: { [key: string]: { totalInclusive: number; totalExclusive: number; items: any[] } } = {};

        filteredInvoices.forEach(inv => {
            const supplierName = inv.supplier;
            if (!groups[supplierName]) {
                groups[supplierName] = { totalInclusive: 0, totalExclusive: 0, items: [] };
            }
            inv.lineItems.forEach(item => {
                groups[supplierName].totalExclusive += item.exclusiveAmount;
                groups[supplierName].totalInclusive += (item.exclusiveAmount + item.vatAmount);
                groups[supplierName].items.push({
                    ...item,
                    invoiceId: inv.id,
                    supplier: inv.supplier,
                    invoiceDate: inv.date,
                    invoiceNumber: inv.invoiceNumber,
                    paymentBatch: inv.paymentBatch,
                    expenseType: inv.expenseType,
                    commissionNumber: inv.commissionNumber,
                });
            });
        });
        
        Object.values(groups).forEach(group => {
            group.items.sort((a, b) => {
                const [dayA, monthA, yearA] = a.invoiceDate.split('/').map(Number);
                const [dayB, monthB, yearB] = b.invoiceDate.split('/').map(Number);
                const dateA = new Date(yearA, monthA - 1, dayA);
                const dateB = new Date(yearB, monthB - 1, dayB);
                return dateA.getTime() - dateB.getTime();
            });
        });

        return Object.entries(groups)
            .map(([supplier, data]) => ({ supplier, ...data }))
            .sort((a,b) => a.supplier.localeCompare(b.supplier));

    }, [filteredInvoices]);

    const reportTotals = useMemo(() => {
        return filteredInvoices.reduce((acc, inv) => {
            inv.lineItems.forEach(item => {
                acc.exclusive += item.exclusiveAmount;
                acc.vat += item.vatAmount;
                acc.inclusive += (item.exclusiveAmount + item.vatAmount);
            });
            return acc;
        }, { exclusive: 0, vat: 0, inclusive: 0 });
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
        if (!groupedBySupplier.length) return;

        const dataToExport = groupedBySupplier.flatMap(group => 
            group.items.map((item: any) => {
                let account;
                switch(item.expenseType) {
                    case 'S38': account = s38ChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    case 'S39': account = s39ChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    case 'CAP': account = capChartOfAccounts.find(acc => acc.accountNumber === item.accountId); break;
                    default: account = allAccounts.find(acc => acc.accountNumber === item.accountId);
                }
                return {
                    'Supplier': group.supplier,
                    'Invoice Date': item.invoiceDate,
                    'Invoice Number': item.invoiceNumber,
                    'Commission Number': item.commissionNumber || 'N/A',
                    'Ledger Description': item.ledgerDescription || item.description,
                    'Account Code': item.accountId || 'N/A',
                    'Account Name': account ? account.description : 'N/A',
                    'Payment Batch': item.paymentBatch ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : 'N/A',
                    'Exclusive Amount': item.exclusiveAmount,
                    'VAT Amount': item.vatAmount,
                    'Total (Incl. VAT)': item.exclusiveAmount + item.vatAmount,
                    'Expense Type': item.expenseType,
                };
            })
        );
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 50 },
            { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Supplier Cost Report`);
        const commTitle = selectedCommissions.length > 0 ? selectedCommissions.join('_') : 'all_commissions';
        XLSX.writeFile(workbook, `Cost_Report_Comm_${commTitle}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Cost Report</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Filter Report</CardTitle>
                    <CardDescription>
                        Select a commission number to view its total costs consolidated by supplier.
                    </CardDescription>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
                        <MultiSelectFilter title="Commission Numbers" options={commissionNumbers} selectedValues={selectedCommissions} setSelectedValues={setSelectedCommissions} />
                        <MultiSelectFilter title="Payment Batches" options={paymentBatches.map(b => format(new Date(b), 'dd MMMM yyyy'))} selectedValues={selectedBatches} setSelectedValues={(values) => setSelectedBatches(values)} />
                        
                        <div className="flex flex-col justify-end">
                             <Button onClick={handleExport} disabled={groupedBySupplier.length === 0} className="w-full">
                                <Download className="mr-2 h-4 w-4" />
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
                    ) : groupedBySupplier.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                            <Calculator className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                            <h3 className="mt-4 text-lg font-medium">No Data to Display</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                                {selectedCommissions.length === 0 
                                    ? "Please select one or more commission numbers above to generate the cost report."
                                    : "No costs found matching the selected commission and payment batch filters."
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <Card className="bg-primary/5 border-primary/20">
                                <CardHeader className="py-4">
                                    <div className="flex items-center gap-2">
                                        <Calculator className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">Report Summary</CardTitle>
                                    </div>
                                    <CardDescription>Totals for the selected commission number(s)</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground font-medium">Total Exclusive Cost</p>
                                        <p className="text-2xl font-bold text-primary">{formatPrice(reportTotals.exclusive)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground font-medium">Total VAT</p>
                                        <p className="text-2xl font-bold">{formatPrice(reportTotals.vat)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground font-medium">Total Inclusive (Paid to Suppliers)</p>
                                        <p className="text-2xl font-bold text-teal-600">{formatPrice(reportTotals.inclusive)}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                {groupedBySupplier.map(group => (
                                    <Collapsible key={group.supplier} defaultOpen>
                                        <Card>
                                             <CollapsibleTrigger asChild>
                                                 <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 py-3 px-4">
                                                    <div className="flex items-center gap-4">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 group-data-[state=open]:rotate-180">
                                                            <ChevronDown className="h-4 w-4 transition-transform"/>
                                                        </Button>
                                                        <CardTitle className="text-md">{group.supplier}</CardTitle>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid to Supplier (Incl. VAT)</p>
                                                        <p className="text-md font-bold">{formatPrice(group.totalInclusive)}</p>
                                                    </div>
                                                 </CardHeader>
                                             </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <CardContent className="p-0 border-t">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/30">
                                                                <TableHead className="h-9">Date</TableHead>
                                                                <TableHead className="h-9">Invoice #</TableHead>
                                                                <TableHead className="h-9">Comm #</TableHead>
                                                                <TableHead className="h-9">Batch</TableHead>
                                                                <TableHead className="h-9">Description</TableHead>
                                                                <TableHead className="h-9 text-right">Amount (Incl. VAT)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {group.items.map((item, index) => (
                                                                <TableRow key={index} className="cursor-pointer text-xs" onClick={() => handleEditClick(item.invoiceId)}>
                                                                    <TableCell>{item.invoiceDate}</TableCell>
                                                                    <TableCell>{item.invoiceNumber}</TableCell>
                                                                    <TableCell><Badge variant="outline" className="font-normal">{item.commissionNumber || 'N/A'}</Badge></TableCell>
                                                                    <TableCell className="whitespace-nowrap">{item.paymentBatch ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : 'N/A'}</TableCell>
                                                                    <TableCell className="max-w-md truncate italic text-muted-foreground">{item.ledgerDescription || item.description}</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount + item.vatAmount)}</TableCell>
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
