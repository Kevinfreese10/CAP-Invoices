'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { 
    Loader2, 
    Eye, 
    CheckCircle, 
    Hourglass, 
    AlertTriangle, 
    FileCheck2, 
    XCircle, 
    Database, 
    Search, 
    Filter, 
    Calendar,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    CheckCircle2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const db = getFirestore(firebaseApp);

export default function ProcessedInvoicesPage() {
    const [allInvoices, setAllInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [batchFilter, setBatchFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                const invoicesSnapshot = await getDocs(collection(db, 'extractedInvoices'));
                const fetchedInvoices = invoicesSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                } as ExtractedInvoice));

                // Sort newest first by created date
                fetchedInvoices.sort((a, b) => {
                    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                    return timeB - timeA;
                });

                setAllInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching processed invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvoices();
    }, []);

    // Extract available batch options from invoices
    const availableBatches = useMemo(() => {
        const batches = new Set<string>();
        allInvoices.forEach(inv => {
            if (inv.paymentBatch) {
                batches.add(inv.paymentBatch);
            }
        });
        return Array.from(batches).sort((a, b) => {
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            if (isNaN(dateA) || isNaN(dateB)) return a.localeCompare(b);
            return dateB - dateA;
        });
    }, [allInvoices]);

    // Summary statistics
    const stats = useMemo(() => {
        const total = allInvoices.length;
        const inReview = allInvoices.filter(i => 
            ['pending_review', 'approved', 'pending_account_review', 'pending_third_review', 'approved_for_payment'].includes(i.status)
        ).length;
        const batchedOrPaid = allInvoices.filter(i => ['batched_for_payment', 'paid'].includes(i.status)).length;
        const rejected = allInvoices.filter(i => ['rejected', 'duplicate'].includes(i.status)).length;
        const totalValue = allInvoices.reduce((sum, inv) => sum + (Number(inv.invoiceTotal) || 0), 0);

        return { total, inReview, batchedOrPaid, rejected, totalValue };
    }, [allInvoices]);

    // Filter invoices by search term, status, and batch
    const filteredInvoices = useMemo(() => {
        return allInvoices.filter(invoice => {
            const supplier = (invoice.supplier || '').toLowerCase();
            const invoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
            const commissionNumber = (invoice.commissionNumber || '').toLowerCase();
            const search = searchTerm.toLowerCase().trim();

            const matchesSearch = !search || 
                supplier.includes(search) || 
                invoiceNumber.includes(search) ||
                commissionNumber.includes(search);

            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === '1st_review' && invoice.status === 'pending_review') ||
                (statusFilter === '2nd_review' && (invoice.status === 'approved' || invoice.status === 'pending_account_review')) ||
                (statusFilter === '3rd_review' && invoice.status === 'pending_third_review') ||
                (statusFilter === 'payment_control' && invoice.status === 'approved_for_payment') ||
                (statusFilter === 'batched' && invoice.status === 'batched_for_payment') ||
                (statusFilter === 'paid' && invoice.status === 'paid') ||
                (statusFilter === 'rejected' && invoice.status === 'rejected') ||
                (statusFilter === 'duplicate' && invoice.status === 'duplicate') ||
                invoice.status === statusFilter;

            const matchesBatch = batchFilter === 'all' || 
                (batchFilter === 'unallocated' && !invoice.paymentBatch) ||
                invoice.paymentBatch === batchFilter;

            return matchesSearch && matchesStatus && matchesBatch;
        });
    }, [allInvoices, searchTerm, statusFilter, batchFilter]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, batchFilter, pageSize]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredInvoices.slice(start, start + pageSize);
    }, [filteredInvoices, currentPage, pageSize]);

    const getInvoiceStatusBadge = (status: ExtractedInvoice['status']) => {
        switch(status) {
            case 'pending_review': 
                return (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 whitespace-nowrap">
                        <Hourglass className="mr-1 h-3 w-3" />1st Review
                    </Badge>
                );
            case 'approved':
            case 'pending_account_review': 
                return (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 whitespace-nowrap">
                        <Hourglass className="mr-1 h-3 w-3" />2nd Review (Account)
                    </Badge>
                );
            case 'pending_third_review': 
                return (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 whitespace-nowrap">
                        <Hourglass className="mr-1 h-3 w-3" />3rd Review (Final)
                    </Badge>
                );
            case 'approved_for_payment': 
                return (
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/30 whitespace-nowrap">
                        <FileCheck2 className="mr-1 h-3 w-3" />Payment Control Sheet
                    </Badge>
                );
            case 'batched_for_payment': 
                return (
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30 whitespace-nowrap">
                        <FileCheck2 className="mr-1 h-3 w-3" />Batched for Payment
                    </Badge>
                );
            case 'paid': 
                return (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 whitespace-nowrap">
                        <CheckCircle className="mr-1 h-3 w-3" />Paid
                    </Badge>
                );
            case 'rejected': 
                return (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 whitespace-nowrap">
                        <XCircle className="mr-1 h-3 w-3" />Rejected
                    </Badge>
                );
            case 'duplicate': 
                return (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 whitespace-nowrap">
                        <AlertTriangle className="mr-1 h-3 w-3" />Duplicate
                    </Badge>
                );
            case 'archived':
                return <Badge variant="secondary" className="whitespace-nowrap">Archived</Badge>;
            default: 
                return <Badge variant="outline" className="whitespace-nowrap">{status ? String(status).replace(/_/g, ' ') : 'Unknown'}</Badge>;
        }
    };
    
    const formatPrice = (price: any) => {
        const num = typeof price === 'number' ? price : parseFloat(price) || 0;
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(num);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Database className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Processed Invoices</h1>
                        <p className="text-sm text-muted-foreground">Search and track all supplier invoices across every stage of the review and payment pipeline.</p>
                    </div>
                </div>
            </div>

            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs">Total Invoices</CardDescription>
                        <CardTitle className="text-2xl font-bold">{stats.total}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground font-mono">{formatPrice(stats.totalValue)}</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs text-amber-600">In Review Process</CardDescription>
                        <CardTitle className="text-2xl font-bold text-amber-600">{stats.inReview}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">1st, 2nd, 3rd Review &amp; Control</p>
                    </CardContent>
                </Card>

                <Card className="bg-teal-500/5 border-teal-500/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs text-teal-600">Batched / Paid</CardDescription>
                        <CardTitle className="text-2xl font-bold text-teal-600">{stats.batchedOrPaid}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Ready for or released to bank</p>
                    </CardContent>
                </Card>

                <Card className="bg-rose-500/5 border-rose-500/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs text-rose-600">Rejected / Duplicates</CardDescription>
                        <CardTitle className="text-2xl font-bold text-rose-600">{stats.rejected}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Declined or flagged items</p>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="text-xl">Invoice Directory</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Loading invoice records...' : `Showing ${filteredInvoices.length} of ${allInvoices.length} total invoice(s).`}
                            </CardDescription>
                        </div>
                        
                        {/* Search and Filters */}
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search supplier, invoice #, comm #..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-44 h-9">
                                    <SelectValue placeholder="All Stages" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Stages</SelectItem>
                                    <SelectItem value="1st_review">1st Review</SelectItem>
                                    <SelectItem value="2nd_review">2nd Review (Account)</SelectItem>
                                    <SelectItem value="3rd_review">3rd Review</SelectItem>
                                    <SelectItem value="payment_control">Payment Control</SelectItem>
                                    <SelectItem value="batched">Batched for Payment</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="duplicate">Duplicate</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={batchFilter} onValueChange={setBatchFilter}>
                                <SelectTrigger className="w-full md:w-48 h-9">
                                    <SelectValue placeholder="All Batches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Payment Batches</SelectItem>
                                    <SelectItem value="unallocated">Unallocated (No Batch)</SelectItem>
                                    {availableBatches.map(batch => (
                                        <SelectItem key={batch} value={batch}>
                                            {batch === 'private' ? 'Private Payment' : !isNaN(new Date(batch).getTime()) ? format(parseISO(batch), 'dd MMM yyyy') : batch}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading all processed invoices...</p>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground space-y-2">
                            <Database className="h-10 w-10 mx-auto text-muted-foreground/40" />
                            <p className="font-medium">No invoices found</p>
                            <p className="text-xs">
                                {allInvoices.length > 0 
                                    ? 'No invoices match your current search or filter criteria.' 
                                    : 'There are no invoices recorded in the system yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="font-semibold">Supplier</TableHead>
                                        <TableHead className="font-semibold">Invoice #</TableHead>
                                        <TableHead className="font-semibold">Commission / Type</TableHead>
                                        <TableHead className="font-semibold">Review / Process Status</TableHead>
                                        <TableHead className="font-semibold">Payment Batch</TableHead>
                                        <TableHead className="font-semibold">Invoice Date</TableHead>
                                        <TableHead className="font-semibold text-right">Total (ZAR)</TableHead>
                                        <TableHead className="font-semibold text-right">Invoice</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedInvoices.map((invoice) => (
                                        <TableRow key={invoice.id} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">
                                                <div>
                                                    <p className="font-semibold text-sm">{invoice.supplier || 'Unknown Supplier'}</p>
                                                    {invoice.note && (
                                                        <p className="text-xs text-muted-foreground italic truncate max-w-xs" title={invoice.note}>
                                                            Note: {invoice.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {invoice.invoiceNumber || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {invoice.commissionNumber && (
                                                        <Badge variant="outline" className="text-xs font-mono font-normal">
                                                            {invoice.commissionNumber}
                                                        </Badge>
                                                    )}
                                                    {invoice.expenseType && (
                                                        <Badge variant="secondary" className="text-xs font-mono font-medium">
                                                            {invoice.expenseType}
                                                        </Badge>
                                                    )}
                                                    {!invoice.commissionNumber && !invoice.expenseType && (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getInvoiceStatusBadge(invoice.status)}
                                            </TableCell>
                                            <TableCell>
                                                {invoice.paymentBatch ? (
                                                    invoice.paymentBatch === 'private' ? (
                                                        <Badge variant="secondary" className="whitespace-nowrap">Private</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="font-mono text-xs whitespace-nowrap bg-background">
                                                            <Calendar className="mr-1 h-3 w-3 opacity-60 inline" />
                                                            {!isNaN(new Date(invoice.paymentBatch).getTime()) 
                                                                ? format(parseISO(invoice.paymentBatch), 'dd MMM yyyy') 
                                                                : invoice.paymentBatch.replace(/_/g, ' ')}
                                                        </Badge>
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">Unallocated</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {invoice.date || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold text-sm whitespace-nowrap">
                                                {formatPrice(invoice.invoiceTotal)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {invoice.fileUrl ? (
                                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                                                        <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer" title="View PDF">
                                                            <Eye className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination Footer */}
                    {!isLoading && filteredInvoices.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t text-sm text-muted-foreground bg-muted/10">
                            <div className="flex items-center gap-2">
                                <span>Rows per page:</span>
                                <Select 
                                    value={String(pageSize)} 
                                    onValueChange={(val) => setPageSize(Number(val))}
                                >
                                    <SelectTrigger className="h-8 w-18">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="250">250</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="ml-2 text-xs">
                                    Showing {Math.min((currentPage - 1) * pageSize + 1, filteredInvoices.length)} - {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs">Page {currentPage} of {totalPages}</span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
