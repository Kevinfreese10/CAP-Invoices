
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Settings, PlusCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { getFirestore, collection, query, getDocs, doc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Task } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import ClientForm from '@/components/admin/ClientForm';
import { useAuth } from '@/contexts/AuthContext';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

export default function NumeraPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { user: currentUser } = useAuth();

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "numeraClients"));
            const querySnapshot = await getDocs(q);
            const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
            setClients(fetchedClients);
        } catch (error) {
            console.error("Error fetching Numera clients:", error);
            toast({
                title: 'Error',
                description: 'Could not fetch Numera clients.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchClients();
    }, []);

    const handleFormSubmit = async (data: any) => {
        if (!currentUser) return;
        
        const clientData: Partial<User> = {
            name: data.name,
            companyName: data.name,
            yearEnd: data.yearEnd,
            isVatRegistered: data.isVatRegistered,
            role: 'client',
            source: 'Numera',
            hasNumeraProfile: true, 
            chartOfAccounts: initialChartOfAccounts,
            allocationRules: initialAllocationRules,
            importedTransactions: [],
            allocatedTransactions: [],
        };

        try {
            const newDocRef = await addDoc(collection(db, "numeraClients"), clientData);
            toast({ title: 'Client Created', description: 'The new client has been added to Numera.'});
            fetchClients();
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error creating Numera client:", error);
            toast({ title: 'Error', description: 'Could not create the new client.', variant: 'destructive'});
        }
    };

    const handleDelete = async (clientId: string) => {
        try {
            const clientRef = doc(db, "numeraClients", clientId);
            await deleteDoc(clientRef);
            
            toast({
                title: 'Client Deleted',
                description: `The Numera client has been removed.`,
                variant: 'destructive',
            });
            fetchClients();
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({ title: 'Error', description: 'Could not delete Numera client.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
                <div className="flex items-center gap-2">
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                       <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Client
                            </Button>
                       </DialogTrigger>
                       <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Create New Numera Client</DialogTitle>
                                <DialogDescription>
                                    Add a new client to the Numera Accounting module.
                                </DialogDescription>
                            </DialogHeader>
                            <ClientForm 
                                client={null} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isNumeraClient={true}
                            />
                       </DialogContent>
                    </Dialog>
                    <Button variant="outline" asChild>
                        <Link href="/admin/numera/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Link>
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Numera Client Profiles</CardTitle>
                    <CardDescription>
                        The following clients have active accounting profiles in the Numera module.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            <p>No clients have been set up in Numera yet.</p>
                            <Button variant="secondary" className="mt-4" onClick={() => setIsFormOpen(true)}>Create Your First Client</Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead>Year End</TableHead>
                                    <TableHead>VAT Registered</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map(client => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.companyName || client.name}</TableCell>
                                        <TableCell>{client.yearEnd || 'N/A'}</TableCell>
                                        <TableCell>{client.isVatRegistered ? 'Yes' : 'No'}</TableCell>
                                        <TableCell className="text-right">
                                             <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/admin/numera/${client.id}/dashboard`}>
                                                        View Profile <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                 <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the client and all associated data for <span className="font-semibold">{client.name}</span> from Numera.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(client.id)}>
                                                                Yes, Delete Client
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
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
