
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
import { Loader2, Sparkles, CheckCheck, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { differenceInMonths, startOfMonth } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { Order, User } from '@/lib/types';
import { getNextOrderId } from '@/lib/sequence';
import { Timestamp } from 'firebase/firestore';
import { generatePayFastSignature } from '@/app/actions/payfast';


const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

const formSchema = z.object({
  name: z.string().min(2, 'First name is required.'),
  surname: z.string().min(2, 'Surname is required.'),
  cellNumber: z.string().min(10, 'A valid cell number is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  yearEnd: z.string().min(1, 'Financial year end is required.'),
  isVatRegistered: z.boolean().default(false),
  serviceLevel: z.enum(['free', 'ai_addon', 'monthly_non_vat', 'monthly_vat']).default('free'),
  extraUsers: z.preprocess(val => Number(val) || 0, z.number().min(0).optional()),
  includeSubmissions: z.boolean().default(false),
  includePayslips: z.boolean().default(false),
  payslipCount: z.preprocess(val => Number(val) || 0, z.number().min(0).optional()),
  includeCatchUp: z.boolean().default(true),
});

const pricing = {
  free: 0,
  ai_addon: 450,
  monthly_non_vat: 950,
  monthly_vat: 1950,
  extraUser: 50,
  payrollSetup: 950,
  payrollSubmissions: 550,
  perPayslip: 110,
};


export default function AIAccountantSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [catchUpFee, setCatchUpFee] = useState(0);
  const [payrollSetupFee, setPayrollSetupFee] = useState(0);
  const [payfastFormData, setPayfastFormData] = useState<{ [key: string]: string } | null>(null);
  const { login } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      surname: '',
      cellNumber: '',
      email: '',
      password: '',
      yearEnd: 'February',
      isVatRegistered: false,
      serviceLevel: 'free',
      extraUsers: 0,
      includeSubmissions: false,
      includePayslips: false,
      payslipCount: 0,
      includeCatchUp: true,
    },
  });

  const watchedValues = form.watch();
  
  const totalOnceOffFees = catchUpFee + payrollSetupFee;

  useEffect(() => {
    const { serviceLevel, extraUsers, includeSubmissions, includePayslips, payslipCount, yearEnd, includeCatchUp } = watchedValues;
    
    // Calculate Monthly Total
    let total = 0;
    if (serviceLevel in pricing) {
      total += pricing[serviceLevel as keyof typeof pricing];
    }
    total += (extraUsers || 0) * pricing.extraUser;
    if (includeSubmissions) {
      total += pricing.payrollSubmissions;
    }
    if (includePayslips) {
      total += (payslipCount || 0) * pricing.perPayslip;
    }
    setMonthlyTotal(total);

    // Calculate Payroll Setup Fee
    setPayrollSetupFee(includePayslips ? pricing.payrollSetup : 0);
    
    // Calculate Catch-up Fee
    const isMonthlyAccountingPlan = serviceLevel === 'monthly_non_vat' || serviceLevel === 'monthly_vat';
    
    if (isMonthlyAccountingPlan && yearEnd && includeCatchUp) {
        const planFeeForCatchup = pricing[serviceLevel as 'monthly_non_vat' | 'monthly_vat'];
        const today = new Date();
        const currentYear = today.getFullYear();
        const yearEndMonthIndex = months.indexOf(yearEnd);
        
        let prevYearEnd = new Date(currentYear, yearEndMonthIndex, 1);
        if (today < prevYearEnd) {
            prevYearEnd.setFullYear(currentYear - 1);
        }

        const financialYearStart = startOfMonth(new Date(prevYearEnd.getFullYear(), prevYearEnd.getMonth() + 1, 1));
        
        const monthsPassed = differenceInMonths(today, financialYearStart);
        
        const calculatedFee = (planFeeForCatchup * Math.max(0, monthsPassed)) / 2;
        setCatchUpFee(calculatedFee);
    } else {
        setCatchUpFee(0);
    }

  }, [watchedValues]);

   useEffect(() => {
    if (payfastFormData) {
      const formElement = document.getElementById('payfast-redirect-form') as HTMLFormElement;
      if (formElement) {
        formElement.submit();
      }
    }
  }, [payfastFormData]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    
    if (totalOnceOffFees > 0) {
        // Create an order and redirect to PayFast
        toast({ title: 'Redirecting to Payment...', description: 'Please wait while we prepare your secure payment.' });
        try {
            const orderId = await getNextOrderId();
            const orderItems = [];
            if (catchUpFee > 0) {
                orderItems.push({ id: 'catch-up-fee', title: 'Accounting Catch-up Fee', price: catchUpFee, quantity: 1 });
            }
            if (payrollSetupFee > 0) {
                orderItems.push({ id: 'payroll-setup', title: 'Payroll Setup Fee', price: payrollSetupFee, quantity: 1 });
            }

            const orderData: any = {
                id: orderId,
                total: totalOnceOffFees,
                status: 'Pending Payment',
                date: Timestamp.now(),
                items: orderItems,
                // Store all signup data in the order to be used after payment
                signupData: values, 
                customerName: `${values.name} ${values.surname}`,
                customerEmail: values.email,
                source: 'AI Accountant Signup',
            };
            
            await setDoc(doc(db, 'orders', orderId), orderData);
            
             const dataForSignature = {
                merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
                merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${orderId}`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai-accountant-signup`,
                notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                email_address: values.email,
                m_payment_id: orderId,
                amount: totalOnceOffFees.toFixed(2),
                item_name: `Once-off fees for My Accountant`,
             };

            const signature = await generatePayFastSignature(dataForSignature);
            setPayfastFormData({ ...dataForSignature, signature });
            
        } catch (error) {
            console.error("Order creation for payment failed:", error);
            toast({ title: 'Error', description: 'Could not create your order for payment. Please try again.', variant: 'destructive'});
            setIsLoading(false);
        }
    } else {
        // No once-off fees, proceed with direct signup
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
                name: `${values.name} ${values.surname}`,
                companyName: `${values.name} ${values.surname}`,
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
                    payrollSetupFee: payrollSetupFee,
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
                description = 'An account with this email already exists. Please log in instead.';
            }
            toast({ title: 'Signup Failed', description, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }
  }
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };
  
  const handleNextStep = async () => {
    const isValid = await form.trigger(['name', 'surname', 'cellNumber', 'email', 'password', 'yearEnd']);
    if (isValid) {
      setStep(2);
    }
  };


  return (
    <>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="isVatRegistered" render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Are you VAT registered?</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
                            </div>
                            <Button type="button" onClick={handleNextStep} className="w-full">Next</Button>
                        </div>
                    )}
                    
                    {step === 2 && (
                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="serviceLevel"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                    <FormLabel>Select Your Plan</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
                                            <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer"><RadioGroupItem value="free" id="free" /><div><span className="font-semibold">Free Plan</span><p className="text-sm text-muted-foreground">1 company, 1 user, basic features.</p></div></Label>
                                            <Label className="flex items-center space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer"><RadioGroupItem value="ai_addon" id="ai_addon" /><div><span className="font-semibold">AI Accountant Add-on (R450 / month)</span><p className="text-sm text-muted-foreground">Unlock AI-powered automation for your company.</p></div></Label>
                                            {!watchedValues.isVatRegistered && (
                                                <Label className="flex flex-col items-start space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="monthly_non_vat" id="monthly_non_vat" />
                                                        <div>
                                                            <span className="font-semibold">Monthly Accounting - Non-VAT (R950 / month)</span>
                                                            <p className="text-sm text-muted-foreground">Includes AI Accountant & full bookkeeping service.</p>
                                                        </div>
                                                    </div>
                                                    <div className="pl-8 pt-2 text-sm text-muted-foreground">
                                                        <p className="font-medium text-foreground pb-1">Includes:</p>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            <li>Monthly management accounts</li>
                                                            <li>Annual financial statements</li>
                                                            <li>Provisional tax returns</li>
                                                            <li>Annual income tax return</li>
                                                            <li>CIPC annual return</li>
                                                            <li>B-BBEE certificate or affidavit</li>
                                                            <li>Beneficial ownership declaration</li>
                                                            <li>Tax clearance certificate</li>
                                                        </ul>
                                                    </div>
                                                </Label>
                                            )}
                                            {watchedValues.isVatRegistered && (
                                                <Label className="flex flex-col items-start space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="monthly_vat" id="monthly_vat" />
                                                        <div>
                                                            <span className="font-semibold">Monthly Accounting - VAT (R1950 / month)</span>
                                                            <p className="text-sm text-muted-foreground">Full-suite service for VAT-registered companies.</p>
                                                        </div>
                                                    </div>
                                                    <div className="pl-8 pt-2 text-sm text-muted-foreground">
                                                        <p className="font-medium text-foreground pb-1">Includes:</p>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            <li>Monthly management accounts</li>
                                                            <li>Annual financial statements</li>
                                                            <li>Provisional tax returns</li>
                                                            <li>Annual income tax return</li>
                                                            <li>CIPC annual return</li>
                                                            <li>B-BBEE certificate or affidavit</li>
                                                            <li>Beneficial ownership declaration</li>
                                                            <li>Tax clearance certificate</li>
                                                            <li>VAT returns</li>
                                                        </ul>
                                                    </div>
                                                </Label>
                                            )}
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
                                <FormField control={form.control} name="includeSubmissions" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel>Monthly Payroll Submissions (EMP201)<br/><span className="text-xs text-muted-foreground">(+R550 per month)</span></FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="includePayslips" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel>Process Payslips<br/><span className="text-xs text-muted-foreground">(+R110 per payslip)</span></FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                {watchedValues.includePayslips && (<FormField control={form.control} name="payslipCount" render={({ field }) => ( <FormItem className="flex items-center justify-between pl-6"><FormLabel>Number of Payslips</FormLabel><FormControl><Input type="number" className="w-24" {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                            </div>
                            
                            {(watchedValues.serviceLevel === 'monthly_non_vat' || watchedValues.serviceLevel === 'monthly_vat') && (
                                <div className="p-3 border rounded-md">
                                    <FormField
                                        control={form.control}
                                        name="includeCatchUp"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center space-x-3">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="!mt-0">Include optional once-off catch-up fee?</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    {!watchedValues.includeCatchUp && (
                                        <Alert variant="destructive" className="mt-2 text-xs">
                                        <AlertDescription>
                                            By opting out, bookkeeping services will only commence from the current month. Prior months will not be processed.
                                        </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                            
                            <Separator />
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg"><h4 className="text-lg font-bold">Estimated Monthly Total:</h4><p className="text-2xl font-bold">{formatPrice(monthlyTotal)}</p></div>
                                
                                {totalOnceOffFees > 0 && (
                                    <div className="flex justify-between items-center bg-amber-100 p-4 rounded-lg border border-amber-300">
                                        <h4 className="text-lg font-bold text-amber-800">Total Once-Off Fees:</h4>
                                        <p className="text-2xl font-bold text-amber-900">{formatPrice(totalOnceOffFees)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4"/>}{totalOnceOffFees > 0 ? `Pay Once-Off Fees & Create Profile` : 'Create My Profile'}</Button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </form>
        </Form>
        {payfastFormData && (
            <form id="payfast-redirect-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" style={{ display: 'none' }}>
                {Object.entries(payfastFormData).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                ))}
            </form>
      )}
    </>
  );
}
