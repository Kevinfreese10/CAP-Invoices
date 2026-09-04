'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Check, ChevronsUpDown, ChevronDown, Download, Calculator, Banknote, Filter, X, ArrowRight, Layers, Hash, FileSpreadsheet } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ExtractedInvoice, Commission } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const db = getFirestore(firebaseApp);
const allAccounts = [...s38ChartOfAccounts, ...capChartOfAccounts, ...s39ChartOfAccounts];

interface CommissionFilterProps {
    options: string[];
    commissionsMap: Record<string, Commission>;
    selectedValues: string[];
    setSelectedValues: (values: string[]) => void;
}

function CommissionMultiSelect({ options, commissionsMap, selectedValues, setSelectedValues }: CommissionFilterProps) {
    const [open, setOpen] = useState(false);
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    // Natural sort commission options numerically if possible
    const sortedOptions = useMemo(() => {
        return [...options].sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });
    }, [options]);

    const handleApplyRange = (mode: 'replace' | 'add' = 'replace') => {
        if (!rangeFrom.trim() || !rangeTo.trim()) {
            toast({ title: 'Range Incomplete', description: 'Please enter both From and To commission numbers.', variant: 'destructive' });
            return;
        }

        const fromClean = rangeFrom.trim();
        const toClean = rangeTo.trim();

        const numFrom = parseInt(fromClean.replace(/\D/g, ''), 10);
        const numTo = parseInt(toClean.replace(/\D/g, ''), 10);

        let matched: string[] = [];

        if (!isNaN(numFrom) && !isNaN(numTo)) {
            const min = Math.min(numFrom, numTo);
            const max = Math.max(numFrom, numTo);

            matched = sortedOptions.filter(opt => {
                const optNum = parseInt(opt.replace(/\D/g, ''), 10);
                if (!isNaN(optNum)) {
                    return optNum >= min && optNum <= max;
                }
                return false;
            });
        } else {
            // Lexicographical fallback
            const min = fromClean < toClean ? fromClean : toClean;
            const max = fromClean < toClean ? toClean : fromClean;
            matched = sortedOptions.filter(opt => opt >= min && opt <= max);
        }

        if (matched.length === 0) {
            toast({ title: 'No Commissions Found', description: `No available commissions matched the range ${fromClean} to ${toClean}.`, variant: 'default' });
            return;
        }

        if (mode === 'replace') {
            setSelectedValues(matched);
        } else {
            const merged = Array.from(new Set([...selectedValues, ...matched]));
            setSelectedValues(merged);
        }

        toast({ title: 'Range Applied', description: `Selected ${matched.length} commission numbers in range.` });
        setOpen(false);
    };

    const isAllSelected = sortedOptions.length > 0 && selectedValues.length === sortedOptions.length;

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return sortedOptions;
        const q = searchQuery.toLowerCase().trim();
        return sortedOptions.filter(opt => {
            const comm = commissionsMap[opt];
            const nameMatch = comm?.shortName?.toLowerCase().includes(q) || comm?.storyName?.toLowerCase().includes(q);
            return opt.toLowerCase().includes(q) || nameMatch;
        });
    }, [sortedOptions, searchQuery, commissionsMap]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Commission Numbers</p>
                {selectedValues.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelectedValues([])}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                        <X className="h-3 w-3" /> Clear ({selectedValues.length})
                    </button>
                )}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 px-3 bg-background"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">
                                {selectedValues.length === 0
                                    ? "Select commission number(s) or range..."
                                    : selectedValues.length === 1
                                    ? `Commission #${selectedValues[0]}${commissionsMap[selectedValues[0]]?.shortName ? ` (${commissionsMap[selectedValues[0]].shortName})` : ''}`
                                    : `${selectedValues.length} Commissions Selected`}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] sm:w-[420px] p-0" align="start">
                    <Tabs defaultValue="range" className="w-full">
                        <div className="border-b px-3 pt-2">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="range" className="text-xs">Quick Range</TabsTrigger>
                                <TabsTrigger value="list" className="text-xs">Individual Select</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* TAB 1: RANGE SELECTION */}
                        <TabsContent value="range" className="p-4 space-y-4 m-0">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">Select Numeric Range</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Enter two commission numbers (e.g. 6911 to 6932). All numbers in between will be selected.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 items-center">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">From Commission #</label>
                                    <Input
                                        placeholder="e.g. 6911"
                                        value={rangeFrom}
                                        onChange={(e) => setRangeFrom(e.target.value)}
                                        className="h-8 text-xs font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">To Commission #</label>
                                    <Input
                                        placeholder="e.g. 6932"
                                        value={rangeTo}
                                        onChange={(e) => setRangeTo(e.target.value)}
                                        className="h-8 text-xs font-mono"
                                    />
                                </div>
                            </div>

                            {/* Quick helper shortcuts from sorted options */}
                            {sortedOptions.length > 0 && (
                                <div className="text-[11px] text-muted-foreground flex items-center justify-between bg-muted/40 p-2 rounded border">
                                    <span>Available Range:</span>
                                    <span className="font-mono font-medium text-foreground">
                                        {sortedOptions[0]} &rarr; {sortedOptions[sortedOptions.length - 1]}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    size="sm"
                                    className="flex-1 text-xs h-8"
                                    onClick={() => handleApplyRange('replace')}
                                >
                                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                                    Apply Range
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => handleApplyRange('add')}
                                >
                                    Add to Selection
                                </Button>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between text-xs pt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        setSelectedValues(sortedOptions);
                                        toast({ title: 'All Selected', description: `Selected all ${sortedOptions.length} commissions.` });
                                        setOpen(false);
                                    }}
                                >
                                    Select All ({sortedOptions.length})
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                    onClick={() => {
                                        setSelectedValues([]);
                                        setRangeFrom('');
                                        setRangeTo('');
                                    }}
                                >
                                    Clear Selection
                                </Button>
                            </div>
                        </TabsContent>

                        {/* TAB 2: INDIVIDUAL LIST SELECTION */}
                        <TabsContent value="list" className="p-0 m-0">
                            <div className="p-2 border-b">
                                <Input
                                    placeholder="Search commission # or story name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b text-[11px]">
                                <span className="text-muted-foreground">{filteredOptions.length} available</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isAllSelected) {
                                                setSelectedValues([]);
                                            } else {
                                                setSelectedValues(sortedOptions);
                                            }
                                        }}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        {isAllSelected ? "Deselect All" : "Select All"}
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                                {filteredOptions.length === 0 ? (
                                    <p className="text-xs text-center py-6 text-muted-foreground">No commissions found.</p>
                                ) : (
                                    filteredOptions.map((option) => {
                                        const isChecked = selectedValues.includes(option);
                                        const comm = commissionsMap[option];
                                        return (
                                            <div
                                                key={option}
                                                onClick={() => {
                                                    const newSelected = isChecked
                                                        ? selectedValues.filter((v) => v !== option)
                                                        : [...selectedValues, option];
                                                    setSelectedValues(newSelected);
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between px-3 py-1.5 rounded text-xs cursor-pointer select-none transition-colors",
                                                    isChecked ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => {}} // Handled by container click to prevent jump/double-fire
                                                        className="pointer-events-none"
                                                    />
                                                    <span className="font-mono">{option}</span>
                                                    {comm?.shortName && (
                                                        <span className="text-muted-foreground truncate text-[11px]">
                                                            - {comm.shortName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </PopoverContent>
            </Popover>
        </div>
    );
}

function PaymentBatchFilter({ title, options, selectedValues, setSelectedValues }: { title: string, options: string[], selectedValues: string[], setSelectedValues: (values: string[]) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{title}</p>
                {selectedValues.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelectedValues([])}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                        <X className="h-3 w-3" /> Clear ({selectedValues.length})
                    </button>
                )}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 px-3 bg-background"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Banknote className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">
                                {selectedValues.length === 0
                                    ? `All Payment Batches`
                                    : selectedValues.length === 1
                                    ? selectedValues[0]
                                    : `${selectedValues.length} Batches Selected`}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={`Search ${title.toLowerCase()}...`} />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <div className="p-1 border-b flex justify-between items-center text-xs px-2 py-1.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedValues(options)}
                                    className="text-primary hover:underline"
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedValues([])}
                                    className="text-muted-foreground hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                            {options.map((option) => {
                                const isChecked = selectedValues.includes(option);
                                return (
                                    <div
                                        key={option}
                                        onClick={() => {
                                            const newSelected = isChecked
                                                ? selectedValues.filter((v) => v !== option)
                                                : [...selectedValues, option];
                                            setSelectedValues(newSelected);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded text-xs cursor-pointer select-none transition-colors",
                                            isChecked ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                                        )}
                                    >
                                        <Checkbox checked={isChecked} className="pointer-events-none" />
                                        <span>{option}</span>
                                    </div>
                                );
                            })}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default function CostReportPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [commissionsMap, setCommissionsMap] = useState<Record<string, Commission>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch strictly invoices that are in a payment batch or already paid
            const q = query(
                collection(db, 'extractedInvoices'), 
                where('status', 'in', ['batched_for_payment', 'paid'])
            );
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);

            // 2. Fetch commissions metadata for short names / titles
            try {
                const commsQuery = query(collection(db, 'commissions'));
                const commsSnapshot = await getDocs(commsQuery);
                const map: Record<string, Commission> = {};
                commsSnapshot.docs.forEach(d => {
                    const c = d.data() as Commission;
                    if (c.commissionNumber) {
                        map[c.commissionNumber] = c;
                    }
                });
                setCommissionsMap(map);
            } catch (err) {
                console.warn("Could not load commissions collection metadata:", err);
            }
        } catch (error) {
            console.error("Error fetching invoices for cost report:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const { commissionNumbers, paymentBatches } = useMemo(() => {
        const commissions = new Set(invoices.map(inv => inv.commissionNumber).filter((c): c is string => !!c));
        const batches = new Set(invoices.map(inv => inv.paymentBatch).filter((b): b is string => !!b));
        
        // Natural sort commissions numerically
        const sortedComms = Array.from(commissions).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });

        return {
            commissionNumbers: sortedComms,
            paymentBatches: Array.from(batches)
                .filter(b => b && !isNaN(new Date(b).getTime()))
                .sort((a,b) => new Date(b).getTime() - new Date(a).getTime()),
        };
    }, [invoices]);
    
    const filteredInvoices = useMemo(() => {
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

    const toNum = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const clean = String(val).replace(/[^0-9.-]+/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // Per-Commission Breakdown calculation
    const perCommissionBreakdown = useMemo(() => {
        const map: Record<string, {
            commissionNumber: string;
            shortName: string;
            invoiceCount: number;
            exclusiveAmount: number;
            vatAmount: number;
            inclusiveAmount: number;
        }> = {};

        // Pre-populate for all selected commissions
        selectedCommissions.forEach(commNum => {
            map[commNum] = {
                commissionNumber: commNum,
                shortName: commissionsMap[commNum]?.shortName || commissionsMap[commNum]?.storyName || '',
                invoiceCount: 0,
                exclusiveAmount: 0,
                vatAmount: 0,
                inclusiveAmount: 0,
            };
        });

        filteredInvoices.forEach(inv => {
            const commNum = inv.commissionNumber;
            if (!commNum || !map[commNum]) return;
            map[commNum].invoiceCount += 1;
            inv.lineItems?.forEach(item => {
                const excl = toNum(item.exclusiveAmount);
                const vat = toNum(item.vatAmount);
                map[commNum].exclusiveAmount += excl;
                map[commNum].vatAmount += vat;
                map[commNum].inclusiveAmount += (excl + vat);
            });
        });

        return Object.values(map).sort((a, b) => {
            const numA = parseInt(a.commissionNumber.replace(/\D/g, ''), 10);
            const numB = parseInt(b.commissionNumber.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.commissionNumber.localeCompare(b.commissionNumber);
        });
    }, [filteredInvoices, selectedCommissions, commissionsMap]);

    const groupedBySupplier = useMemo(() => {
        const groups: { [key: string]: { totalInclusive: number; totalExclusive: number; items: any[] } } = {};

        filteredInvoices.forEach(inv => {
            const supplierName = inv.supplier;
            if (!groups[supplierName]) {
                groups[supplierName] = { totalInclusive: 0, totalExclusive: 0, items: [] };
            }
            inv.lineItems?.forEach(item => {
                const excl = toNum(item.exclusiveAmount);
                const vat = toNum(item.vatAmount);
                groups[supplierName].totalExclusive += excl;
                groups[supplierName].totalInclusive += (excl + vat);
                groups[supplierName].items.push({
                    ...item,
                    exclusiveAmount: excl,
                    vatAmount: vat,
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
                const [dayA, monthA, yearA] = (a.invoiceDate || '').split('/').map(Number);
                const [dayB, monthB, yearB] = (b.invoiceDate || '').split('/').map(Number);
                const dateA = new Date(yearA || 2026, (monthA || 1) - 1, dayA || 1);
                const dateB = new Date(yearB || 2026, (monthB || 1) - 1, dayB || 1);
                return dateA.getTime() - dateB.getTime();
            });
        });

        return Object.entries(groups)
            .map(([supplier, data]) => ({ supplier, ...data }))
            .sort((a,b) => a.supplier.localeCompare(b.supplier));

    }, [filteredInvoices]);

    const reportTotals = useMemo(() => {
        return filteredInvoices.reduce((acc, inv) => {
            inv.lineItems?.forEach(item => {
                const excl = toNum(item.exclusiveAmount);
                const vat = toNum(item.vatAmount);
                acc.exclusive += excl;
                acc.vat += vat;
                acc.inclusive += (excl + vat);
            });
            return acc;
        }, { exclusive: 0, vat: 0, inclusive: 0 });
    }, [filteredInvoices]);

    const formatPrice = (price: any) => {
        const num = toNum(price);
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(num);
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
            fetchData();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };

    // Export specifically the Report Summary in Excel
    const handleExportSummaryOnly = () => {
        if (!perCommissionBreakdown.length) return;

        const workbook = XLSX.utils.book_new();

        const summarySheetData = perCommissionBreakdown.map(item => ({
            'Commission Number': item.commissionNumber,
            'Story / Short Name': item.shortName || 'N/A',
            'Invoices Count': item.invoiceCount,
            'Total Exclusive Cost (ZAR)': item.exclusiveAmount,
            'Total VAT (ZAR)': item.vatAmount,
            'Total Inclusive (ZAR)': item.inclusiveAmount,
        }));

        // Add Grand Total row to summary sheet
        summarySheetData.push({
            'Commission Number': `GRAND TOTAL (${selectedCommissions.length} Commissions)`,
            'Story / Short Name': '',
            'Invoices Count': filteredInvoices.length,
            'Total Exclusive Cost (ZAR)': reportTotals.exclusive,
            'Total VAT (ZAR)': reportTotals.vat,
            'Total Inclusive (ZAR)': reportTotals.inclusive,
        });

        const summaryWorksheet = XLSX.utils.json_to_sheet(summarySheetData);
        summaryWorksheet['!cols'] = [
            { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 24 }
        ];
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Report Summary');

        const commTitle = selectedCommissions.length === 1 
            ? selectedCommissions[0] 
            : selectedCommissions.length <= 4 
            ? selectedCommissions.join('_') 
            : `${selectedCommissions[0]}_to_${selectedCommissions[selectedCommissions.length - 1]}_(${selectedCommissions.length}_commissions)`;

        XLSX.writeFile(workbook, `Report_Summary_Comm_${commTitle}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast({ title: 'Summary Exported', description: 'Report Summary exported to Excel successfully.' });
    };

    // Full Report Export (Summary sheet + Consolidated Line Items sheet)
    const handleExport = () => {
        if (!groupedBySupplier.length) return;

        const workbook = XLSX.utils.book_new();

        // 1. Per Commission Summary Sheet
        const summarySheetData = perCommissionBreakdown.map(item => ({
            'Commission Number': item.commissionNumber,
            'Story / Short Name': item.shortName || 'N/A',
            'Invoices Count': item.invoiceCount,
            'Total Exclusive Cost (ZAR)': item.exclusiveAmount,
            'Total VAT (ZAR)': item.vatAmount,
            'Total Inclusive (ZAR)': item.inclusiveAmount,
        }));
        // Add Grand Total row to summary sheet
        summarySheetData.push({
            'Commission Number': `GRAND TOTAL (${selectedCommissions.length} Commissions)`,
            'Story / Short Name': '',
            'Invoices Count': filteredInvoices.length,
            'Total Exclusive Cost (ZAR)': reportTotals.exclusive,
            'Total VAT (ZAR)': reportTotals.vat,
            'Total Inclusive (ZAR)': reportTotals.inclusive,
        });

        const summaryWorksheet = XLSX.utils.json_to_sheet(summarySheetData);
        summaryWorksheet['!cols'] = [
            { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 24 }
        ];
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Commissions Summary');

        // 2. Full Itemized Costs Sheet
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
                    'Story Name': commissionsMap[item.commissionNumber]?.shortName || 'N/A',
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
            { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 50 },
            { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Supplier Costs');

        const commTitle = selectedCommissions.length === 1 
            ? selectedCommissions[0] 
            : selectedCommissions.length <= 4 
            ? selectedCommissions.join('_') 
            : `${selectedCommissions[0]}_to_${selectedCommissions[selectedCommissions.length - 1]}_(${selectedCommissions.length}_commissions)`;

        XLSX.writeFile(workbook, `Cost_Report_Comm_${commTitle}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast({ title: 'Full Report Exported', description: 'Full report exported to Excel successfully.' });
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cost Report</h1>
                    <p className="text-muted-foreground text-sm">Consolidated supplier expenses by commission number and payment batch.</p>
                </div>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        Filter Report
                    </CardTitle>
                    <CardDescription>
                        Select individual commission numbers or specify a numeric range (e.g. 6911 to 6932) to generate consolidated totals.
                    </CardDescription>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 items-end">
                        <div className="md:col-span-2">
                            <CommissionMultiSelect
                                options={commissionNumbers}
                                commissionsMap={commissionsMap}
                                selectedValues={selectedCommissions}
                                setSelectedValues={setSelectedCommissions}
                            />
                        </div>

                        <div>
                            <PaymentBatchFilter
                                title="Payment Batches"
                                options={paymentBatches.map(b => format(new Date(b), 'dd MMMM yyyy'))}
                                selectedValues={selectedBatches}
                                setSelectedValues={setSelectedBatches}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleExport}
                                disabled={groupedBySupplier.length === 0}
                                className="flex-1 h-10 shadow-sm text-xs"
                            >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Full Report (Excel)
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleExportSummaryOnly}
                                disabled={selectedCommissions.length === 0}
                                className="h-10 shadow-sm text-xs bg-background"
                                title="Download Report Summary Only in Excel"
                            >
                                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                                Summary
                            </Button>
                        </div>
                    </div>

                    {/* Active Selected Badges */}
                    {selectedCommissions.length > 0 && (
                        <div className="pt-3 flex flex-wrap items-center gap-1.5 border-t mt-4">
                            <span className="text-xs font-semibold text-muted-foreground mr-1">
                                Active Commissions ({selectedCommissions.length}):
                            </span>
                            {selectedCommissions.slice(0, 15).map(val => (
                                <Badge
                                    key={val}
                                    variant="secondary"
                                    className="text-xs font-mono font-normal pl-2 pr-1 py-0.5 flex items-center gap-1"
                                >
                                    <span>{val}</span>
                                    {commissionsMap[val]?.shortName && (
                                        <span className="text-muted-foreground text-[10px]">({commissionsMap[val].shortName})</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCommissions(selectedCommissions.filter(c => c !== val))}
                                        className="hover:text-destructive p-0.5 rounded-full"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {selectedCommissions.length > 15 && (
                                <Badge variant="outline" className="text-xs">
                                    +{selectedCommissions.length - 15} more
                                </Badge>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : groupedBySupplier.length === 0 ? (
                        <div className="text-center py-14 border-2 border-dashed rounded-lg bg-muted/20">
                            <Calculator className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                            <h3 className="mt-4 text-lg font-medium">No Data to Display</h3>
                            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
                                {selectedCommissions.length === 0 
                                    ? "Please select one or more commission numbers or a range above to view consolidated costs."
                                    : "No batched or paid costs found matching the selected commission and payment batch filters."
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* ENHANCED REPORT SUMMARY */}
                            <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
                                <CardHeader className="py-4 border-b bg-primary/10">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Calculator className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-lg">Report Summary</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Totals for the selected range and individual commission breakdown
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="bg-background text-xs font-normal h-8">
                                                {selectedCommissions.length} Commission(s) | {filteredInvoices.length} Invoices
                                            </Badge>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleExportSummaryOnly}
                                                className="h-8 text-xs bg-background shadow-xs hover:bg-muted font-medium border-primary/30"
                                            >
                                                <Download className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                                Download Summary (Excel)
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                
                                <CardContent className="p-6 space-y-6">
                                    {/* 1. Grand Totals for the Range / Selection */}
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                            <Layers className="h-4 w-4" /> Combined Range Total ({selectedCommissions.length} Commissions)
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-background p-4 rounded-lg border shadow-xs space-y-1">
                                                <p className="text-xs text-muted-foreground font-medium">Total Exclusive Cost</p>
                                                <p className="text-2xl font-bold text-primary">{formatPrice(reportTotals.exclusive)}</p>
                                            </div>
                                            <div className="bg-background p-4 rounded-lg border shadow-xs space-y-1">
                                                <p className="text-xs text-muted-foreground font-medium">Total VAT</p>
                                                <p className="text-2xl font-bold">{formatPrice(reportTotals.vat)}</p>
                                            </div>
                                            <div className="bg-background p-4 rounded-lg border shadow-xs space-y-1">
                                                <p className="text-xs text-muted-foreground font-medium">Total Inclusive (Paid to Suppliers)</p>
                                                <p className="text-2xl font-bold text-teal-600">{formatPrice(reportTotals.inclusive)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Per-Commission Breakdown Table */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Hash className="h-4 w-4" /> Per-Commission Breakdown ({perCommissionBreakdown.length})
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleExportSummaryOnly}
                                                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                            >
                                                <FileSpreadsheet className="h-3.5 w-3.5" /> Export Summary
                                            </button>
                                        </div>
                                        <div className="rounded-md border bg-background overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="h-8 font-semibold text-xs">Commission #</TableHead>
                                                        <TableHead className="h-8 font-semibold text-xs">Story / Short Name</TableHead>
                                                        <TableHead className="h-8 font-semibold text-xs text-center">Invoices</TableHead>
                                                        <TableHead className="h-8 font-semibold text-xs text-right">Exclusive Cost</TableHead>
                                                        <TableHead className="h-8 font-semibold text-xs text-right">VAT Amount</TableHead>
                                                        <TableHead className="h-8 font-semibold text-xs text-right">Total (Incl. VAT)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {perCommissionBreakdown.map((item) => (
                                                        <TableRow key={item.commissionNumber} className="text-xs hover:bg-muted/30">
                                                            <TableCell className="font-mono font-medium py-2">
                                                                <Badge variant="outline" className="font-mono text-xs">
                                                                    {item.commissionNumber}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground py-2 max-w-[200px] truncate">
                                                                {item.shortName || '—'}
                                                            </TableCell>
                                                            <TableCell className="text-center py-2">
                                                                {item.invoiceCount}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono py-2 text-muted-foreground">
                                                                {formatPrice(item.exclusiveAmount)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono py-2 text-muted-foreground">
                                                                {formatPrice(item.vatAmount)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-semibold py-2">
                                                                {formatPrice(item.inclusiveAmount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                                <TableFooter>
                                                    <TableRow className="bg-muted/60 font-semibold text-xs">
                                                        <TableCell colSpan={2} className="py-2.5">
                                                            Grand Total ({selectedCommissions.length} Commissions)
                                                        </TableCell>
                                                        <TableCell className="text-center py-2.5">
                                                            {filteredInvoices.length}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono py-2.5">
                                                            {formatPrice(reportTotals.exclusive)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono py-2.5">
                                                            {formatPrice(reportTotals.vat)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-teal-600 font-bold py-2.5">
                                                            {formatPrice(reportTotals.inclusive)}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Consolidated Supplier Cost Collapsibles */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold">Consolidated Supplier Invoices ({groupedBySupplier.length} Suppliers)</h3>
                                </div>
                                {groupedBySupplier.map(group => (
                                    <Collapsible key={group.supplier} defaultOpen>
                                        <Card className="shadow-xs">
                                             <CollapsibleTrigger asChild>
                                                 <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/40 py-3 px-4 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 group-data-[state=open]:rotate-180">
                                                            <ChevronDown className="h-4 w-4 transition-transform"/>
                                                        </Button>
                                                        <CardTitle className="text-sm font-semibold">{group.supplier}</CardTitle>
                                                        <Badge variant="secondary" className="text-[10px] h-5">
                                                            {group.items.length} line item(s)
                                                        </Badge>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid to Supplier (Incl. VAT)</p>
                                                        <p className="text-sm font-bold text-foreground">{formatPrice(group.totalInclusive)}</p>
                                                    </div>
                                                 </CardHeader>
                                             </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <CardContent className="p-0 border-t">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/30">
                                                                <TableHead className="h-8 text-xs">Date</TableHead>
                                                                <TableHead className="h-8 text-xs">Invoice #</TableHead>
                                                                <TableHead className="h-8 text-xs">Comm #</TableHead>
                                                                <TableHead className="h-8 text-xs">Batch</TableHead>
                                                                <TableHead className="h-8 text-xs">Description</TableHead>
                                                                <TableHead className="h-8 text-xs text-right">Amount (Incl. VAT)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {group.items.map((item, index) => (
                                                                <TableRow key={index} className="cursor-pointer text-xs hover:bg-muted/20" onClick={() => handleEditClick(item.invoiceId)}>
                                                                    <TableCell>{item.invoiceDate}</TableCell>
                                                                    <TableCell className="font-medium">{item.invoiceNumber}</TableCell>
                                                                    <TableCell><Badge variant="outline" className="font-mono text-[11px]">{item.commissionNumber || 'N/A'}</Badge></TableCell>
                                                                    <TableCell className="whitespace-nowrap">{item.paymentBatch ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : 'N/A'}</TableCell>
                                                                    <TableCell className="max-w-md truncate italic text-muted-foreground">{item.ledgerDescription || item.description}</TableCell>
                                                                    <TableCell className="text-right font-mono font-medium">{formatPrice(item.exclusiveAmount + item.vatAmount)}</TableCell>
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
