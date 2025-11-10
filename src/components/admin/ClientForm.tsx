
'use client';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, ChartOfAccount } from '@/lib/types';
import { Trash2, PlusCircle } from 'lucide-react';
import { Separator } from '../ui/separator';

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

const getFormSchema = (isAIClient: boolean) => z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email('Invalid email address.').optional(),
  contactNumber: z.string().optional(),
  
  // AI Client Specific Fields
  companyName: isAIClient ? z.string().min(2, 'Company name is required.') : z.string().optional(),
  yearEnd: isAIClient ? z.string().min(1, "Financial year end is required.") : z.string().optional(),
  isVatRegistered: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  enableInvoicing: z.boolean().default(false),
  logoUrl: z.string().url("Invalid URL").optional(),
  address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      zip: z.string().optional(),
  }).optional(),
   bankingDetails: z.object({
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      branchCode: z.string().optional(),
  }).optional(),
}).refine(data => {
    if (data.isVatRegistered) {
      return data.vatNumber && data.vatNumber.length > 0;
    }
    return true;
}, {
    message: "VAT number is required if the client is VAT registered.",
    path: ["vatNumber"],
});


export default function ClientForm({ client, onSubmit, onCancel, isAIClient = false }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void, isAIClient?: boolean }) {
    const formSchema = getFormSchema(isAIClient);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: client?.name || '',
            email: client?.email || '',
            contactPerson: client?.contactPerson || '',
            contactEmail: client?.contactEmail || '',
            contactNumber: client?.contactNumber || '',
            companyName: client?.companyName || '',
            yearEnd: client?.yearEnd || 'February',
            isVatRegistered: client?.isVatRegistered || false,
            vatNumber: client?.vatNumber || '',
            vatCategory: client?.vatCategory || 'B',
            enableInvoicing: client?.enableInvoicing || false,
            logoUrl: client?.logoUrl || '',
            address: client?.address || { street: '', city: '', province: '', zip: ''},
            bankingDetails: client?.bankingDetails || { bankName: '', accountHolder: '', accountNumber: '', branchCode: ''},
        },
    });
    
    const isVatRegistered = form.watch('isVatRegistered');
    const enableInvoicing = form.watch('enableInvoicing');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <h3 className="text-lg font-medium">Contact Details</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client Name / Trading Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Primary Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     {isAIClient && (
                         <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Registered Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     )}
                     <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="contactEmail" render={({ field }) => ( <FormItem><FormLabel>Secondary Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                 </div>
                
                {isAIClient && (
                    <>
                    <Separator />
                     <h3 className="text-lg font-medium">Compliance Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                         <FormField control={form.control} name="isVatRegistered" render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Is VAT registered?</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
                     </div>
                      {isVatRegistered && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="vatNumber" render={({ field }) => ( <FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{['A', 'B', 'C'].map(cat => <SelectItem key={cat} value={cat}>Category {cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                     )}

                    <Separator />
                    <h3 className="text-lg font-medium">Invoicing Settings</h3>
                     <FormField control={form.control} name="enableInvoicing" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Enable Invoicing Module</FormLabel><FormDescription>Allow this client to create and send invoices.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
                    {enableInvoicing && (
                        <div className="space-y-4">
                             <FormField control={form.control} name="logoUrl" render={({ field }) => ( <FormItem><FormLabel>Company Logo URL</FormLabel><FormControl><Input placeholder="https://example.com/logo.png" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel>Street</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                 <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel>Province</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                 <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                 <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                 <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                             </div>
                        </div>
                    )}
                    </>
                )}


                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    );
}

    