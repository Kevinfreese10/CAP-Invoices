

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Task } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, Timestamp, doc, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { users as allUsers } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, addMonths, set, getDate, getMonth, getYear, lastDayOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const db = getFirestore(firebaseApp);


type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

const initialClients: Client[] = [
    { id: 'client-1', name: 'Innovate Inc.', email: 'contact@innovate.com', role: 'client', status: 'Active', cellNumber: '0821112222', contactPerson: 'Sarah Jones', yearEnd: 'February', isVatRegistered: true, vatCategory: 'A' },
    { id: 'client-2', name: 'Quantum Leap Corp', email: 'hello@quantum.co.za', role: 'client', status: 'Active', cellNumber: '0833334444', contactPerson: 'Mike Brown', yearEnd: 'August' },
    { id: 'client-3', name: 'Apex Solutions', email: 'support@apex.com', role: 'client', status: 'Inactive', cellNumber: '0845556666', contactPerson: 'Lisa Ray', yearEnd: 'February' },
    { id: '1', name: 'John Doe', email: 'client@test.com', role: 'client', status: 'Active', cellNumber: '0817778888', yearEnd: 'February' },
];

const clientStatuses: Client['status'][] = ['Active', 'Inactive'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const mgmtAccountFrequencies = ['Monthly', 'Quarterly', 'Bi-Annually', 'Annually'] as const;
const vatCategories = ['A', 'B', 'C'] as const;
const vatCategoryLabels = {
    A: 'Category A (Even Months)',
    B: 'Category B (Odd Months)',
    C: 'Category C (Monthly)',
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
            financialsDueDate: client?.financialsDueDate ? new Date(client.financialsDueDate) : undefined,
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
            managementAccountsFrequency: client?.managementAccountsFrequency || undefined,
            managementAccountsDueDate: client?.managementAccountsDueDate ? new Date(client.managementAccountsDueDate) : undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            preparesPayroll: client?.preparesPayroll || false,
            payrollDueDate: client?.payrollDueDate ? new Date(client.payrollDueDate) : undefined,
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
                            <FormItem className="flex flex-col"><FormLabel>Financials Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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
                            <FormField control={form.control} name="managementAccountsDueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Next Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        </div>
                    )}
                    
                    <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Are you registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                     {watchIsVatRegistered && (
                        <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT category..." /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(c => <SelectItem key={c} value={c}>{vatCategoryLabels[c]}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
                            <FormItem className="flex flex-col"><FormLabel>Payroll Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd MMM yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const handleAdd = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    toast({
        title: 'Client Deleted',
        description: 'The client has been removed.',
        variant: 'destructive',
    })
  };

   const createRecurringTasks = async (client: Client, creatorId: string) => {
    if (!client.yearEnd) {
      toast({
        title: 'Task Creation Skipped',
        description: 'Financial year-end is required to automate tasks.',
        variant: 'destructive'
      });
      return 0;
    }
    const getNextStaffMember = (department: string): string[] => {
        const staffInDept = allUsers.filter(u => u.role === 'staff' && u.department === department);
        if (staffInDept.length > 0) {
            const admin = allUsers.find(u => u.role === 'admin' && u.department === department);
            return admin ? [admin.id] : [staffInDept[0].id];
        }
        const admin = allUsers.find(u => u.role === 'admin');
        return admin ? [admin.id] : [];
    };

    const getDueDate = (month: string, day: number) => {
        const year = new Date().getFullYear();
        const monthIndex = months.indexOf(month);
        return Timestamp.fromDate(new Date(year, monthIndex, day));
    };
    
    const batch = writeBatch(db);
    const tasksToCreate: Omit<Task, 'id'>[] = [];
    
    const yearEndMonthIndex = months.indexOf(client.yearEnd);

    // Provisional Tax
    if (client.submitsProvisionalTaxes) {
        // 1st payment: 6 months before year end
        const firstProvDueDate = lastDayOfMonth(addMonths(new Date(getYear(new Date()), yearEndMonthIndex + 1, 1), -6));
        tasksToCreate.push({
            title: `1st Provisional Tax for ${client.name}`,
            description: `Complete and file the first provisional tax return for ${client.name}.`,
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(firstProvDueDate),
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
        
        // 2nd payment: At the end of the financial year
        const secondProvDueDate = lastDayOfMonth(new Date(getYear(new Date()), yearEndMonthIndex, 1));
         tasksToCreate.push({
            title: `2nd Provisional Tax for ${client.name}`,
            description: `Complete and file the second provisional tax return for ${client.name}.`,
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(secondProvDueDate),
            recurrence: 'Annually',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }

    // Corporate Income Tax (ITR14)
    if (client.submitsIncomeTaxReturn) {
         const itr14DueDate = addMonths(lastDayOfMonth(new Date(getYear(new Date()), yearEndMonthIndex, 1)), 12);
         tasksToCreate.push({
            title: `ITR14 Return for ${client.name}`,
            description: `File the ITR14 corporate income tax return for ${client.name}.`,
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(itr14DueDate),
            recurrence: 'Annually',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }


    // CIPC Annual Return
    tasksToCreate.push({
        title: `CIPC Annual Return for ${client.name}`,
        description: `File the CIPC annual return for ${client.name}.`,
        assignedTo: getNextStaffMember('Administration'),
        dueDate: getDueDate(client.yearEnd, 28),
        recurrence: 'Annually',
        priority: 'Medium',
        status: 'To-Do',
        createdBy: creatorId,
        comments: [],
    });
    
    // Financials
    if (client.preparesFinancials && client.financialsDueDate) {
         tasksToCreate.push({
            title: `Annual Financials for ${client.name}`,
            description: `Prepare annual financial statements for ${client.name}.`,
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: client.financialsDueDate,
            recurrence: 'Annually',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
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
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: client.managementAccountsDueDate,
            recurrence: recurrence,
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }

    // VAT Returns
    if (client.isVatRegistered && client.vatCategory) {
        const now = new Date();
        let firstDueDate: Date;
        
        if (client.vatCategory === 'C') { // Monthly
             firstDueDate = set(now, { date: 25, month: getMonth(now) + 1 });
        } else { // Bi-monthly
            const isEvenMonth = (getMonth(now) + 1) % 2 === 0;
            if ((client.vatCategory === 'A' && isEvenMonth) || (client.vatCategory === 'B' && !isEvenMonth)) {
                firstDueDate = set(now, { date: 25, month: getMonth(now) + 1 });
            } else {
                firstDueDate = set(now, { date: 25, month: getMonth(now) + 2 });
            }
        }

        tasksToCreate.push({
            title: `VAT201 Return for ${client.name}`,
            description: `File VAT201 return (Category ${client.vatCategory}).`,
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(firstDueDate),
            recurrence: client.vatCategory === 'C' ? 'Monthly' : 'Bi-Monthly',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }

    // Payroll
    if (client.preparesPayroll && client.payrollDueDate) {
        tasksToCreate.push({
            title: `Prepare Payroll for ${client.name}`,
            description: 'Process monthly payroll.',
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: client.payrollDueDate,
            recurrence: 'Monthly',
            priority: 'Medium',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }
    
    // EMP201
    if (client.submitsEmp201) {
        tasksToCreate.push({
            title: `EMP201 Submission for ${client.name}`,
            description: 'Submit monthly EMP201 declaration.',
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(set(new Date(), { date: 7, month: getMonth(new Date()) + 1 })),
            recurrence: 'Monthly',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
    }

    // EMP501
    if (client.submitsEmp501) {
        tasksToCreate.push({
            title: `Interim EMP501 for ${client.name}`,
            description: 'Submit bi-annual EMP501 reconciliation for the period 1 March - 31 August.',
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(new Date(getYear(new Date()), 9, 31)), // October 31
            recurrence: 'Annually',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
            comments: [],
        });
        tasksToCreate.push({
            title: `Final EMP501 for ${client.name}`,
            description: 'Submit final EMP501 reconciliation for the period 1 March - 28/29 February.',
            assignedTo: getNextStaffMember('Accounting and Tax'),
            dueDate: Timestamp.fromDate(new Date(getYear(new Date()) + 1, 4, 31)), // May 31 of next year
            recurrence: 'Annually',
            priority: 'High',
            status: 'To-Do',
            createdBy: creatorId,
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

  const handleFormSubmit = async (data: Omit<User, 'id' | 'role'>) => {
    if (!currentUser) return;

    if (selectedClient) {
      setClients(prev =>
        prev.map(c => (c.id === selectedClient.id ? { ...c, ...data } : c))
      );
       toast({
        title: 'Client Updated',
        description: 'The client details have been saved.',
      });
    } else {
      const newClient = { ...data, id: `new-client-${Date.now()}`, role: 'client' } as Client;
      setClients(prev => [
        ...prev,
        newClient,
      ]);
       toast({
        title: 'Client Created',
        description: 'The new client has been added.',
      });
      
      const numTasks = await createRecurringTasks(newClient, currentUser.id);
      toast({
        title: 'Recurring Tasks Created',
        description: `${numTasks} automated tasks have been generated for ${newClient.name}.`,
      });
    }
    setIsFormOpen(false);
    setSelectedClient(null);
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
        </CardContent>
      </Card>
    </div>
  );
}

    



