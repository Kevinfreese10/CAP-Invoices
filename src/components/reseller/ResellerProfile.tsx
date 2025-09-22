
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  contactPerson: z.string().min(2, 'Contact person is required.'),
  email: z.string().email('Please enter a valid email.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  address: z.object({
      street: z.string().min(3, 'Street address is required.'),
      city: z.string().min(2, 'City is required.'),
      province: z.string().min(2, 'Province is required.'),
      zip: z.string().min(4, 'Postal code is required.'),
  }),
  bankingDetails: z.object({
      bankName: z.string().min(3, 'Bank name is required.'),
      accountHolder: z.string().min(2, 'Account holder name is required.'),
      accountNumber: z.string().min(5, 'A valid account number is required.'),
      branchCode: z.string().min(6, 'A valid branch code is required.'),
  }),
});

export default function ResellerProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: user?.companyName || '',
      contactPerson: user?.contactPerson || '',
      email: user?.email || '',
      contactNumber: user?.contactNumber || '',
      address: { 
          street: user?.address?.street || '', 
          city: user?.address?.city || '', 
          province: user?.address?.province || '', 
          zip: user?.address?.zip || ''
      },
      bankingDetails: { 
          bankName: user?.bankingDetails?.bankName || '', 
          accountHolder: user?.bankingDetails?.accountHolder || '', 
          accountNumber: user?.bankingDetails?.accountNumber || '', 
          branchCode: user?.bankingDetails?.branchCode || ''
      },
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    // In a real app, you would submit this to your backend
    console.log('Updating reseller profile:', values);
    setTimeout(() => {
        toast({
            title: 'Profile Updated!',
            description: `Your company details have been saved.`,
        });
        setIsSaving(false);
    }, 1500)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Physical Address</h3>
            <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel>Province</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Banking Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
        <Separator />
        
        <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
        </Button>
      </form>
    </Form>
  );
}
