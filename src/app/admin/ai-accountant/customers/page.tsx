
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle } from 'lucide-react';
import { getFirestore, collection, query, getDocs, doc, deleteDoc, addDoc, writeBatch, setDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClientForm from '@/components/admin/ClientForm';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


const db = getFirestore(firebaseApp);

type ClientCustomer = {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    cellNumber?: string;
    address?: string;
    vatNumber?: string;
}

export default function ClientCustomersPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<ClientCustomer | null>(null);

    const fetchCustomers = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
            const querySnapshot = await getDocs(q);
            const fetchedCustomers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClientCustomer));
            setCustomers(fetchedCustomers);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast({
                title: 'Error',
                description: 'Could not fetch customers.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [clientId]);
    
    const handleAdd = () => {
        setSelectedCustomer(null);
        setIsFormOpen(true);
    };

    const handleEdit = (customer: ClientCustomer) => {
        setSelectedCustomer(customer);
        setIsFormOpen(true);
    };

    const handleFormSubmit = async (data: any) => {
        if (!clientId) return;

        const customerData: Partial<ClientCustomer> = {
            name: data.name,
            contactPerson: data.contactPerson,
            email: data.email,
            cellNumber: data.cellNumber,
            address: data.address,
            vatNumber: data.vatNumber,
        };

        try {
            if (selectedCustomer?.id) {
                await setDoc(doc(db, `aiAccountantClients/${clientId}/customers`, selectedCustomer.id), customerData, { merge: true });
                toast({ title: 'Customer Updated' });
            } else {
                await addDoc(collection(db, `aiAccountantClients/${clientId}/customers`), customerData);
                toast({ title: 'Customer Created' });
            }

            fetchCustomers();
            setIsFormOpen(false);
            setSelectedCustomer(null);
        } catch (error) {
            console.error("Error saving customer:", error);
            toast({ title: 'Error', description: 'Could not save the customer.', variant: 'destructive'});
        }
    };

    const handleDelete = async (customerId: string) => {
        if(!clientId) return;
        try {
            await deleteDoc(doc(db, `aiAccountantClients/${clientId}/customers`, customerId));
            toast({
                title: 'Customer Deleted',
                description: `The customer has been removed.`,
                variant: 'destructive',
            });
            fetchCustomers();
        } catch (error) {
            console.error("Error deleting customer:", error);
            toast({ title: 'Error', description: 'Could not delete customer.', variant: 'destructive' });
        }
    };


    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
                    <p className="text-muted-foreground">Manage your client's customers.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setSelectedCustomer(null); }}>
                       <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Customer
                            </Button>
                       </DialogTrigger>
                       <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{selectedCustomer ? 'Edit' : 'Create New'} Customer</DialogTitle>
                                <DialogDescription>
                                    Add a new customer for this client.
                                </DialogDescription>
                            </DialogHeader>
                             <ClientForm 
                                client={selectedCustomer} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isAIClient={true}
                            />
                       </DialogContent>
                    </Dialog>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Customer List</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            <p>No customers created for this client yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer Name</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>VAT Number</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map(customer => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">{customer.name}</TableCell>
                                        <TableCell>{customer.contactPerson || 'N/A'}</TableCell>
                                        <TableCell>{customer.email || 'N/A'}</TableCell>
                                        <TableCell>{customer.vatNumber || 'N/A'}</TableCell>
                                        <TableCell className="text-right">
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
                                                        <DropdownMenuItem onSelect={() => handleEdit(customer)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
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
                                                            This will permanently delete the customer "{customer.name}".
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(customer.id)}>
                                                            Yes, Delete
                                                        </AlertDialogAction>
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
