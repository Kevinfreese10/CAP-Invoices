

'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const clientStatuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const vatCategories: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];

const vatCategoryLabels = {
    A: {
        name: 'Category A (Even Months)',
        description: 'e.g., Jan–Feb, Mar–Apr'
    },
    B: {
        name: 'Category B (Odd Months)',
        description: 'e.g., Feb–Mar, Apr–May'
    },
    C: {
        name: 'Category C (Monthly)',
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
  createNumeraProfile: z.boolean().default(false),
  // Automation fields
  yearEnd: z.string().optional(),
  submitsProvisionalTaxes: z.boolean().default(false),
  submitsIncomeTaxReturn: z.boolean().default(false),
  preparesFinancials: z.boolean().default(false),
  financialsDueDate: z.date().optional(),
  requiresManagementAccounts: z.boolean().default(false),
  managementAccountsDueDate: z.date().optional(),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(vatCategories).optional(),
  preparesPayroll: z.boolean().default(false),
  payrollDueDate: z.date().optional(),
  submitsEmp201: z.boolean().default(false),
  submitsEmp501: z.boolean().default(false),
});

export default function ClientForm({ client, onSubmit, onCancel, allStaff }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void, allStaff: User[] }) {
    
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
            createNumeraProfile: client?.hasNumeraProfile || false,
            yearEnd: client?.yearEnd || undefined,
            submitsProvisionalTaxes: client?.submitsProvisionalTaxes || false,
            submitsIncomeTaxReturn: client?.submitsIncomeTaxReturn || false,
            preparesFinancials: client?.preparesFinancials || false,
            financialsDueDate: toDate(client?.financialsDueDate),
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
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
                    <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="e.g. 0821234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                 </div>

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Numera Accounting Module</h3>
                     <FormField
                        control={form.control}
                        name="createNumeraProfile"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Create Numera Profile</FormLabel>
                                    <FormDescription>
                                        This will create a full accounting profile for this client in the Numera module.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={client?.hasNumeraProfile || false}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                        />
                </div>

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Task Automation Setup</h3>
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormDescription>This is optional if you do not use task automation.</FormDescription><FormMessage /></FormItem>)} />
                    
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
                            <FormItem className="flex flex-col"><FormLabel>Financials Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    )}

                    <FormField control={form.control} name="requiresManagementAccounts" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Do you require management accounts?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                     {watchRequiresMgmt && (
                        <FormField control={form.control} name="managementAccountsDueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    )}
                    
                    <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Are you registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    {watchIsVatRegistered && (
                        <div className="grid grid-cols-1 gap-4">
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
                        </div>
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
                            <FormItem className="flex flex-col"><FormLabel>Payroll Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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
