

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
import { User, Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import ClientForm from '@/components/admin/ClientForm';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';

const db = getFirestore(firebaseApp);


type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClientsAndStaff = async () => {
    setIsLoading(true);
    try {
        const staffQuery = query(collection(db, "users"));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const clientsQuery = query(collection(db, "clients"), orderBy("name"));
        const clientsSnapshot = await getDocs(clientsQuery);
        const fetchedClients = clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
        setClients(fetchedClients);
    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'Could not fetch data from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndStaff();
  }, []);

  const handleAdd = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
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
        
        fetchClientsAndStaff();
        toast({
            title: 'Client Deleted',
            description: `The client and their ${tasksSnapshot.size} associated tasks have been removed.`,
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client and their tasks.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const { createNumeraProfile, ...clientFormData } = data;

    const clientData: Partial<Client> = {
        ...clientFormData,
        financialsDueDate: data.financialsDueDate || null,
        managementAccountsDueDate: data.requiresManagementAccounts ? data.managementAccountsDueDate : null,
        vatCategory: data.isVatRegistered ? data.vatCategory : null,
        payrollDueDate: data.payrollDueDate || null,
        role: 'client',
    };
    
    if (createNumeraProfile) {
        clientData.hasNumeraProfile = true;
        clientData.source = 'Numera';
        clientData.chartOfAccounts = initialChartOfAccounts;
        clientData.allocationRules = initialAllocationRules;
    } else {
        clientData.source = 'Client Management';
    }

    try {
        let clientToProcess: Client;

        if (selectedClient?.id) {
            await setDoc(doc(db, "clients", selectedClient.id), clientData, { merge: true });
            toast({ title: 'Client Updated'});
            clientToProcess = { ...selectedClient, ...clientData };
        } else {
            const newDocRef = await addDoc(collection(db, "clients"), clientData);
            toast({ title: 'Client Created' });
            clientToProcess = { ...clientData, id: newDocRef.id } as Client;
        }

        fetchClientsAndStaff();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
    }
  };

  const formatYearEnd = (yearEnd: any): string => {
    if (!yearEnd) return 'N/A';
    if (typeof yearEnd === 'string') {
      return yearEnd;
    }
    if (yearEnd.toDate && typeof yearEnd.toDate === 'function') {
      const date = yearEnd.toDate();
      return format(date, 'MMMM');
    }
    try {
        const d = new Date(yearEnd);
        if (!isNaN(d.getTime())) {
             return format(d, 'MMMM');
        }
    } catch (e) {
        // fall through
    }
    return 'Invalid Date';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Clients</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Client
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                    <DialogDescription>
                        {selectedClient ? 'Update the details for this client.' : 'Fill out the form to add a new client and automate their tasks.'}
                    </DialogDescription>
                </DialogHeader>
                <ClientForm 
                    client={selectedClient} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    allStaff={allStaff}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>View, edit, and manage your monthly accounting clients.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cell Number</TableHead>
                <TableHead>Year End</TableHead>
                <TableHead>VAT Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div>
                        <span>{client.name}</span>
                        {client.contactPerson && <p className="text-xs text-muted-foreground">{client.contactPerson}</p>}
                    </div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.cellNumber}</TableCell>
                   <TableCell>{formatYearEnd(client.yearEnd)}</TableCell>
                    <TableCell>
                      {client.isVatRegistered ? (
                          <Badge variant="success">Yes ({client.vatCategory})</Badge>
                      ) : (
                          <Badge variant="secondary">No</Badge>
                      )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'Active' ? 'default' : 'secondary'}>
                        {client.status}
                    </Badge>
                  </TableCell>
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
                                <span className="font-semibold"> {client.name}</span>. All associated tasks will also be deleted.
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
