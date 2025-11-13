
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function CostReportPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCommission, setSelectedCommission] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                const q = query(
                    collection(db, 'extractedInvoices'), 
                    where('commissionNumber', '!=', null)
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
        fetchInvoices();
    }, []);

    const commissionNumbers = useMemo(() => {
        const numbers = new Set(invoices.map(inv => inv.commissionNumber).filter(Boolean));
        return Array.from(numbers).sort();
    }, [invoices]);

    const filteredLineItems = useMemo(() => {
        if (!selectedCommission) return [];
        
        return invoices
            .filter(inv => inv.commissionNumber === selectedCommission)
            .flatMap(inv => inv.lineItems.map(item => ({
                ...item,
                supplier: inv.supplier,
                invoiceDate: inv.date,
                invoiceNumber: inv.invoiceNumber,
            })))
            .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());
    }, [invoices, selectedCommission]);
    
    const totalCost = useMemo(() => {
        return filteredLineItems.reduce((sum, item) => sum + item.exclusiveAmount, 0);
    }, [filteredLineItems]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    const handleExport = () => {
        if (!filteredLineItems.length || !selectedCommission) return;

        const dataToExport = filteredLineItems.map(item => ({
            'Supplier': item.supplier,
            'Invoice Date': item.invoiceDate,
            'Invoice Number': item.invoiceNumber,
            'Ledger Description': item.ledgerDescription || item.description,
            'Exclusive Amount': item.exclusiveAmount,
        }));
        
        const totalRow = {
            'Supplier': 'TOTAL',
            'Invoice Date': '',
            'Invoice Number': '',
            'Ledger Description': '',
            'Exclusive Amount': totalCost,
        }
        dataToExport.push(totalRow);

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 50 }, { wch: 20 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Cost Report`);
        XLSX.writeFile(workbook, `Cost_Report_${selectedCommission}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Cost Report</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Filter by Commission Number</CardTitle>
                    <CardDescription>
                        Select a commission number to view a detailed breakdown of all associated costs.
                    </CardDescription>
                    <div className="flex gap-4 items-center pt-4">
                        <Select onValueChange={setSelectedCommission} value={selectedCommission || ''}>
                            <SelectTrigger className="w-full max-w-sm">
                                <SelectValue placeholder="Select a commission number..." />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : (
                                    commissionNumbers.map(cn => (
                                        <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleExport} disabled={!selectedCommission || filteredLineItems.length === 0}>
                            Export to Excel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : !selectedCommission ? (
                        <p className="text-center text-muted-foreground py-10">Please select a commission number to view the report.</p>
                    ) : filteredLineItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No costs found for commission number {selectedCommission}.</p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead>Invoice Date</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Ledger Description</TableHead>
                                        <TableHead className="text-right">Exclusive Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLineItems.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.supplier}</TableCell>
                                            <TableCell>{item.invoiceDate}</TableCell>
                                            <TableCell>{item.invoiceNumber}</TableCell>
                                            <TableCell>{item.ledgerDescription || item.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex justify-end font-bold text-lg p-4 border-t mt-4">
                                <div className="flex items-center gap-4">
                                    <span>Total Cost:</span>
                                    <span className="font-mono">{formatPrice(totalCost)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
