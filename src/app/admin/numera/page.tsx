
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub } from 'date-fns';
import { chartOfAccounts } from '@/lib/chart-of-accounts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

const bankAccountSchema = z.object({
  name: z.string().min(1, 'Bank name is required.'),
});

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client name is required.'),
  yearEnd: z.date({ required_error: 'Financial year end is required.'}),
  bankAccounts: z.array(bankAccountSchema).optional(),
});

function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    
    const toDate = (value: any) => {
        if (!value) return undefined;
        if (value.toDate) return value.toDate(); // Firestore Timestamp
        return new Date(value);
    }
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            yearEnd: toDate(client?.yearEnd),
            bankAccounts: client?.bankingDetails ? [{ name: client.bankingDetails.bankName }] : [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'bankAccounts',
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <FormField
                    control={form.control}
                    name="yearEnd"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Financial Year End</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "dd MMMM yyyy")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date("1900-01-01")}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <div>
                    <FormLabel>Bank Accounts</FormLabel>
                    <div className="space-y-2 mt-2">
                        {fields.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`bankAccounts.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem className="flex-grow">
                                            <FormControl><Input placeholder={`e.g., FNB, ABSA...`} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>Remove</Button>
                            </div>
                        ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ name: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Bank Account
                    </Button>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}

const trialBalanceFormSchema = z.object({
    fromDate: z.date(),
    toDate: z.date(),
    showZeroItems: z.boolean().default(true),
});

type TrialBalanceData = {
    accountNumber: string;
    description: string;
    debit: number;
    credit: number;
}[];

function TrialBalanceCard({ activeClient }: { activeClient: User }) {
    
    const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceData | null>(null);
    
    const getFinancialYear = (yearEnd: any) => {
        const toDate = yearEnd?.toDate ? yearEnd.toDate() : new Date(yearEnd);
        const endDate = toDate;
        const startDate = add(sub(endDate, { years: 1 }), { days: 1 });
        return { startDate, endDate };
    }

    const { startDate, endDate } = getFinancialYear(activeClient.yearEnd);
    
    const form = useForm<z.infer<typeof trialBalanceFormSchema>>({
        resolver: zodResolver(trialBalanceFormSchema),
        defaultValues: {
            fromDate: startDate,
            toDate: endDate,
            showZeroItems: true,
        }
    });

    const handleGenerate = (values: z.infer<typeof trialBalanceFormSchema>) => {
        console.log("Generating Trial Balance for", values);
        
        let mockData = chartOfAccounts.map(account => {
            let debit = 0;
            let credit = 0;
            if (account.accountNumber.startsWith('1')) { // Sales
                credit = Math.random() * 100000;
            } else if (account.accountNumber.startsWith('3') || account.accountNumber.startsWith('4')) { // Expenses
                debit = Math.random() * 20000;
            } else if (account.accountNumber.startsWith('8400')) { // Bank
                debit = Math.random() * 50000;
            }
            if (Math.random() > 0.7) {
                return { accountNumber: account.accountNumber, description: account.description, debit, credit };
            }
            return { accountNumber: account.accountNumber, description: account.description, debit: 0, credit: 0 };
        });

        // Balance the trial balance
        const totalDebits = mockData.reduce((acc, item) => acc + item.debit, 0);
        const totalCredits = mockData.reduce((acc, item) => acc + item.credit, 0);
        const difference = totalDebits - totalCredits;

        const suspenseAccountIndex = mockData.findIndex(acc => acc.accountNumber === '9990/000');
        if (suspenseAccountIndex !== -1) {
            if (difference > 0) {
                mockData[suspenseAccountIndex].credit += difference;
            } else {
                mockData[suspenseAccountIndex].debit -= difference;
            }
        }

        const filteredData = values.showZeroItems ? mockData : mockData.filter(d => d.debit !== 0 || d.credit !== 0);
        setTrialBalanceData(filteredData);
    }
    
    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' });
    }

    const totalDebits = trialBalanceData ? trialBalanceData.reduce((acc, item) => acc + item.debit, 0) : 0;
    const totalCredits = trialBalanceData ? trialBalanceData.reduce((acc, item) => acc + item.credit, 0) : 0;

    return (
        <Card>
            <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="fromDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>From Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField
                                control={form.control}
                                name="toDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>To Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                        </div>
                        <FormField
                            control={form.control}
                            name="showZeroItems"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Show zero balance accounts</FormLabel>
                                </div>
                                </FormItem>
                            )}
                        />
                        <Button type="submit">Generate</Button>
                    </form>
                </Form>
                 {trialBalanceData && (
                    <div className="mt-6">
                        <Separator className="my-4"/>
                        <h3 className="text-lg font-medium mb-2">Generated Trial Balance</h3>
                        <p className="text-sm text-muted-foreground">For period: {format(form.getValues('fromDate'), 'dd MMM yyyy')} to {format(form.getValues('toDate'), 'dd MMM yyyy')}</p>
                         <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trialBalanceData.map(item => (
                                    <TableRow key={item.accountNumber}>
                                        <TableCell className="font-mono">{item.accountNumber}</TableCell>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                        <TableCell className="text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatCurrency(totalDebits)}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatCurrency(totalCredits)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function NumeraPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [activeClient, setActiveClient] = useState<User | null>(null);
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
        const batch = writeBatch(db);
        
        // Delete the client
        const clientRef = doc(db, "clients", clientId);
        batch.delete(clientRef);

        // Find and delete associated cashbook accounts from chartOfAccounts
        const associatedAccounts = chartOfAccounts.filter(acc => acc.id.startsWith(`cashbook-${clientId}`));
        associatedAccounts.forEach(acc => {
            const index = chartOfAccounts.findIndex(a => a.id === acc.id);
            if (index > -1) {
                chartOfAccounts.splice(index, 1);
            }
        });

        await batch.commit();

        fetchClients();
        toast({
            title: 'Client Deleted',
            description: 'The client and their associated cashbooks have been removed.',
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
            const clientRef = doc(collection(db, "clients"));
            await setDoc(clientRef, clientData);
            
            // Add new bank accounts to chart of accounts
            if (data.bankAccounts && data.bankAccounts.length > 0) {
              const lastCashbook = chartOfAccounts
                  .filter(a => a.accountNumber.startsWith('8400/'))
                  .sort((a,b) => a.accountNumber.localeCompare(b.accountNumber))
                  .pop();
              
              let nextAccountNumberIndex = 1;
              if (lastCashbook) {
                  const lastNum = parseInt(lastCashbook.accountNumber.split('/')[1]);
                  if (!isNaN(lastNum)) {
                     nextAccountNumberIndex = lastNum + 1;
                  }
              }

              data.bankAccounts.forEach((bank, index) => {
                  const newAccountNum = `8400/${(nextAccountNumberIndex + index).toString().padStart(3, '0')}`;
                  const newAccount: ChartOfAccount = {
                      id: `cashbook-${clientRef.id}-${index}`, // Unique ID for the account
                      accountNumber: newAccountNum,
                      description: `${data.name} - ${bank.name}`,
                      section: 'Balance Sheet',
                  };
                  // Avoid duplicates
                  if (!chartOfAccounts.some(a => a.accountNumber === newAccount.accountNumber)) {
                      chartOfAccounts.push(newAccount);
                  }
              });
               toast({
                title: 'Cashbooks Created',
                description: `${data.bankAccounts.length} new cashbook accounts added to the Chart of Accounts.`,
              });
            }

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
  
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    // Check if it's a Firestore Timestamp
    if (date.toDate) {
      return format(date.toDate(), 'dd MMMM yyyy');
    }
    // Check if it's already a Date object or a valid date string
    const d = new Date(date);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return format(d, 'dd MMMM yyyy');
    }
    return 'Invalid Date';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
        {!activeClient && (
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
        )}
      </div>
      
        {activeClient ? (
             <div className="space-y-6">
                <Card className="bg-primary/10 border-primary/20">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardDescription>Currently working on:</CardDescription>
                                <CardTitle>{activeClient.name}</CardTitle>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setActiveClient(null)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader>
                </Card>
                <Tabs defaultValue="reporting" className="w-full">
                    <TabsList>
                        <TabsTrigger value="reporting">Reporting</TabsTrigger>
                        <TabsTrigger value="banking">Banking</TabsTrigger>
                        <TabsTrigger value="journals">Journals</TabsTrigger>
                        <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                    </TabsList>
                    <TabsContent value="reporting" className="space-y-4">
                        <TrialBalanceCard activeClient={activeClient} />
                         <Card>
                            <CardHeader><CardTitle>General Ledger</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">General Ledger functionality will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="banking" className="space-y-4">
                        <Card>
                            <CardHeader><CardTitle>Bank Account List</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Bank account list with balances will be built here.</p></CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Bank Transactions</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Bank transactions functionality will be built here.</p></CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Bank Reconciliation</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Bank reconciliation functionality will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="journals">
                         <Card>
                            <CardHeader><CardTitle>Manage Journals</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Journal creation and management will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="suppliers">
                         <Card>
                            <CardHeader><CardTitle>Manage Suppliers</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Supplier creation and management will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="customers">
                         <Card>
                            <CardHeader><CardTitle>Manage Customers</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Customer creation and management will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
             </div>
        ) : (
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
                        <TableCell>{formatDate(client.yearEnd)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" onClick={() => setActiveClient(client)}>Select</Button>
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
                                            <span className="font-semibold"> {client.name}</span>. This will also remove their related cashbooks.
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
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                    )
                )}
                </CardContent>
            </Card>
        )}
    </div>
  );
}

