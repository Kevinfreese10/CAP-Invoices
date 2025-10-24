
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Edit, MoreHorizontal, FileUp } from 'lucide-react';
import { getFirestore, collection, query, getDocs, doc, deleteDoc, addDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Supplier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Supplier name is required"),
});

const importSchema = z.object({
  file: z.any().refine((files) => files && files.length > 0, "An Excel file is required."),
});

function ImportSuppliersDialog({ clientId, onImportComplete }: { clientId: string; onImportComplete: () => void }) {
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
                const json = XLSX.utils.sheet_to_json(worksheet) as { 'Supplier Name'?: string }[];

                const supplierNames = json.map(row => row['Supplier Name']).filter((name): name is string => !!name);

                if (supplierNames.length === 0) {
                    toast({ title: "No suppliers found", description: "Make sure your Excel file has a column named 'Supplier Name'.", variant: "destructive" });
                    return;
                }

                const batch = writeBatch(db);
                supplierNames.forEach(name => {
                    const docRef = doc(collection(db, `aiAccountantClients/${clientId}/suppliers`));
                    batch.set(docRef, { name });
                });

                await batch.commit();

                toast({ title: "Import Successful", description: `${supplierNames.length} suppliers have been imported.` });
                onImportComplete();
                setIsOpen(false);
            } catch (error) {
                console.error("Error importing suppliers:", error);
                toast({ title: "Import Failed", description: "An error occurred during the import.", variant: "destructive" });
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> Import Suppliers</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Suppliers from Excel</DialogTitle>
                    <DialogDescription>Upload an .xlsx file with a column named "Supplier Name" to bulk import suppliers.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input id="supplier-file" type="file" accept=".xlsx" onChange={handleFileChange} disabled={isUploading} />
                    {isUploading && <div className="flex items-center mt-2 text-muted-foreground"><Loader2 className="mr-2 animate-spin"/>Processing...</div>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function SuppliersPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    const fetchSuppliers = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, `aiAccountantClients/${clientId}/suppliers`), orderBy("name"));
            const querySnapshot = await getDocs(q);
            setSuppliers(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier)));
        } catch (error) {
            toast({ title: 'Error', description: 'Could not fetch suppliers.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [clientId, toast]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const handleAdd = () => {
        setSelectedSupplier(null);
        form.reset({ name: '' });
        setIsFormOpen(true);
    };

    const handleEdit = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        form.reset(supplier);
        setIsFormOpen(true);
    };

    const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
        try {
            if (selectedSupplier) {
                await doc(db, `aiAccountantClients/${clientId}/suppliers`, selectedSupplier.id).set(data, { merge: true });
                toast({ title: 'Supplier Updated' });
            } else {
                await addDoc(collection(db, `aiAccountantClients/${clientId}/suppliers`), data);
                toast({ title: 'Supplier Created' });
            }
            fetchSuppliers();
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not save the supplier.', variant: 'destructive'});
        }
    };

    const handleDelete = async (supplierId: string) => {
        try {
            await deleteDoc(doc(db, `aiAccountantClients/${clientId}/suppliers`, supplierId));
            toast({ title: 'Supplier Deleted', variant: 'destructive' });
            fetchSuppliers();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete supplier.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground">Manage your client's suppliers.</p>
                </div>
                <div className="flex items-center gap-2">
                    <ImportSuppliersDialog clientId={clientId} onImportComplete={fetchSuppliers} />
                    <Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Create Supplier</Button>
                </div>
            </div>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedSupplier ? 'Edit' : 'Create'} Supplier</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                             <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Supplier Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Supplier List</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : suppliers.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10"><p>No suppliers created for this client yet.</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier Name</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliers.map(supplier => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="font-medium">{supplier.name}</TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleEdit(supplier)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                        <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the supplier "{supplier.name}".</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(supplier.id)}>Yes, Delete</AlertDialogAction></AlertDialogFooter>
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
