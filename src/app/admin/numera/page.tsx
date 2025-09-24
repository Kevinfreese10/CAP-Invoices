
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Task } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { users as allUsers } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, addMonths, set, getDate, getMonth, getYear, lastDayOfMonth, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const db = getFirestore(firebaseApp);


type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

const clientStatuses: Client['status'][] = ['Active', 'Inactive'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const mgmtAccountFrequencies = ['Monthly', 'Quarterly', 'Bi-Annually', 'Annually'] as const;
const vatCategories = ['A', 'B', 'C'] as const;

const vatCategoryLabels = {
    A: {
        name: 'Category A',
        description: 'e.g., Jan–Feb, Mar–Apr'
    },
    B: {
        name: 'Category B',
        description: 'e.g., Feb–Mar, Apr–May'
    },
    C: {
        name: 'Category C',
        description: 'e.g., January, February'
    },
};


const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  contactPerson: z.string().optional(),
  email: z.string().email('A valid email is required.'),
  cellNumber: z.string().optional(),
  status: z.enum(clientStatuses),
  // Automation fields
  yearEnd: z.string().min(1, 'Financial year end is required.'),
  submitsProvisionalTaxes: z.boolean().default(false),
  submitsIncomeTaxReturn: z.boolean().default(false),
  preparesFinancials: z.boolean().default(false),
  financialsDueDate: z.date().optional(),
  requiresManagementAccounts: z.boolean().default(false),
  managementAccountsFrequency: z.enum(mgmtAccountFrequencies).optional(),
  managementAccountsDueDate: z.date().optional(),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(vatCategories).optional(),
  preparesPayroll: z.boolean().default(false),
  payrollDueDate: z.date().optional(),
  submitsEmp201: z.boolean().default(false),
  submitsEmp501: z.boolean().default(false),
});

