
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Settings, PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { getFirestore, collection, query, getDocs, doc, deleteDoc, addDoc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Task, ImportedTransaction, AllocationRule } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import ClientForm from '@/components/admin/ClientForm';
import { useAuth } from '@/contexts/AuthContext';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

export default function AIAccountantPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const { user: currentUser } = useAuth();

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "aiAccountantClients"));
            const querySnapshot = await getDocs(q);
            const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
            setClients(fetchedClients);
        } catch (error) {
            console.error("Error fetching AI Accountant clients:", error);
            toast({
                title: 'Error',
                description: 'Could not fetch AI Accountant clients.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchClients();
    }, []);
    
    const handleAdd = () => {
        setSelectedClient(null);
        setIsFormOpen(true);
    };

    const handleEdit = (client: Client) => {
        setSelectedClient(client);
        setIsFormOpen(true);
    };

    const handleFormSubmit = async (data: any) => {
        if (!currentUser) return;
        
        const clientData: Partial<User> = {
            name: data.name,
            companyName: data.name,
            yearEnd: data.yearEnd,
            isVatRegistered: data.isVatRegistered,
            role: 'client',
            source: 'AI Accountant',
            hasNumeraProfile: true, 
        };
        
        const isNewClient = !selectedClient;

        if (isNewClient) {
            try {
                const rulesQuery = query(collection(db, 'allocationRules'), orderBy('description'));
                const rulesSnapshot = await getDocs(rulesQuery);
                const globalRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));

                clientData.chartOfAccounts = initialChartOfAccounts;
                clientData.allocationRules = globalRules;
                clientData.importedTransactions = [];
                clientData.allocatedTransactions = [];
            } catch (error) {
                toast({ title: 'Error', description: 'Could not fetch global allocation rules for new client.', variant: 'destructive'});
                return; // Stop client creation if rules can't be fetched
            }
        }

        try {
            if (selectedClient?.id) {
                await setDoc(doc(db, "aiAccountantClients", selectedClient.id), clientData, { merge: true });
                toast({ title: 'Client Updated' });
            } else {
                const newDocRef = await addDoc(collection(db, "aiAccountantClients"), clientData);
                toast({ title: 'Client Created', description: 'The new client has been added to AI Accountant.'});
            }

            fetchClients();
            setIsFormOpen(false);
            setSelectedClient(null);
        } catch (error) {
            console.error("Error creating AI Accountant client:", error);
            toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
        }
    };

    const handleDelete = async (clientId: string) => {
        try {
            const batch = writeBatch(db);

            // Delete all transactions in the subcollection first
            const transactionsRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
            const transactionsSnapshot = await getDocs(transactionsRef);
            transactionsSnapshot.forEach((transactionDoc) => {
                batch.delete(transactionDoc.ref);
            });

            // Then delete the main client document
            const clientRef = doc(db, "aiAccountantClients", clientId);
            batch.delete(clientRef);
            
            await batch.commit();
            
            toast({
                title: 'Client Deleted',
                description: `The AI Accountant client and all their data have been removed.`,
                variant: 'destructive',
            });
            fetchClients();
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({ title: 'Error', description: 'Could not delete AI Accountant client.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">AI Accountant</h1>
                <div className="flex items-center gap-2">
                    <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setSelectedClient(null); }}>
                       <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Client
                            </Button>
                       </DialogTrigger>
                       <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{selectedClient ? 'Edit' : 'Create New'} AI Accountant Client</DialogTitle>
                                <DialogDescription>
                                    Add a new client to the AI Accountant module.
                                </DialogDescription>
                            </DialogHeader>
                            <ClientForm 
                                client={selectedClient} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isAIClient={true}
                            />
                       </DialogContent>
                    </Dialog>
                    <Button variant="outline" asChild>
                        <Link href="/admin/ai-accountant/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Link>
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>AI Accountant Client Profiles</CardTitle>
                    <CardDescription>
                        The following clients have active accounting profiles in the AI Accountant module.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            <p>No clients have been set up in AI Accountant yet.</p>
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
                                                    <Link href={`/admin/ai-accountant/${client.id}/dashboard`}>
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
                                                            <DropdownMenuItem onSelect={() => handleEdit(client)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Client
                                                            </DropdownMenuItem>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the client and all associated data for <span className="font-semibold">{client.name}</span> from AI Accountant.
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
