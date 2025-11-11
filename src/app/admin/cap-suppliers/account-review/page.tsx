
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, FileCheck2, Eye, Edit, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExtractedInvoice } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';


const db = getFirestore(firebaseApp);
const allAccounts = [...capChartOfAccounts, ...s38ChartOfAccounts];

export default function AccountReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'pending_account_review'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices for account review:", error);
            toast({ title: 'Error', description: 'Could not fetch invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleApproveSelected = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: 'No Invoices Selected', description: 'Please select invoices to approve.', variant: 'destructive' });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'pending_third_review' });
            });
            await batch.commit();
            toast({ title: 'Invoices Approved', description: `${selectedInvoices.length} invoice(s) have been moved to 3rd Review.` });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve invoices.', variant: 'destructive'});
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

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(invoices.map(inv => inv.id));
        } else {
            setSelectedInvoices([]);
        }
    }
    
    const handleToggleSelectOne = (invoiceId: string) => {
        setSelectedInvoices(prev =>
            prev.includes(invoiceId)
                ? prev.filter(id => id !== invoiceId)
                : [...prev, invoiceId]
        );
    };

    const getAccountDescription = (accountId?: string) => {
        if (!accountId) return 'N/A';
        const account = allAccounts.find(acc => acc.accountNumber === accountId);
        return account ? account.description : 'Unknown Account';
    }
    
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Account Review</h1>
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button disabled={selectedInvoices.length === 0}>
                    <FileCheck2 className="mr-2 h-4 w-4"/>
                    Approve ({selectedInvoices.length}) for 3rd Review
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will approve {selectedInvoices.length} invoice(s) and move them to the 3rd Review step.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApproveSelected}>
                        Yes, Approve
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
      
       {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : invoices.length === 0 ? (
             <Card>
                <CardContent className="py-10">
                    <p className="text-center text-muted-foreground">No invoices are pending account review.</p>
                </CardContent>
            </Card>
        ) : (
            <div className="space-y-4">
                 <div className="flex items-center gap-2 p-2 border rounded-md">
                    <Checkbox
                        id="select-all"
                        onCheckedChange={handleSelectAll}
                        checked={selectedInvoices.length > 0 && selectedInvoices.length === invoices.length}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium">
                        Select All Invoices
                    </label>
                 </div>
                 {invoices.map(invoice => (
                    <Card key={invoice.id}>
                        <CardHeader className="bg-muted/50">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                     <Checkbox
                                        checked={selectedInvoices.includes(invoice.id)}
                                        onCheckedChange={() => handleToggleSelectOne(invoice.id)}
                                    />
                                    <div>
                                        <CardTitle>{invoice.supplier}</CardTitle>
                                        <CardDescription>Invoice #: {invoice.invoiceNumber}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Button asChild variant="outline" size="icon">
                                        <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <Eye className="h-4 w-4" />
                                        </a>
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Line Description</TableHead>
                                        <TableHead>Allocated Account</TableHead>
                                        <TableHead className="text-right">Exclusive Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.lineItems.map((item, index) => (
                                        <TableRow key={`${invoice.id}-${index}`}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>{getAccountDescription(item.accountId)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(item.exclusiveAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                 ))}
            </div>
        )}
      
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

    