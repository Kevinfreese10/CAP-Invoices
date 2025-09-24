
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const db = getFirestore(firebaseApp);

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client name is required.'),
  yearEnd: z.string().min(1, 'Financial year end is required.'),
});

function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            yearEnd: client?.yearEnd || 'February',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}

export default function NumeraPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
        const querySnapshot = await getDocs(q);
        const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        fetchedClients.sort((a, b) => a.name.localeCompare(b.name));
        
        setClients(fetchedClients);
    } catch (error) {
        console.error("Error fetching clients:", error);
        toast({ title: 'Error', description: 'Could not fetch clients from the database.', variant: 'destructive'});
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

  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    try {
        await deleteDoc(doc(db, "clients", clientId));
        fetchClients();
        toast({
            title: 'Client Deleted',
            description: 'The client has been removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!currentUser) return;
    
    const clientData = {
        name: data.name,
        yearEnd: data.yearEnd,
        role: 'client' as const,
        source: 'Numera' as const,
        email: `${data.name.toLowerCase().replace(/\s/g, '.')}@numera.local` // Placeholder email
    };

    try {
        if (selectedClient?.id) {
            const clientRef = doc(db, "clients", selectedClient.id);
            await setDoc(clientRef, clientData, { merge: true });
            toast({
                title: 'Client Updated',
                description: 'The client details have been saved.',
            });
        } else {
            await addDoc(collection(db, "clients"), clientData);
            toast({
                title: 'Client Created',
                description: 'The new client has been added to the database.',
            });
        }
        fetchClients();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Client
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                    <DialogDescription>
                        {selectedClient ? 'Update the details for this client.' : 'Enter the details for a new Numera client.'}
                    </DialogDescription>
                </DialogHeader>
                <ClientForm 
                    client={selectedClient} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Numera Clients</CardTitle>
          <CardDescription>View, edit, and manage your Numera accounting clients.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            clients.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No clients have been added to Numera yet.</p>
                     <Button onClick={handleAdd} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Your First Client
                    </Button>
                </div>
            ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Financial Year End</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${client.name}`} alt={client.name} />
                            <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{client.name}</span>
                    </div>
                  </TableCell>
                   <TableCell>{client.yearEnd}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the client account for:
                                <span className="font-semibold"> {client.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(client.id)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
