
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Settings, PlusCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Task } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import ClientForm from '@/components/admin/ClientForm'; // Re-using the client form
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
    const [allStaff, setAllStaff] = useState<User[]>([]);

    const fetchClientsAndStaff = async () => {
        setIsLoading(true);
        try {
            const staffQuery = query(collection(db, "users"), where("role", "in", ['staff', 'admin']));
            const staffSnapshot = await getDocs(staffQuery);
            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            setAllStaff(fetchedStaff);

            const q = query(collection(db, "clients"), where("hasNumeraProfile", "==", true));
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
        fetchClientsAndStaff();
    }, [toast]);

    const handleFormSubmit = async (data: any) => {
        if (!currentUser) return;
        
        const { createNumeraProfile, ...clientFormData } = data;

        const clientData = {
            ...clientFormData,
            financialsDueDate: data.financialsDueDate || null,
            managementAccountsDueDate: data.requiresManagementAccounts ? data.managementAccountsDueDate : null,
            vatCategory: data.isVatRegistered ? data.vatCategory : null,
            payrollDueDate: data.payrollDueDate || null,
            role: 'client',
            source: 'Numera',
            hasNumeraProfile: true, // Always true when created from Numera module
            chartOfAccounts: initialChartOfAccounts,
            allocationRules: initialAllocationRules,
        };

        try {
            const newDocRef = await addDoc(collection(db, "clients"), clientData);
            toast({ title: 'Client Created', description: 'The new client has been added to Numera.'});
            fetchClientsAndStaff();
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error creating Numera client:", error);
            toast({ title: 'Error', description: 'Could not create the new client.', variant: 'destructive'});
        }
    };

    const handleDelete = async (clientId: string) => {
        try {
            const batch = writeBatch(db);

            const clientRef = doc(db, "clients", clientId);
            batch.delete(clientRef);
            
            const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId));
            const tasksSnapshot = await getDocs(tasksQuery);
            tasksSnapshot.docs.forEach(taskDoc => {
                batch.delete(taskDoc.ref);
            });

            await batch.commit();
            
            toast({
                title: 'Client Deleted',
                description: `The client and their ${tasksSnapshot.size} associated tasks have been removed.`,
                variant: 'destructive',
            });
            fetchClientsAndStaff();
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({ title: 'Error', description: 'Could not delete client and their tasks.', variant: 'destructive' });
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
                       <DialogContent className="sm:max-w-2xl">
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
                                allStaff={allStaff}
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
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map(client => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.companyName || client.name}</TableCell>
                                        <TableCell>{client.contactPerson}</TableCell>
                                        <TableCell>{client.email}</TableCell>
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
                                                                This action cannot be undone. This will permanently delete the client and all associated data for <span className="font-semibold">{client.name}</span>.
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
