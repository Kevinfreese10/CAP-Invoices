'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import {
    Loader2,
    BookOpen,
    Download,
    CheckSquare,
    Square,
    Search,
    FileSpreadsheet,
    Layers,
    ArrowUpRight,
    ArrowDownLeft,
    Tag,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter, isValid, parse } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Papa from 'papaparse';

const db = getFirestore(firebaseApp);

export interface JournalRow {
    id: string;
    invoiceId: string;
    paymentBatch: string;
    expenseType: string;
    date: string; // DD/MM/YYYY
    rawDate: Date;
    effect: 'Debit' | 'Credit';
    recipientName: string;
    reference: string;
    description: string;
    vatType: string;
    amountExcl: number;
    vatAmount: number;
    amountIncl: number;
    affectingAccountNumber: string;
    isPaye?: boolean;
}

export interface BatchGroup {
    batchId: string; // e.g. "CAP_2026-09-18"
    batchDate: string; // e.g. "2026-09-18"
    expenseType: 'CAP' | 'S39' | 'GO' | 'S38';
    batchDateLabel: string;
    invoicesCount: number;
    totalAmount: number;
    totalPaye: number;
    invoices: ExtractedInvoice[];
}

export default function JournalsPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [activeExpenseTab, setActiveExpenseTab] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [effectFilter, setEffectFilter] = useState<'ALL' | 'Credit' | 'Debit'>('ALL');
    const { toast } = useToast();

    // Fetch all batched/processed invoices with a paymentBatch assigned
    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'extractedInvoices'),
                where('status', 'in', ['batched_for_payment', 'processed'])
            );
            const querySnapshot = await getDocs(q);
            const fetched = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice))
                .filter(inv => !!inv.paymentBatch);

            setInvoices(fetched);
        } catch (error) {
            console.error('Error fetching invoices for journals:', error);
            toast({
                title: 'Error',
                description: 'Failed to load invoices for journals.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    // Safe number helper
    const toNum = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const clean = String(val).replace(/[^0-9.-]+/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // Parse date from various formats
    const parseInvoiceDate = (dateStr?: any, fallbackDate: Date = new Date()): Date => {
        if (!dateStr) return fallbackDate;
        if (dateStr instanceof Date && isValid(dateStr)) return dateStr;
        if (dateStr?.toDate && typeof dateStr.toDate === 'function') return dateStr.toDate();

        const s = String(dateStr).trim();
        let parsed = parseISO(s);
        if (isValid(parsed)) return parsed;

        parsed = parse(s, 'dd/MM/yyyy', new Date());
        if (isValid(parsed)) return parsed;

        parsed = parse(s, 'dd-MM-yyyy', new Date());
        if (isValid(parsed)) return parsed;

        parsed = parse(s, 'yyyy/MM/dd', new Date());
        if (isValid(parsed)) return parsed;

        const direct = new Date(s);
        if (isValid(direct)) return direct;

        return fallbackDate;
    };

    // Group available batches separated by Expense Type and Batch Date
    const allBatchGroups = useMemo(() => {
        const groups: { [key: string]: BatchGroup } = {};

        invoices.forEach(inv => {
            const rawExpenseType = (inv.expenseType as 'CAP' | 'S39' | 'GO' | 'S38') || 'CAP';
            const rawBatchDate = inv.paymentBatch || 'Unassigned';
            const batchId = `${rawExpenseType}_${rawBatchDate}`;

            if (!groups[batchId]) {
                let label = rawBatchDate;
                try {
                    const parsed = parseISO(rawBatchDate);
                    if (isValid(parsed)) {
                        label = format(parsed, 'dd MMMM yyyy');
                    }
                } catch {
                    label = rawBatchDate;
                }

                groups[batchId] = {
                    batchId,
                    batchDate: rawBatchDate,
                    expenseType: rawExpenseType,
                    batchDateLabel: label,
                    invoicesCount: 0,
                    totalAmount: 0,
                    totalPaye: 0,
                    invoices: [],
                };
            }

            groups[batchId].invoicesCount += 1;
            groups[batchId].invoices.push(inv);

            // Calculate invoice total & paye
            (inv.lineItems || []).forEach(item => {
                const excl = toNum(item.exclusiveAmount);
                const vat = toNum(item.vatAmount);
                const total = excl + vat;
                const paye = item.paye ? total * 0.25 : 0;
                groups[batchId].totalAmount += total;
                groups[batchId].totalPaye += paye;
            });
        });

        return Object.values(groups).sort((a, b) => b.batchDate.localeCompare(a.batchDate));
    }, [invoices]);

    // Filter batch groups according to the active Expense Type Tab
    const visibleBatchGroups = useMemo(() => {
        if (activeExpenseTab === 'ALL') {
            return allBatchGroups;
        }
        return allBatchGroups.filter(g => g.expenseType === activeExpenseTab);
    }, [allBatchGroups, activeExpenseTab]);

    // Automatically select the most recent batch for the active tab if none selected
    useEffect(() => {
        if (visibleBatchGroups.length > 0 && selectedBatchIds.length === 0) {
            setSelectedBatchIds([visibleBatchGroups[0].batchId]);
        }
    }, [visibleBatchGroups, selectedBatchIds.length]);

    // Handle switching tabs
    const handleTabChange = (newTab: string) => {
        setActiveExpenseTab(newTab);
        const groupsForTab = newTab === 'ALL'
            ? allBatchGroups
            : allBatchGroups.filter(g => g.expenseType === newTab);
        if (groupsForTab.length > 0) {
            setSelectedBatchIds([groupsForTab[0].batchId]);
        } else {
            setSelectedBatchIds([]);
        }
    };

    // Toggle single batch
    const handleToggleBatch = (batchId: string) => {
        setSelectedBatchIds(prev =>
            prev.includes(batchId) ? prev.filter(k => k !== batchId) : [...prev, batchId]
        );
    };

    // Select all visible batches
    const handleSelectAllVisibleBatches = () => {
        const visibleIds = visibleBatchGroups.map(b => b.batchId);
        const allVisibleSelected = visibleIds.every(id => selectedBatchIds.includes(id));

        if (allVisibleSelected) {
            setSelectedBatchIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedBatchIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // Generate Journal Rows based on selected batches
    const generatedJournalRows = useMemo(() => {
        const rows: JournalRow[] = [];
        if (selectedBatchIds.length === 0) return rows;

        const selectedGroups = allBatchGroups.filter(g => selectedBatchIds.includes(g.batchId));

        selectedGroups.forEach(group => {
            const batchDate = parseInvoiceDate(group.batchDate, new Date());
            const periodStart = startOfMonth(batchDate);
            const periodEnd = endOfMonth(batchDate);

            group.invoices.forEach(inv => {
                const rawInvDate = parseInvoiceDate(inv.date, batchDate);
                let clampedDate = rawInvDate;
                if (isBefore(clampedDate, periodStart)) {
                    clampedDate = periodStart;
                } else if (isAfter(clampedDate, periodEnd)) {
                    clampedDate = periodEnd;
                }

                const formattedDate = format(clampedDate, 'dd/MM/yyyy');
                const supplierName = inv.supplier || 'Unknown Supplier';

                const lineItems = (inv.lineItems && inv.lineItems.length > 0)
                    ? inv.lineItems
                    : [{
                        description: inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : 'Invoice',
                        exclusiveAmount: toNum(inv.invoiceTotal),
                        vatAmount: 0,
                        accountId: inv.expenseType || 'CAP',
                        paye: false,
                        ledgerDescription: inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : 'Invoice',
                    }];

                lineItems.forEach((item, itemIdx) => {
                    const excl = toNum(item.exclusiveAmount);
                    const vat = toNum(item.vatAmount);
                    const incl = excl + vat;
                    const vatType = vat > 0 ? 'Standard-rated purchases (15%)' : 'No VAT';

                    const refDesc = (item.ledgerDescription || item.description || inv.invoiceNumber || 'Purchase').trim();
                    const accountNum = item.accountId || '';

                    // 1. Credit Row (Increases supplier liability / Expense)
                    rows.push({
                        id: `${inv.id}-credit-${itemIdx}`,
                        invoiceId: inv.id,
                        paymentBatch: group.batchDate,
                        expenseType: group.expenseType,
                        date: formattedDate,
                        rawDate: clampedDate,
                        effect: 'Credit',
                        recipientName: supplierName,
                        reference: refDesc,
                        description: refDesc,
                        vatType: vatType,
                        amountExcl: excl,
                        vatAmount: vat,
                        amountIncl: incl,
                        affectingAccountNumber: accountNum,
                        isPaye: false,
                    });

                    // 2. Debit Row (Decreases supplier liability for PAYE deduction)
                    if (item.paye) {
                        const payeAmount = incl * 0.25;
                        if (payeAmount > 0) {
                            rows.push({
                                id: `${inv.id}-debit-paye-${itemIdx}`,
                                invoiceId: inv.id,
                                paymentBatch: group.batchDate,
                                expenseType: group.expenseType,
                                date: formattedDate,
                                rawDate: clampedDate,
                                effect: 'Debit',
                                recipientName: supplierName,
                                reference: refDesc,
                                description: refDesc,
                                vatType: 'No VAT',
                                amountExcl: payeAmount,
                                vatAmount: 0,
                                amountIncl: payeAmount,
                                affectingAccountNumber: '9500-007',
                                isPaye: true,
                            });
                        }
                    }
                });
            });
        });

        return rows;
    }, [allBatchGroups, selectedBatchIds]);

    // Filter rows for search query and effect filter
    const filteredRows = useMemo(() => {
        return generatedJournalRows.filter(row => {
            if (effectFilter !== 'ALL' && row.effect !== effectFilter) {
                return false;
            }
            if (!searchQuery) return true;
            const queryLower = searchQuery.toLowerCase();
            return (
                row.recipientName.toLowerCase().includes(queryLower) ||
                row.reference.toLowerCase().includes(queryLower) ||
                row.description.toLowerCase().includes(queryLower) ||
                row.affectingAccountNumber.toLowerCase().includes(queryLower) ||
                row.expenseType.toLowerCase().includes(queryLower) ||
                row.vatType.toLowerCase().includes(queryLower)
            );
        });
    }, [generatedJournalRows, effectFilter, searchQuery]);

    // Metrics calculations
    const metrics = useMemo(() => {
        let totalCredits = 0;
        let totalDebits = 0;
        let totalExcl = 0;
        let totalVat = 0;

        generatedJournalRows.forEach(row => {
            if (row.effect === 'Credit') {
                totalCredits += row.amountIncl;
                totalExcl += row.amountExcl;
                totalVat += row.vatAmount;
            } else {
                totalDebits += row.amountIncl;
            }
        });

        const netPayable = totalCredits - totalDebits;

        return {
            totalRows: generatedJournalRows.length,
            totalCredits,
            totalDebits,
            netPayable,
            totalExcl,
            totalVat,
        };
    }, [generatedJournalRows]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
        }).format(price);
    };

    const getExpenseTypeBadge = (type: string) => {
        switch (type) {
            case 'CAP':
                return <Badge variant="default" className="bg-blue-600 hover:bg-blue-600/90 text-white text-[11px] font-bold">CAP</Badge>;
            case 'S39':
                return <Badge variant="default" className="bg-purple-600 hover:bg-purple-600/90 text-white text-[11px] font-bold">S39</Badge>;
            case 'GO':
                return <Badge variant="default" className="bg-amber-600 hover:bg-amber-600/90 text-white text-[11px] font-bold">GO</Badge>;
            case 'S38':
                return <Badge variant="secondary" className="bg-slate-600 hover:bg-slate-600/90 text-white text-[11px] font-bold">S38</Badge>;
            default:
                return <Badge variant="outline" className="text-[11px] font-bold">{type}</Badge>;
        }
    };

    // Export CSV matching exact template:
    // Date (DD/MM/YYYY),Effect (Debit/Credit),Recipient Name,Reference,Description,VAT Type,Amount (Excl),VAT Amount,Amount (Incl),Affecting Account Number
    const handleDownloadCSV = () => {
        if (generatedJournalRows.length === 0) {
            toast({
                title: 'No Data to Export',
                description: 'Please select at least one batch with invoice records.',
                variant: 'destructive',
            });
            return;
        }

        const csvData = generatedJournalRows.map(row => ({
            'Date (DD/MM/YYYY)': row.date,
            'Effect (Debit/Credit)': row.effect,
            'Recipient Name': row.recipientName,
            'Reference': row.reference,
            'Description': row.description,
            'VAT Type': row.vatType,
            'Amount (Excl)': row.amountExcl.toFixed(2),
            'VAT Amount': row.vatAmount.toFixed(2),
            'Amount (Incl)': row.amountIncl.toFixed(2),
            'Affecting Account Number': row.affectingAccountNumber,
        }));

        const csvString = Papa.unparse(csvData, {
            quotes: false,
            header: true,
        });

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const selectedExpenseTypes = Array.from(new Set(generatedJournalRows.map(r => r.expenseType))).join('_');
        const fileName = `Supplier_Journal_${selectedExpenseTypes || 'All'}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Journal CSV Exported',
            description: `Successfully exported ${generatedJournalRows.length} rows to ${fileName}`,
        });
    };

    const isAllVisibleSelected = visibleBatchGroups.length > 0 && visibleBatchGroups.every(g => selectedBatchIds.includes(g.batchId));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-primary" />
                        Supplier Journals
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Generate and export accounting journals separated by Expense Type (CAP, S39, GO) and Payment Batches.
                    </p>
                </div>
                <Button
                    onClick={handleDownloadCSV}
                    disabled={generatedJournalRows.length === 0}
                    className="gap-2 shadow-sm"
                    size="lg"
                >
                    <Download className="h-4 w-4" />
                    Download Excel CSV ({generatedJournalRows.length})
                </Button>
            </div>

            {/* Batch Selector Card */}
            <Card className="border-border">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Layers className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Select Payment Batches</CardTitle>
                            <Badge variant="secondary" className="font-semibold">
                                {selectedBatchIds.length} Selected
                            </Badge>
                        </div>

                        {/* Expense Type Tabs */}
                        <Tabs value={activeExpenseTab} onValueChange={handleTabChange} className="w-auto">
                            <TabsList className="grid grid-cols-5 h-9 bg-muted/70 p-1">
                                <TabsTrigger value="ALL" className="text-xs font-semibold px-3">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="CAP" className="text-xs font-semibold px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                    CAP
                                </TabsTrigger>
                                <TabsTrigger value="S39" className="text-xs font-semibold px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                                    S39
                                </TabsTrigger>
                                <TabsTrigger value="GO" className="text-xs font-semibold px-3 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                                    GO
                                </TabsTrigger>
                                <TabsTrigger value="S38" className="text-xs font-semibold px-3 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                                    S38
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <CardDescription>
                            Showing batches for {activeExpenseTab === 'ALL' ? 'all expense types' : activeExpenseTab}. Select one or more batches to combine into a journal.
                        </CardDescription>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllVisibleBatches}
                            className="gap-1.5 h-8 text-xs shrink-0"
                            disabled={visibleBatchGroups.length === 0}
                        >
                            {isAllVisibleSelected ? (
                                <>
                                    <Square className="h-3.5 w-3.5" /> Deselect Visible
                                </>
                            ) : (
                                <>
                                    <CheckSquare className="h-3.5 w-3.5" /> Select All Visible
                                </>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                            <span className="text-sm text-muted-foreground">Loading payment batches...</span>
                        </div>
                    ) : visibleBatchGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            No batches found for {activeExpenseTab === 'ALL' ? 'the selected filter' : activeExpenseTab}.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-1">
                            {visibleBatchGroups.map(group => {
                                const isSelected = selectedBatchIds.includes(group.batchId);
                                return (
                                    <div
                                        key={group.batchId}
                                        onClick={() => handleToggleBatch(group.batchId)}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                                                : 'border-border/60 hover:border-border hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}} // Controlled by outer div click
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1.5 mb-1">
                                                {getExpenseTypeBadge(group.expenseType)}
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {group.invoicesCount} inv
                                                </span>
                                            </div>
                                            <p className="font-semibold text-sm truncate text-foreground">
                                                {group.batchDateLabel}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                                <span>Net:</span>
                                                <span className="font-mono font-medium text-foreground">
                                                    {formatPrice(group.totalAmount - group.totalPaye)}
                                                </span>
                                            </div>
                                            {group.totalPaye > 0 && (
                                                <p className="text-[11px] text-destructive/80 font-mono mt-0.5">
                                                    PAYE: {formatPrice(group.totalPaye)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">Total Journal Rows</CardDescription>
                        <CardTitle className="text-2xl font-bold">{metrics.totalRows}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">
                            {selectedBatchIds.length} batch(es) selected
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs uppercase font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Total Credits (Gross)
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatPrice(metrics.totalCredits)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">
                            Excl: {formatPrice(metrics.totalExcl)} | VAT: {formatPrice(metrics.totalVat)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs uppercase font-semibold flex items-center gap-1 text-destructive">
                            <ArrowDownLeft className="h-3.5 w-3.5" /> Total Debits (PAYE)
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold font-mono text-destructive">
                            {formatPrice(metrics.totalDebits)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">
                            Allocated to Account 9500-007
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs uppercase font-semibold text-primary">
                            Net Payable Amount
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold font-mono text-primary">
                            {formatPrice(metrics.netPayable)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">
                            Credits minus PAYE debits
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Preview Table Card */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                Journal Entries Preview
                            </CardTitle>
                            <CardDescription>
                                Exact 10-column layout for Excel CSV export matching Sage import template.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search supplier, ref, acc..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>
                            <div className="flex items-center border rounded-md p-1 bg-muted/40">
                                <Button
                                    variant={effectFilter === 'ALL' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setEffectFilter('ALL')}
                                    className="h-7 text-xs px-2.5"
                                >
                                    All ({generatedJournalRows.length})
                                </Button>
                                <Button
                                    variant={effectFilter === 'Credit' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setEffectFilter('Credit')}
                                    className="h-7 text-xs px-2.5"
                                >
                                    Credits
                                </Button>
                                <Button
                                    variant={effectFilter === 'Debit' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setEffectFilter('Debit')}
                                    className="h-7 text-xs px-2.5 text-destructive"
                                >
                                    Debits (PAYE)
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[110px] font-semibold">Date (DD/MM/YYYY)</TableHead>
                                    <TableHead className="w-[80px] font-semibold">Type</TableHead>
                                    <TableHead className="w-[90px] font-semibold">Effect</TableHead>
                                    <TableHead className="font-semibold">Recipient Name</TableHead>
                                    <TableHead className="font-semibold">Reference</TableHead>
                                    <TableHead className="font-semibold">Description</TableHead>
                                    <TableHead className="font-semibold">VAT Type</TableHead>
                                    <TableHead className="text-right font-semibold">Amount (Excl)</TableHead>
                                    <TableHead className="text-right font-semibold">VAT Amount</TableHead>
                                    <TableHead className="text-right font-semibold">Amount (Incl)</TableHead>
                                    <TableHead className="font-semibold">Affecting Account</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                                            {selectedBatchIds.length === 0
                                                ? 'Please select at least one batch above to generate journal entries.'
                                                : searchQuery
                                                ? 'No journal rows match your search query.'
                                                : 'No invoices found for the selected batch(es).'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRows.map(row => (
                                        <TableRow key={row.id} className="text-xs hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-mono">{row.date}</TableCell>
                                            <TableCell>{getExpenseTypeBadge(row.expenseType)}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        row.effect === 'Credit'
                                                            ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                                                            : 'border-destructive text-destructive bg-destructive/10'
                                                    }
                                                >
                                                    {row.effect}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium max-w-[160px] truncate" title={row.recipientName}>
                                                {row.recipientName}
                                            </TableCell>
                                            <TableCell className="font-mono max-w-[140px] truncate" title={row.reference}>
                                                {row.reference}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate" title={row.description}>
                                                {row.description}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-muted-foreground">
                                                {row.vatType}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {row.amountExcl.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {row.vatAmount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold">
                                                {row.amountIncl.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {row.affectingAccountNumber || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
