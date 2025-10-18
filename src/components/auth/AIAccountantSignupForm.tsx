
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
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  yearEnd: z.string().min(3, 'Financial year end is required.'),
  isVatRegistered: z.boolean().default(false),
});

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];


export default function AIAccountantSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      email: '',
      password: '',
      yearEnd: 'February',
      isVatRegistered: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const { password, ...clientData } = values;

        const rulesQuery = query(collection(db, 'allocationRules'), orderBy('description'));
        const rulesSnapshot = await getDocs(rulesQuery);
        const globalRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;
        const authUid = newFirebaseUser.uid;

        const newUserDocRef = doc(db, "aiAccountantClients", authUid);
        await setDoc(newUserDocRef, {
            ...clientData,
            name: values.companyName,
            id: authUid,
            uid: authUid,
            role: 'client',
            source: 'AI Accountant',
            hasNumeraProfile: true,
            chartOfAccounts: initialChartOfAccounts,
            allocationRules: globalRules,
            createdAt: serverTimestamp(),
        });
        
        await login(values.email, values.password);

        toast({
            title: 'Account Created!',
            description: `Welcome! Your AI Accountant profile is ready. Redirecting to your dashboard...`,
        });
        
        router.push('/admin/ai-accountant');

    } catch (error: any) {
        let description = 'There was a problem creating your account. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email address already exists. Please log in instead.';
        }
        toast({ title: 'Signup Failed', description, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
        
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create My AI Accountant Profile
        </Button>
      </form>
    </Form>
  );
}
