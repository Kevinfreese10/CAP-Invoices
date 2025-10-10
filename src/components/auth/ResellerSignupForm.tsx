
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState } 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';


const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  contactPerson: z.string().min(2, 'Contact person is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
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
  agreeTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions.',
  }),
});

export default function ResellerSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { reauthenticate } = useAuth();
  const adminUser = auth.currentUser;


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      contactPerson: '',
      email: '',
      password: '',
      contactNumber: '',
      address: { street: '', city: '', province: '', zip: ''},
      bankingDetails: { bankName: '', accountHolder: '', accountNumber: '', branchCode: ''},
      agreeTerms: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const { password, ...resellerData } = values;

        // 1. Create the user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;

        // 2. Save reseller data to Firestore in the 'users' collection
        await setDoc(doc(db, 'users', newFirebaseUser.uid), {
            ...resellerData,
            name: values.contactPerson, // Use contact person as the main name
            uid: newFirebaseUser.uid,
            role: 'reseller',
            status: 'Active',
        });
        
        // 3. Re-authenticate the original admin user if one was logged in
        if (adminUser) {
            await reauthenticate(adminUser);
        }

        toast({
            title: 'Application Received!',
            description: `Thank you, ${values.contactPerson}. Your reseller account has been created. Redirecting to login...`,
        });
        
        router.push('/login');

    } catch (error: any) {
        console.error("Reseller signup error:", error);
        toast({
            title: 'Signup Failed',
            description: error.message || 'There was a problem creating your account. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
            <h3 className="text-lg font-medium">Banking Details (for payouts)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
        <Separator />

        <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>
                        I agree to the <Link href="/popia" className="underline">terms and conditions</Link> of the reseller program.
                    </FormLabel>
                    <FormMessage />
                </div>
                </FormItem>
            )}
        />
        
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
        </Button>
      </form>
    </Form>
  );
}