function ClientForm({ client, onSubmit, onCancel }: { client: Client | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    
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
            contactPerson: client?.contactPerson || '',
            email: client?.email || '',
            cellNumber: client?.cellNumber || '',
            status: client?.status || 'Active',
            yearEnd: client?.yearEnd || 'February',
            submitsProvisionalTaxes: client?.submitsProvisionalTaxes || false,
            submitsIncomeTaxReturn: client?.submitsIncomeTaxReturn || false,
            preparesFinancials: client?.preparesFinancials || false,
            financialsDueDate: toDate(client?.financialsDueDate),
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
            managementAccountsFrequency: client?.managementAccountsFrequency || undefined,
            managementAccountsDueDate: toDate(client?.managementAccountsDueDate),
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            preparesPayroll: client?.preparesPayroll || false,
            payrollDueDate: toDate(client?.payrollDueDate),
            submitsEmp201: client?.submitsEmp201 || false,
            submitsEmp501: client?.submitsEmp501 || false,
        },
    });

    const watchPreparesFinancials = form.watch('preparesFinancials');
    const watchRequiresMgmt = form.watch('requiresManagementAccounts');
    const watchIsVatRegistered = form.watch('isVatRegistered');
    const watchPreparesPayroll = form.watch('preparesPayroll');


    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                 <div className="space-y-4">
                    <h3 className="text-lg font-medium">Client Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input {...field} placeholder="e.g. 0821234567" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                 </div>

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Task Automation Setup</h3>
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    
                    <FormField control={form.control} name="submitsProvisionalTaxes" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we submit your provisional taxes?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="submitsIncomeTaxReturn" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we submit your corporate income tax return (ITR14)?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="preparesFinancials" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we prepare your annual financials?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    {watchPreparesFinancials && (
                        <FormField control={form.control} name="financialsDueDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Financials Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(toDate(field.value), "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    )}

                    <FormField control={form.control} name="requiresManagementAccounts" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do you require management accounts?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                     {watchRequiresMgmt && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="managementAccountsFrequency" render={({ field }) => ( <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{mgmtAccountFrequencies.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="managementAccountsDueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Next Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(toDate(field.value), "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        </div>
                    )}
                    
                    <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Are you registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    {watchIsVatRegistered && (
                        <FormField
                        control={form.control}
                        name="vatCategory"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>VAT Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select VAT category..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {vatCategories.map(c => (
                                    <SelectItem key={c} value={c}>
                                        <div className="flex flex-col">
                                            <span>{vatCategoryLabels[c].name}</span>
                                            <span className="text-xs text-muted-foreground">{vatCategoryLabels[c].description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    )}

                    <Separator />
                    
                    <FormField control={form.control} name="preparesPayroll" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we prepare your payroll?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                     {watchPreparesPayroll && (
                        <FormField control={form.control} name="payrollDueDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Payroll Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(toDate(field.value), "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="submitsEmp201" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we submit your EMP201?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="submitsEmp501" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do we submit your EMP501?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}

export default function NumeraPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "clients"), where('source', '==', 'Numera'), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
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

  const handleEdit = (client: Client) => {
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

   const createRecurringTasks = async (client: Client, creatorId: string) => {
    if (!client.yearEnd || !client.id) {
      toast({
        title: 'Task Creation Skipped',
        description: 'Financial year-end is required to automate tasks.',
        variant: 'destructive'
      });
      return 0;
    }
    const getDepartmentStaffIds = (department: string): string[] => {
        return allUsers.filter(u => u.department === department && (u.role === 'staff' || u.role === 'admin')).map(u => u.id);
    };

    const accountingAndTaxStaff = getDepartmentStaffIds('Accounting and Tax');
    const adminStaff = getDepartmentStaffIds('Administration');
    
    const batch = writeBatch(db);
    const tasksToCreate: Omit<Task, 'id'>[] = [];
    
    const yearEndMonthIndex = months.indexOf(client.yearEnd);

    // Provisional Tax
    if (client.submitsProvisionalTaxes) {
        const firstProvDueDate = lastDayOfMonth(addMonths(new Date(getYear(new Date()), yearEndMonthIndex, 1), 6));
        tasksToCreate.push({
            title: `1st Provisional Tax for ${client.name}`,
            description: `Complete and file the first provisional tax return for ${client.name}.`,
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(firstProvDueDate),
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
        
        const secondProvDueDate = lastDayOfMonth(new Date(getYear(new Date()), yearEndMonthIndex, 1));
         tasksToCreate.push({
            title: `2nd Provisional Tax for ${client.name}`,
            description: `Complete and file the second provisional tax return for ${client.name}.`,
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(secondProvDueDate),
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // Corporate Income Tax (ITR14)
    if (client.submitsIncomeTaxReturn) {
         const itr14DueDate = addMonths(lastDayOfMonth(new Date(getYear(new Date()), yearEndMonthIndex, 1)), 12);
         tasksToCreate.push({
            title: `ITR14 Return for ${client.name}`,
            description: `File the ITR14 corporate income tax return for ${client.name}.`,
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(itr14DueDate),
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // CIPC Annual Return
    tasksToCreate.push({
        title: `CIPC Annual Return for ${client.name}`,
        description: `File the CIPC annual return for ${client.name}.`,
        assignedTo: adminStaff,
        dueDate: Timestamp.fromDate(addMonths(new Date(getYear(new Date()), yearEndMonthIndex, 1), 1)), // Due in the anniversary month
        recurrence: 'Annually',
        priority: 'Medium',
        status: 'To-Do',
        createdBy: creatorId,
        clientId: client.id,
        comments: [],
    });
    
    // Financials
    if (client.preparesFinancials && client.financialsDueDate) {
         tasksToCreate.push({
            title: `Annual Financials for ${client.name}`,
            description: `Prepare annual financial statements for ${client.name}.`,
            assignedTo: accountingAndTaxStaff,
            dueDate: client.financialsDueDate,
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // Management Accounts
    if (client.requiresManagementAccounts && client.managementAccountsDueDate && client.managementAccountsFrequency) {
        let recurrence: Task['recurrence'] = 'None';
        if (client.managementAccountsFrequency === 'Monthly') recurrence = 'Monthly';
        if (client.managementAccountsFrequency === 'Annually') recurrence = 'Annually';

        tasksToCreate.push({
            title: `Management Accounts for ${client.name}`,
            description: `Prepare ${client.managementAccountsFrequency} management accounts.`,
            assignedTo: accountingAndTaxStaff,
            dueDate: client.managementAccountsDueDate,
            recurrence: recurrence,
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // VAT Returns
    if (client.isVatRegistered && client.vatCategory) {
        const now = new Date();
        let firstDueDate: Date;

        if (client.vatCategory === 'C') { // Monthly
            firstDueDate = set(now, { date: 25 });
            if (isPast(firstDueDate)) {
                firstDueDate = addMonths(firstDueDate, 1);
            }
        } else { // Bi-monthly
            const currentMonth = getMonth(now); // 0-11
            const isEvenMonth = (currentMonth + 1) % 2 === 0;
            let targetMonth: number;

            if (client.vatCategory === 'A') { // Even months (Jan-Feb, Mar-Apr, etc.) -> Due Mar 25, May 25...
                targetMonth = isEvenMonth ? currentMonth + 1 : currentMonth + 2;
            } else { // 'B' - Odd months (Feb-Mar, Apr-May, etc.) -> Due Apr 25, Jun 25...
                targetMonth = !isEvenMonth ? currentMonth + 1 : currentMonth + 2;
            }
            if(targetMonth > 11){
                firstDueDate = set(now, { year: getYear(now) + 1, month: targetMonth % 12, date: 25 });
            } else {
                firstDueDate = set(now, { month: targetMonth, date: 25 });
            }
        }

        tasksToCreate.push({
            title: `VAT201 Return for ${client.name}`,
            description: `File VAT201 return (Category ${client.vatCategory}).`,
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(firstDueDate),
            recurrence: client.vatCategory === 'C' ? 'Monthly' : 'Bi-Monthly',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // Payroll
    if (client.preparesPayroll && client.payrollDueDate) {
        tasksToCreate.push({
            title: `Prepare Payroll for ${client.name}`,
            description: 'Process monthly payroll.',
            assignedTo: accountingAndTaxStaff,
            dueDate: client.payrollDueDate,
            recurrence: 'Monthly',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }
    
    // EMP201
    if (client.submitsEmp201) {
        tasksToCreate.push({
            title: `EMP201 Submission for ${client.name}`,
            description: 'Submit monthly EMP201 declaration.',
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(set(new Date(), { date: 7, month: getMonth(new Date()) + 1 })),
            recurrence: 'Monthly',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }

    // EMP501
    if (client.submitsEmp501) {
        tasksToCreate.push({
            title: `Interim EMP501 for ${client.name}`,
            description: 'Submit bi-annual EMP501 reconciliation for the period 1 March - 31 August.',
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(new Date(getYear(new Date()), 9, 31)), // October 31
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
        tasksToCreate.push({
            title: `Final EMP501 for ${client.name}`,
            description: 'Submit final EMP501 reconciliation for the period 1 March - 28/29 February.',
            assignedTo: accountingAndTaxStaff,
            dueDate: Timestamp.fromDate(new Date(getYear(new Date()) + 1, 4, 31)), // May 31 of next year
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            clientId: client.id,
            comments: [],
        });
    }


    tasksToCreate.forEach(task => {
        if (task.assignedTo.length > 0) {
            const taskRef = doc(collection(db, 'tasks'));
            batch.set(taskRef, task);
        }
    });
    
    await batch.commit();
    return tasksToCreate.length;
  };
  
  const deleteRecurringTasks = async (clientId: string) => {
    const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId));
    const querySnapshot = await getDocs(tasksQuery);
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return querySnapshot.size;
  }

  const handleFormSubmit = async (data: Omit<User, 'id' | 'role'>) => {
    if (!currentUser) return;
    
    const clientData: Omit<Client, 'id'> = {
        ...data,
        role: 'client',
        source: 'Numera',
    };

    try {
        if (selectedClient?.id) {
            const clientRef = doc(db, "clients", selectedClient.id);
            await setDoc(clientRef, clientData, { merge: true });
            toast({
                title: 'Client Updated',
                description: 'The client details have been saved.',
            });
            // Regenerate tasks for the updated client
            await deleteRecurringTasks(selectedClient.id);
            const numTasks = await createRecurringTasks({ ...clientData, id: selectedClient.id } as Client, currentUser.id);
             if (numTasks > 0) {
                toast({
                    title: 'Recurring Tasks Updated',
                    description: `${numTasks} automated tasks have been updated for ${clientData.name}.`,
                });
            }
        } else {
            const newDocRef = await addDoc(collection(db, "clients"), clientData);
            toast({
                title: 'Client Created',
                description: 'The new client has been added to the database.',
            });
            const newClient = { ...clientData, id: newDocRef.id } as Client;
            const numTasks = await createRecurringTasks(newClient, currentUser.id);
            if (numTasks > 0) {
                toast({
                    title: 'Recurring Tasks Created',
                    description: `${numTasks} automated tasks have been generated for ${newClient.name}.`,
                });
            }
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
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${client.email}`} alt={client.name} />
                            <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <span>{client.name}</span>
                            {client.contactPerson && <p className="text-xs text-muted-foreground">{client.contactPerson}</p>}
                        </div>
                    </div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.cellNumber}</TableCell>
                   <TableCell>{client.yearEnd}</TableCell>
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

    
