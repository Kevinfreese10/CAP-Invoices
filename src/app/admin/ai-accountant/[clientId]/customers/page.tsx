'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, FileUp, Download } from 'lucide-react';
import { getFirestore, collection, query, getDocs, doc, deleteDoc, addDoc, writeBatch, setDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { MoreHorizontal, Edit, Trash2, BookUser } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';


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

const importSchema = z.object({
  file: z.any().refine((files) => files && files.length > 0, "An Excel file is required."),
});


function ImportCustomersDialog({ clientId, onImportComplete }: { clientId: string; onImportComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const form = useForm<z.infer<typeof importSchema>>({
        resolver: zodResolver(importSchema),
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        toast({ title: "Reading file..." });

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as { 'Customer Name'?: string }[];

                const customerNames = json.map(row => row['Customer Name']).filter((name): name is string => !!name);

                if (customerNames.length === 0) {
                    toast({ title: "No customers found", description: "Make sure your Excel file has a column named 'Customer Name'.", variant: "destructive" });
                    setIsUploading(false);
                    return;
                }

                const batch = writeBatch(db);
                customerNames.forEach(name => {
                    const docRef = doc(collection(db, `aiAccountantClients/${clientId}/customers`));
                    batch.set(docRef, { name });
                });

                await batch.commit();

                toast({ title: "Import Successful", description: `${customerNames.length} customers have been imported.` });
                onImportComplete();
                setIsOpen(false);
            } catch (error) {
                console.error("Error importing customers:", error);
                toast({ title: "Import Failed", description: "An error occurred during the import.", variant: "destructive" });
            } finally {
                setIsUploading(false);
                form.reset();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadExample = () => {
        const csvContent = "Customer Name\n\"Example Customer 1\"\n\"Example Customer 2\"";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'example-customers.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> Import Customers</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Customers from Excel/CSV</DialogTitle>
                    <DialogDescription>Upload an .xlsx or .csv file with a column named "Customer Name" to bulk import customers.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                         <Label htmlFor="customer-file">Customer File</Label>
                         <Button variant="outline" size="sm" onClick={handleDownloadExample}><Download className="mr-2 h-4 w-4"/> Download Example</Button>
                    </div>
                    <Input id="customer-file" type="file" accept=".xlsx, .csv" onChange={handleFileChange} disabled={isUploading} />
                    {isUploading && <div className="flex items-center mt-2 text-muted-foreground"><Loader2 className="mr-2 animate-spin"/>Processing...</div>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ImportJournalsDialog() {
    const handleDownloadExample = () => {
        const csvContent = "Date,Description,Account,Debit,Credit\nDD/MM/YYYY,Example Entry,1000/000,100.00,\nDD/MM/YYYY,Example Entry,8000/001,,100.00";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'example-journal.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> Import Journal</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Customer Journal</DialogTitle>
                    <DialogDescription>Upload a CSV file with journal entries.</DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                         <Label htmlFor="journal-file">Journal File</Label>
                         <Button variant="outline" size="sm" onClick={handleDownloadExample}><Download className="mr-2 h-4 w-4"/> Download Example</Button>
                    </div>
                    <Input id="journal-file" type="file" accept=".csv" />
                </div>
                <DialogFooter>
                    <Button>Import</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function ClientCustomersPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<ClientCustomer | null>(null);

    const fetchCustomers = useCallback(async () => {
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
    }, [clientId, toast]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);
    
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
            </div>
            <Tabs defaultValue="list">
                <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="list">Customer List</TabsTrigger>
                        <TabsTrigger value="journals">Journals</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="list">
                    <Card>
                        <CardHeader>
                             <div className="flex items-center gap-2">
                                <ImportCustomersDialog clientId={clientId} onImportComplete={fetchCustomers} />
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
                                                                 <DropdownMenuItem asChild>
                                                                    <Link href={`/admin/ai-accountant/${clientId}/journals?customer=${customer.id}`}><BookUser className="mr-2 h-4 w-4" /> Post Journal</Link>
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
                </TabsContent>
                <TabsContent value="journals">
                     <Card>
                        <CardHeader>
                             <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Customer Journals</CardTitle>
                                    <CardDescription>Post and import journals for customers.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <ImportJournalsDialog />
                                    <Button asChild>
                                        <Link href={`/admin/ai-accountant/${clientId}/journals`}><PlusCircle className="mr-2 h-4 w-4"/>Post Journal</Link>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                <h3 className="text-lg font-medium">Coming Soon</h3>
                                <p className="text-sm text-muted-foreground">Functionality to manage customer journals will be available here.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
