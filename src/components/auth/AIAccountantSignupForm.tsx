
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
import { useState, useEffect } from 'react';
import { Loader2, Sparkles, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { differenceInMonths, startOfMonth } from 'date-fns';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  yearEnd: z.string().optional(),
  serviceLevel: z.enum(['free', 'ai_addon', 'monthly_non_vat', 'monthly_vat']).default('free'),
  extraUsers: z.preprocess(val => Number(val) || 0, z.number().min(0).optional()),
  includeSubmissions: z.boolean().default(false),
  includePayslips: z.boolean().default(false),
  payslipCount: z.preprocess(val => Number(val) || 0, z.number().min(0).optional()),
});

const pricing = {
  free: 0,
  ai_addon: 290,
  monthly_non_vat: 950,
  monthly_vat: 1950,
  extraUser: 50,
  payrollSubmissions: 550,
  perPayslip: 110,
};


export default function AIAccountantSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [catchUpFee, setCatchUpFee] = useState(0);
  const { login } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      email: '',
      password: '',
      yearEnd: 'February',
      serviceLevel: 'free',
      extraUsers: 0,
      includeSubmissions: false,
      includePayslips: false,
      payslipCount: 0,
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    const { serviceLevel, extraUsers, includeSubmissions, includePayslips, payslipCount, yearEnd } = watchedValues;
    
    // Calculate Monthly Total
    let total = 0;
    total += pricing[serviceLevel];
    total += (extraUsers || 0) * pricing.extraUser;
    if (includeSubmissions) {
      total += pricing.payrollSubmissions;
    }
    if (includePayslips) {
      total += (payslipCount || 0) * pricing.perPayslip;
    }
    setMonthlyTotal(total);

    // Calculate Catch-up Fee
    const planFee = pricing[serviceLevel];
    if (planFee > 0 && yearEnd) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const yearEndMonthIndex = months.indexOf(yearEnd);
        
        let prevYearEnd = new Date(currentYear, yearEndMonthIndex, 1);
        if (today < prevYearEnd) {
            prevYearEnd.setFullYear(currentYear - 1);
        }

        const financialYearStart = startOfMonth(new Date(prevYearEnd.getFullYear(), prevYearEnd.getMonth() + 1, 1));
        
        const monthsPassed = differenceInMonths(today, financialYearStart);
        
        const calculatedFee = (planFee * Math.max(0, monthsPassed)) / 2;
        setCatchUpFee(calculatedFee);
    } else {
        setCatchUpFee(0);
    }

  }, [watchedValues]);


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
            subscription: {
                ...values,
                monthlyTotal: monthlyTotal,
                catchUpFee: catchUpFee,
            }
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
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />

        <Separator />
        
        <FormField
          control={form.control}
          name="serviceLevel"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Select Your Plan</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="space-y-2"
                >
                  <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="free" id="free" />
                    <div>
                      <span className="font-semibold">Free Plan</span>
                      <p className="text-sm text-muted-foreground">1 company, 1 user, basic features.</p>
                    </div>
                  </Label>
                   <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="ai_addon" id="ai_addon" />
                    <div>
                      <span className="font-semibold">AI Accountant Add-on (R290 / month)</span>
                      <p className="text-sm text-muted-foreground">Unlock AI-powered automation for your company.</p>
                    </div>
                  </Label>
                  <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="monthly_non_vat" id="monthly_non_vat" />
                    <div>
                      <span className="font-semibold">Monthly Accounting - Non-VAT (R950 / month)</span>
                      <p className="text-sm text-muted-foreground">Includes AI Accountant & full bookkeeping service.</p>
                    </div>
                  </Label>
                  <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="monthly_vat" id="monthly_vat" />
                     <div>
                      <span className="font-semibold">Monthly Accounting - VAT (R1950 / month)</span>
                      <p className="text-sm text-muted-foreground">Full-suite service for VAT-registered companies.</p>
                    </div>
                  </Label>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator />

         <div className="space-y-4">
            <h4 className="font-medium">Optional Add-ons</h4>
            <FormField control={form.control} name="extraUsers" render={({ field }) => ( <FormItem className="flex items-center justify-between"><FormLabel>Additional Users (+R50 per user)</FormLabel><FormControl><Input type="number" className="w-24" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField
                control={form.control}
                name="includeSubmissions"
                render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                    <FormLabel>Monthly Payroll Submissions (EMP201)<br/><span className="text-xs text-muted-foreground">(+R550 per month)</span></FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="includePayslips"
                render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                    <FormLabel>Process Payslips<br/><span className="text-xs text-muted-foreground">(+R110 per payslip)</span></FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )}
            />
            {watchedValues.includePayslips && (
                <FormField control={form.control} name="payslipCount" render={({ field }) => ( <FormItem className="flex items-center justify-between pl-6"><FormLabel>Number of Payslips</FormLabel><FormControl><Input type="number" className="w-24" {...field} /></FormControl><FormMessage /></FormItem>)} />
            )}
        </div>
        
        <Separator />

        <div className="space-y-3">
             {catchUpFee > 0 && (
                <div className="flex justify-between items-center bg-amber-100 p-4 rounded-lg border border-amber-300">
                    <h4 className="text-lg font-bold text-amber-800">Once-off Catch-up Fee:</h4>
                    <p className="text-2xl font-bold text-amber-900">{formatPrice(catchUpFee)}</p>
                </div>
            )}
            <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg">
                <h4 className="text-lg font-bold">Estimated Monthly Total:</h4>
                <p className="text-2xl font-bold">{formatPrice(monthlyTotal)}</p>
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4"/>}
            Create My AI Accountant Profile
        </Button>
      </form>
    </Form>
  );
}
