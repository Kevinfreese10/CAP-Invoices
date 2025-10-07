
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download, Upload, FileCheck2, ScanLine, Sprout, Search, ArrowUpDown, Edit, Sparkles, BrainCircuit, Copy, MessageSquare, RefreshCw, ChevronDown, Trash2, ListOrdered, HardHat, Feather, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount, VatType, Supplier, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub, getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, addMonths, parse } from 'date-fns';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAISuggestions } from '@/ai/flows/get-ai-suggestions';
import { allVatTypes as allVatTypesData } from '@/lib/vat-types';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

const db = getFirestore(firebaseApp);

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

const clientFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  yearEnd: z.string().min(1, 'Financial year end is required.'),
});

function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof clientFormSchema>>({
        resolver: zodResolver(clientFormSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            yearEnd: client?.yearEnd || 'December',
        },
    });

    const handleSubmit = (values: z.infer<typeof clientFormSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}


export default function NumeraPage() {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    
    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
            const querySnapshot = await getDocs(q);
            let fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
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

    const handleAddClient = () => {
        setSelectedClient(null);
        setIsClientFormOpen(true);
    };

    const handleEditClient = (client: User) => {
        setSelectedClient(client);
        setIsClientFormOpen(true);
    };

     const handleDeleteClient = async (clientId: string) => {
        try {
            await deleteDoc(doc(db, "clients", clientId));
            toast({
                title: "Client Deleted",
                description: "The client has been removed from Numera.",
                variant: 'destructive'
            });
            fetchClients();
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({
                title: "Error",
                description: "Could not delete the client.",
                variant: "destructive",
            });
        }
    };
    
    const handleClientFormSubmit = async (data: z.infer<typeof clientFormSchema>) => {
        const { id, ...clientData } = data;
        
        try {
            if (id) { // Editing existing client
                const clientRef = doc(db, "clients", id);
                await setDoc(clientRef, { ...clientData, source: 'Numera' }, { merge: true });
                toast({ title: 'Client Updated', description: 'The client details have been saved.' });
            } else { // Creating new client
                 const masterRulesSnapshot = await getDocs(collection(db, "allocationRules"));
                 const masterRules = masterRulesSnapshot.docs.map(doc => {
                     const { id, ...rest } = doc.data();
                     return rest; // Return the rule data without its Firestore ID
                 });

                const newClientData = {
                    ...clientData,
                    role: 'client', // Assign a default role
                    source: 'Numera',
                    chartOfAccounts: initialChartOfAccounts,
                    allocationRules: masterRules,
                };
                
                const newClientRef = doc(collection(db, 'clients'));
                await setDoc(newClientRef, { ...newClientData, id: newClientRef.id });

                toast({ title: 'Client Created', description: 'The new client has been added to Numera.' });
            }
            fetchClients();
            setIsClientFormOpen(false);
            setSelectedClient(null);
        } catch(error) {
             console.error("Error saving client:", error);
             toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
        }
    }

    const handleSelectClient = (client: User) => {
        sessionStorage.setItem('numera-active-client', JSON.stringify(client));
        router.push('/admin/numera/workspace');
    }
    
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
                <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
                <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddClient}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Client
                        </Button>
                    </DialogTrigger>
                     <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Numera Client'}</DialogTitle>
                            <DialogDescription>
                                {selectedClient ? 'Update the details for this client.' : 'Create a new client to manage in Numera.'}
                            </DialogDescription>
                        </DialogHeader>
                        <ClientForm 
                            client={selectedClient} 
                            onSubmit={handleClientFormSubmit}
                            onCancel={() => setIsClientFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>
            
            <Card>
                <CardHeader>
                <CardTitle>Numera Clients</CardTitle>
                <CardDescription>Select a client to start working, or create a new client.</CardDescription>
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
                            <Button onClick={handleAddClient} className="mt-4">
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
                        <TableCell>{formatYearEnd(client.yearEnd)}</TableCell>
                        <TableCell className="text-right">
                             <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => handleSelectClient(client)}>
                                            Select Client
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleEditClient(client)}>
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the client and all their data in Numera.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteClient(client.id)}>Delete</AlertDialogAction>
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
    )
}
