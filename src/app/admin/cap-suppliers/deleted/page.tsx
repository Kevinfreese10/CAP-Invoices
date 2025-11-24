
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, ArchiveRestore, Trash2, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExtractedInvoice, User as AppUser } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const db = getFirestore(firebaseApp);

export default function DeletedInvoicesPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const usersQuery = query(collection(db, "users"));
            const usersSnapshot = await getDocs(usersQuery);
            const fetchedUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppUser));
            setUsers(fetchedUsers);
            
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'archived'), orderBy('deletedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching deleted invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch deleted invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);
    
    const handleRestore = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'pending_review', deletedBy: null, deletedAt: null });
            toast({ title: 'Invoice Restored', description: 'The invoice has been moved back to the review queue.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not restore the invoice.', variant: 'destructive'});
        }
    };
    
    const handleDeletePermanently = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted Permanently', description: 'The invoice has been permanently removed.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice permanently.', variant: 'destructive'});
        }
    }
    
    const getDeletedByName = (userId?: string) => {
        if (!userId) return 'Unknown';
        const user = users.find(u => u.uid === userId);
        return user ? user.name : 'Unknown User';
    }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Deleted Invoices</h1>
      <Card>
        <CardHeader>
          <CardTitle>Deleted Submissions</CardTitle>
          <CardDescription>
            These invoices have been deleted from the active workflow. They can be restored to the review queue or deleted permanently.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No deleted invoices.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Deleted At</TableHead>
                            <TableHead>Deleted By</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                <TableCell>{invoice.invoiceNumber}</TableCell>
                                <TableCell className="text-muted-foreground">
                                    {invoice.deletedAt?.toDate ? new Date(invoice.deletedAt.toDate()).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                 <TableCell className="text-muted-foreground">
                                    {getDeletedByName(invoice.deletedBy)}
                                </TableCell>
                                <TableCell className="text-right font-mono">R {invoice.invoiceTotal.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                     <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleRestore(invoice.id)}>
                                                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore to Review
                                                </DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action is permanent and cannot be undone. This will permanently delete the invoice for {invoice.supplier}.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeletePermanently(invoice.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
