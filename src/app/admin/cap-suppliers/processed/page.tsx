
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Eye, CheckCircle, Hourglass, AlertTriangle, FileCheck2, XCircle, Database } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExtractedInvoice } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const db = getFirestore(firebaseApp);

export default function ProcessedInvoicesPage() {
    const [processedInvoices, setProcessedInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            try {
                const invoicesQuery = query(
                    collection(db, 'extractedInvoices'),
                    where('sourceEmailUid', '!=', null),
                    orderBy('sourceEmailUid', 'desc'),
                    orderBy('createdAt', 'desc'),
                );
                const invoicesSnapshot = await getDocs(invoicesQuery);
                const fetchedInvoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
                setProcessedInvoices(fetchedInvoices);
            } catch (error) {
                console.error("Error fetching processed invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvoices();
    }, []);

    const filteredProcessedInvoices = useMemo(() => {
        if (!searchTerm) return processedInvoices;
        const lowercasedFilter = searchTerm.toLowerCase();
        return processedInvoices.filter(invoice =>
            invoice.supplier.toLowerCase().includes(lowercasedFilter) ||
            invoice.invoiceNumber.toLowerCase().includes(lowercasedFilter)
        );
    }, [processedInvoices, searchTerm]);
    
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
    
    const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

    return (
        <div className="space-y-8">
             <div className="flex items-center gap-4">
                 <Database className="h-8 w-8 text-primary" />
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Processed Invoices</h1>
                    <p className="text-muted-foreground">A list of all invoices extracted from the inbox.</p>
                 </div>
            </div>
            
            <Card>
                <CardHeader>
                     <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>History</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Loading invoices...' : `Found ${filteredProcessedInvoices.length} processed invoice(s).`}
                            </CardDescription>
                        </div>
                         <Input 
                            placeholder="Filter by supplier or invoice #..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : filteredProcessedInvoices.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground"><p>
                            {processedInvoices.length > 0 ? 'No invoices match the current filter.' : 'No invoices have been processed from the inbox yet.'}
                        </p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Processed At</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {filteredProcessedInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                        <TableCell>{invoice.invoiceNumber}</TableCell>
                                        <TableCell>
                                            {invoice.createdAt?.toDate ? format(invoice.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            {getInvoiceStatusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="icon">
                                                <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Eye className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
