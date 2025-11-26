
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);
const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

type GroupedLineItem = ExtractedInvoice['lineItems'][0] & {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    supplier: string;
    fileUrl: string;
    commissionNumber?: string;
    paymentBatch?: string;
};

export default function CostLedgerPage() {
    const [lineItems, setLineItems] = useState<GroupedLineItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBatchedInvoices = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'extractedInvoices'), where('status', 'in', ['batched_for_payment', 'paid']));
                const querySnapshot = await getDocs(q);
                
                const allItems: GroupedLineItem[] = [];
                querySnapshot.forEach(doc => {
                    const invoice = { id: doc.id, ...doc.data() } as ExtractedInvoice;
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
                            });
                        }
                    });
                });

                setLineItems(allItems);
            } catch (error) {
                console.error("Error fetching batched invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBatchedInvoices();
    }, []);

    const groupedByAccount = useMemo(() => {
        const groups: { [key: string]: { account: any; items: GroupedLineItem[]; total: number; } } = {};

        lineItems.forEach(item => {
            if (!item.accountId) return;

            if (!groups[item.accountId]) {
                const accountDetails = allAccounts.find(acc => acc.accountNumber === item.accountId);
                groups[item.accountId] = {
                    account: accountDetails || { accountNumber: item.accountId, description: 'Unknown Account' },
                    items: [],
                    total: 0,
                };
            }
            groups[item.accountId].items.push(item);
            groups[item.accountId].total += item.exclusiveAmount;
        });

        return Object.values(groups).sort((a, b) => a.account.accountNumber.localeCompare(b.account.accountNumber));
    }, [lineItems]);

    const handleExportAll = () => {
        const dataToExport = groupedByAccount.flatMap(group => 
            group.items.map(item => ({
                'Account Number': group.account.accountNumber,
                'Account Description': group.account.description,
                'Invoice Date': item.invoiceDate,
                'Supplier': item.supplier,
                'Invoice Number': item.invoiceNumber,
                'Line Description': item.description,
                'Commission Number': item.commissionNumber || 'N/A',
                'Payment Batch': item.paymentBatch ? format(new Date(item.paymentBatch), 'dd MMM yyyy') : 'N/A',
                'Amount (Excl. VAT)': item.exclusiveAmount,
                'VAT Amount': item.vatAmount,
                'Line Total': item.exclusiveAmount + item.vatAmount,
                'File URL': item.fileUrl,
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 20 },
            { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
            { wch: 15 }, { wch: 60 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Ledger');
        XLSX.writeFile(workbook, `Cost_Ledger_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Cost Ledger</h1>
                <Button onClick={handleExportAll} disabled={isLoading || lineItems.length === 0}>
                    Export All to Excel
                </Button>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : groupedByAccount.length === 0 ? (
                <Card>
                    <CardContent className="py-10">
                        <p className="text-center text-muted-foreground">No batched transactions found.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {groupedByAccount.map(({ account, items, total }) => (
                        <Collapsible key={account.accountNumber}>
                            <Card>
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                                        <div className="flex items-center gap-4">
                                            <Button variant="ghost" size="icon" className="group-data-[state=open]:rotate-180">
                                                <ChevronDown className="h-4 w-4 transition-transform"/>
                                            </Button>
                                            <div>
                                                <CardTitle>{account.description}</CardTitle>
                                                <CardDescription>Account: {account.accountNumber}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Total</p>
                                            <p className="text-xl font-bold">{formatPrice(total)}</p>
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
                                                {items.map((item, index) => (
                                                    <TableRow key={`${item.invoiceId}-${index}`}>
                                                        <TableCell>{item.invoiceDate}</TableCell>
                                                        <TableCell>{item.supplier}</TableCell>
                                                        <TableCell>{item.description}</TableCell>
                                                        <TableCell>{item.commissionNumber || 'N/A'}</TableCell>
                                                        <TableCell>
                                                            {item.paymentBatch ? (
                                                                <Badge variant="outline">{format(new Date(item.paymentBatch), 'dd MMM yyyy')}</Badge>
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
        </div>
    );
}

