
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import SupplierWelcomeEmail from '../emails/SupplierWelcomeEmail';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Supplier Name is required.'),
  contactPerson: z.string().min(2, 'Contact person name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
});

export default function SupplierSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      contactPerson: '',
      email: '',
      password: '',
      contactNumber: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const { password, ...supplierData } = values;

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;
        const authUid = newFirebaseUser.uid;
        
        const newUserDocRef = doc(db, "users", authUid);
        await setDoc(newUserDocRef, {
            ...supplierData,
            name: values.companyName, // Use company name as the main name
            uid: authUid,
            id: authUid,
            role: 'supplier',
        });
        
        // Send welcome email
        try {
            const emailHtml = render(<SupplierWelcomeEmail
                contactPerson={values.contactPerson}
                companyName={values.companyName}
                loginUrl={`${process.env.NEXT_PUBLIC_APP_URL}/login`}
            />);
            await sendEmail({
                to: values.email,
                subject: `Welcome to the My Accountant Supplier Portal`,
                html: emailHtml,
                bcc: 'kev@thinkestry.co.za',
            });
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't block the user flow if email fails, just log it.
        }
        
        await login(values.email, values.password);

        toast({
            title: 'Account Created!',
            description: `Welcome, ${values.contactPerson}! Your supplier account is ready.`,
        });
        
        router.push('/supplier/dashboard');

    } catch (error: any) {
        console.error("Supplier signup error:", error);
        let description = 'There was a problem creating your account. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email address already exists. Please log in instead.';
        }
        toast({
            title: 'Signup Failed',
            description,
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Supplier Name</FormLabel><FormControl><Input placeholder="e.g. ABC Supplies (Pty) Ltd" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Supplier Account
        </Button>
      </form>
    </Form>
  );
}
