
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, Rocket, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFirestore, addDoc, doc, setDoc, serverTimestamp, collection, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { customAlphabet } from 'nanoid';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import WelcomeDiscountEmail from '@/components/emails/WelcomeDiscountEmail';
import { DiscountCode, Task, User } from '@/lib/types';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import Link from 'next/link';

const db = getFirestore(firebaseApp);
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

const complianceFormSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  registrationNumber: z.string().min(5, 'A valid registration number is required.'),
  sarsUsername: z.string().optional(),
  sarsPassword: z.string().optional(),
  yourName: z.string().min(2, 'Your name is required.'),
  yourEmail: z.string().email('A valid email is required.'),
  yourPhone: z.string().min(10, 'A valid phone number is required.'),
});

export default function CompliancePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [staffCounters, setStaffCounters] = useState<{ [key: string]: number }>({});
  
  useEffect(() => {
    const fetchStaff = async () => {
        setIsStaffLoading(true);
        try {
            const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "admin"]));
            const staffSnapshot = await getDocs(staffQuery);
            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            setAllStaff(fetchedStaff);
        } catch(e) {
            console.error("Could not fetch staff for task assignment", e);
        } finally {
            setIsStaffLoading(false);
        }
    };
    fetchStaff();
  }, []);

  const getNextAdminStaff = (): User | undefined => {
      const adminStaff = allStaff.filter(u => u.department === 'Administration' && (u.role === 'staff' || u.role === 'admin'));
      if (adminStaff.length === 0) return undefined;

      const currentIndex = staffCounters['Administration'] || 0;
      const nextStaff = adminStaff[currentIndex];
      
      setStaffCounters(prev => ({
          ...prev,
          ['Administration']: (currentIndex + 1) % adminStaff.length
      }));
      
      return nextStaff;
  }

  const form = useForm<z.infer<typeof complianceFormSchema>>({
    resolver: zodResolver(complianceFormSchema),
    defaultValues: {
      companyName: '',
      registrationNumber: '',
      sarsUsername: '',
      sarsPassword: '',
      yourName: '',
      yourEmail: '',
      yourPhone: '',
    },
  });

  const createTask = async (request: z.infer<typeof complianceFormSchema>) => {
    const assignedStaff = getNextAdminStaff();
    if (!assignedStaff || !assignedStaff.id) {
        console.error("No staff in Administration department to assign task or staff has no ID.");
        toast({
            title: 'Task Assignment Failed',
            description: 'Could not find an available staff member to handle your request. Please try again later.',
            variant: 'destructive',
        });
        throw new Error("Could not assign task: No valid staff member found.");
    }
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    const taskData: Omit<Task, 'id'> = {
        title: `Follow up on Compliance Assessment for ${request.companyName}`,
        description: `A new compliance assessment request has been submitted by ${request.yourName} (${request.yourEmail}). Please review and follow up.`,
        assignedTo: [assignedStaff.id],
        status: 'To-Do',
        priority: 'Medium',
        dueDate: Timestamp.fromDate(dueDate),
        createdBy: assignedStaff.id,
        createdAt: Timestamp.now(),
        comments: [],
    };
    await addDoc(collection(db, 'tasks'), taskData);

    if (assignedStaff.email) {
        const emailHtml = render(<NewTaskEmail 
            assigneeName={assignedStaff.name.split(' ')[0]}
            taskTitle={taskData.title}
            taskDescription={taskData.description}
            dueDate={format(dueDate, 'dd MMMM yyyy')}
            assignedBy={"System"}
            taskUrl={`${window.location.origin}/admin/dashboard`}
        />);
        await sendEmail({
            to: assignedStaff.email,
            subject: `New Task Assigned: ${taskData.title}`,
            html: emailHtml,
        });
    }

    toast({
        title: 'Task Created',
        description: `A follow-up task has been assigned to ${assignedStaff.name}.`
    });
  }

  async function handleSubmit(values: z.infer<typeof complianceFormSchema>) {
    setIsLoading(true);
    
    const discountCode = `WELCOME-${nanoid()}`;
    const discountData: Omit<DiscountCode, 'id'> = {
        percentage: 5,
        status: 'active',
        clientEmail: values.yourEmail,
        createdAt: serverTimestamp(),
    };

    try {
      // 1. Log the compliance request
      await addDoc(collection(db, 'complianceRequests'), {
        ...values,
        submittedAt: serverTimestamp(),
      });
      
      // 2. Create the discount code
      await setDoc(doc(db, 'discounts', discountCode), discountData);

      // 3. Create a task for an admin
      await createTask(values);

      // 4. Send the welcome email with the discount
      const emailHtml = render(<WelcomeDiscountEmail name={values.yourName} discountCode={discountCode} />);
      await sendEmail({
        to: values.yourEmail,
        subject: `Your Free Compliance Assessment & 5% Discount!`,
        html: emailHtml,
      });

      toast({
        title: 'Request Submitted!',
        description: "We've received your request and sent a welcome email with your discount code.",
      });

      setIsComplete(true);
      form.reset();

    } catch(error) {
       console.error("Compliance signup error:", error);
       toast({
        title: 'Error',
        description: 'There was a problem submitting your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const whyChooseUs = [
    {
      title: 'Expert & Reliable',
      description: 'Our team of seasoned professionals ensures accuracy and dependability.',
      icon: ShieldCheck,
    },
    {
      title: 'Affordable Pricing',
      description: 'Transparent, competitive rates with no hidden costs.',
      icon: Wallet,
    },
    {
      title: 'Fast Turnaround',
      description: 'We prioritize efficiency to meet your deadlines without compromising quality.',
      icon: Rocket,
    },
  ];

  return (
     <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              Free <span className="text-gradient">#Compliance</span> Check
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Ensure your business is compliant with CIPC and SARS. Enter your details below for a free, no-obligation compliance assessment and get 5% off your next service.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="#compliance-form">Get My Free Assessment</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="bg-background pt-16">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose My Accountant?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We're committed to providing you with the best service possible.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {whyChooseUs.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>
      
      <section id="compliance-form" className="container mx-auto max-w-2xl px-4 py-12 scroll-m-20">
        <Card>
            <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>All information is handled with strict confidentiality according to our POPIA policy.</CardDescription>
            </CardHeader>
            <CardContent>
            {isComplete ? (
                <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Thank You!</AlertTitle>
                <AlertDescription>
                    Your request has been submitted. One of our consultants will contact you within 24 hours with the results of your free compliance check. We have also sent a welcome email with your 5% discount code.
                </AlertDescription>
                </Alert>
            ) : (
                <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g., ABC (Pty) Ltd" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Company Registration Number</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g., 2024/123456/07" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="sarsUsername"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>SARS e-Filing Username (Optional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="sarsPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>SARS e-Filing Password (Optional)</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <h3 className="text-lg font-medium pt-4">Your Contact Details</h3>
                    <FormField
                    control={form.control}
                    name="yourName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Your Full Name</FormLabel>
                        <FormControl><Input {...field} placeholder="John Doe" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="yourEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Your Email Address</FormLabel>
                        <FormControl><Input type="email" {...field} placeholder="name@example.com" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="yourPhone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Your Phone Number</FormLabel>
                        <FormControl><Input type="tel" {...field} placeholder="0821234567" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={isLoading || isStaffLoading} className="w-full">
                    {(isLoading || isStaffLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Submitting...' : 'Sign up, get my free compliance assessment and 5% discount'}
                    </Button>
                </form>
                </Form>
            )}
            </CardContent>
        </Card>
      </section>
    </div>
  );
}

