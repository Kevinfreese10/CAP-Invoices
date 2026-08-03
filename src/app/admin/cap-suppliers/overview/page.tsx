'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Search, ChevronDown, CheckCircle, Hourglass, FileCheck2, XCircle, AlertTriangle, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const db = getFirestore(firebaseApp);

type SupplierStats = {
    supplierName: string;
    totalInvoices: number;
    pendingCount: number;
    paidCount: number;
    totalPaidAmount: number;
    invoices: ExtractedInvoice[];
};

export default function SupplierOverviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openSupplier, setOpenSupplier] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                // Fetch all invoices to build the overview
                const invoicesQuery = query(
                    collection(db, 'extractedInvoices'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(invoicesQuery);
                const fetchedInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
                setInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching invoices for overview:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvoices();
    }, []);

    const groupedData = useMemo(() => {
        const groups: Record<string, SupplierStats> = {};

        invoices.forEach(inv => {
            const supplier = inv.supplier || 'Unknown Supplier';
            if (!groups[supplier]) {
                groups[supplier] = {
                    supplierName: supplier,
                    totalInvoices: 0,
                    pendingCount: 0,
                    paidCount: 0,
                    totalPaidAmount: 0,
                    invoices: []
                };
            }

            groups[supplier].totalInvoices++;
            groups[supplier].invoices.push(inv);

            // Grouping logic for pending/paid
            if (inv.status === 'paid' || inv.status === 'archived') {
                groups[supplier].paidCount++;
                groups[supplier].totalPaidAmount += (Number(inv.invoiceTotal) || 0);
            } else if (inv.status !== 'rejected' && inv.status !== 'extraction_failed' && inv.status !== 'duplicate') {
                groups[supplier].pendingCount++;
            }
        });

        // Filter by search term
        let result = Object.values(groups);
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(g => g.supplierName.toLowerCase().includes(lowerSearch));
        }

        // Sort alphabetically
        return result.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    }, [invoices, searchTerm]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    const getInvoiceStatusBadge = (status: ExtractedInvoice['status']) => {
        switch(status) {
            case 'approved': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
            case 'approved_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Approved for Payment</Badge>;
            case 'batched_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Batched</Badge>;
            case 'paid': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
            case 'rejected': return <Badge variant={'destructive'}><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
            case 'duplicate': return <Badge variant={'destructive'}><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
            case 'pending_review': return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />Pending Review</Badge>;
            case 'pending_account_review': return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />Pending Account Review</Badge>;
            case 'pending_third_review': return <Badge variant={'third_review'}><Hourglass className="mr-1 h-3 w-3" />Pending 3rd Review</Badge>;
            default: return <Badge>{status.replace(/_/g, ' ')}</Badge>;
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Supplier Overview</h1>
                    <p className="text-muted-foreground">High-level view of all suppliers, invoice counts, and payment history.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <CardTitle>Suppliers</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Loading...' : `Found ${groupedData.length} supplier(s) across ${invoices.length} invoices.`}
                            </CardDescription>
                        </div>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search supplier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : groupedData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No suppliers found matching your search.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier Name</TableHead>
                                    <TableHead className="text-center">Total Invoices</TableHead>
                                    <TableHead className="text-center">Pending / In Progress</TableHead>
                                    <TableHead className="text-center">Paid</TableHead>
                                    <TableHead className="text-right">Total Paid Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedData.map((group) => {
                                    const isOpen = openSupplier === group.supplierName;
                                    return (
                                        <React.Fragment key={group.supplierName}>
                                            <TableRow>
                                                <TableCell className="font-medium">
                                                    <Button 
                                                        variant="ghost" 
                                                        className="p-0 hover:bg-transparent -ml-2" 
                                                        onClick={() => setOpenSupplier(isOpen ? null : group.supplierName)}
                                                    >
                                                        <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform duration-200", isOpen && "-rotate-90")} />
                                                        {group.supplierName}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-center font-mono">{group.totalInvoices}</TableCell>
                                                <TableCell className="text-center font-mono text-amber-600">{group.pendingCount}</TableCell>
                                                <TableCell className="text-center font-mono text-green-600">{group.paidCount}</TableCell>
                                                <TableCell className="text-right font-mono font-semibold">{formatPrice(group.totalPaidAmount)}</TableCell>
                                            </TableRow>
                                            
                                            {isOpen && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="p-4 bg-muted/30">
                                                            <div className="font-semibold mb-2">Invoice History for {group.supplierName}</div>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="h-8">Date</TableHead>
                                                                        <TableHead className="h-8">Invoice #</TableHead>
                                                                        <TableHead className="h-8">Status</TableHead>
                                                                        <TableHead className="h-8 text-right">Amount</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.invoices.map(invoice => (
                                                                        <TableRow key={invoice.id} className="text-xs">
                                                                            <TableCell className="py-2">{invoice.date}</TableCell>
                                                                            <TableCell className="py-2">{invoice.invoiceNumber}</TableCell>
                                                                            <TableCell className="py-2">{getInvoiceStatusBadge(invoice.status)}</TableCell>
                                                                            <TableCell className="py-2 text-right font-mono">{formatPrice(Number(invoice.invoiceTotal) || 0)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
