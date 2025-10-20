
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
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import MediaLibrary from './MediaLibrary';
import { useState } from 'react';
import { Images, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const storage = getStorage(firebaseApp);

const clientStatuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const vatCategories: { value: 'A' | 'B' | 'C'; label: string }[] = [
    { value: 'A', label: 'Category A (Odd Months)' },
    { value: 'B', label: 'Category B (Even Months)' },
    { value: 'C', label: 'Category C (Monthly)' },
];


const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client/Company name is required.'),
  contactPerson: z.string().min(2, 'Contact person name is required.'),
  email: z.string().email('A valid email address is required.'),
  
  // Fields for non-AI clients
  yearEnd: z.string().optional(),
  isVatRegistered: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  cellNumber: z.string().optional(),
  status: z.enum(clientStatuses).optional(),
  
  // Invoicing fields
  enableInvoicing: z.boolean().default(false),
  address: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  nextInvoiceNumber: z.preprocess(val => Number(val) || 1, z.number().min(1)),
  bankingDetails: z.object({
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      branchCode: z.string().optional(),
  }).optional(),
});

export default function ClientForm({ 
    client, 
    onSubmit, 
    onCancel, 
    isAIClient = false 
}: { 
    client: Partial<User> | null, 
    onSubmit: (data: any) => void, 
    onCancel: () => void, 
    isAIClient?: boolean,
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || client?.companyName || '',
            contactPerson: client?.contactPerson || '',
            email: client?.email || '',
            
            // Non-AI Accountant fields
            yearEnd: client?.yearEnd || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatNumber: (client as any)?.vatNumber || '',
            vatCategory: (client as any)?.vatCategory || undefined,
            cellNumber: client?.contactNumber || '',
            status: client?.status || 'Active',
            
            // Invoicing fields
            enableInvoicing: client?.enableInvoicing || false,
            address: typeof client?.address === 'string' ? client.address : (client?.address ? `${client.address.street}, ${client.address.city}` : ''),
            logoUrl: client?.logoUrl || '',
            nextInvoiceNumber: client?.nextInvoiceNumber || 9000,
            bankingDetails: {
                bankName: client?.bankingDetails?.bankName || '',
                accountHolder: client?.bankingDetails?.accountHolder || '',
                accountNumber: client?.bankingDetails?.accountNumber || '',
                branchCode: client?.bankingDetails?.branchCode || '',
            }
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const enableInvoicing = form.watch('enableInvoicing');
    const currentLogoUrl = form.watch('logoUrl');

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setIsUploadingLogo(true);
        toast({ title: 'Uploading Logo...', description: 'Please wait.' });

        const storageRef = ref(storage, `logos/${user.uid}/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                // Can be used to show progress
            },
            (error) => {
                console.error("Logo upload error:", error);
                toast({ title: "Upload Failed", description: "Could not upload the logo.", variant: "destructive" });
                setIsUploadingLogo(false);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    form.setValue('logoUrl', downloadURL);
                    toast({ title: "Upload Successful", description: "Logo has been uploaded." });
                    setIsUploadingLogo(false);
                });
            }
        );
    };

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        const finalValues = {
            ...values,
            email: values.email || `${values.name.toLowerCase().replace(/\s/g, '.')}@myacc.co.za`,
        }
        onSubmit(finalValues);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Customer Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Customer / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="e.g. 0821234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    {!isAIClient && ( <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />)}
                </div>

                {isAIClient && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Accounting Setup</h3>
                            <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            
                            <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5"><FormLabel>Is the client registered for VAT?</FormLabel></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />

                            {isVatRegistered && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormField control={form.control} name="vatNumber" render={({ field }) => ( <FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input placeholder="4..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                </div>
                            )}
                        </div>
                        <Separator />
                         <div className="space-y-4">
                            <h3 className="text-lg font-medium">Invoicing Setup</h3>
                            <p className="text-sm text-muted-foreground">Only complete this section if you want to generate invoices from this company profile.</p>
                             <FormField control={form.control} name="enableInvoicing" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5"><FormLabel>Enable Invoicing</FormLabel><FormDescription>Allow invoices to be generated for this client.</FormDescription></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />

                            {enableInvoicing && (
                                <div className="space-y-4 pt-4 border-t">
                                     <FormItem>
                                        <FormLabel>Company Logo</FormLabel>
                                        <div className="flex items-center gap-4">
                                            <div className="relative h-24 w-24 flex-shrink-0 border rounded-md overflow-hidden bg-muted">
                                                {isUploadingLogo ? (
                                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                                                ) : currentLogoUrl ? (
                                                    <Image src={currentLogoUrl} alt="Company logo" fill className="object-contain p-2"/>
                                                ) : null}
                                            </div>
                                            <FormControl><Input type="file" accept="image/*" onChange={handleLogoUpload} className="max-w-xs" /></FormControl>
                                        </div>
                                        <FormMessage />
                                     </FormItem>
                                     <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Company Address</FormLabel><FormControl><Textarea placeholder="123 Main Street..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="nextInvoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Next Invoice Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                     
                                     <h4 className="font-medium text-base pt-2">Banking Details for Invoices</h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}


                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}
