
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
import { Loader2, ShieldCheck, Rocket, Wallet, Building, Landmark, CheckCircle, AlertTriangle, FileText, BotMessageSquare, LifeBuoy, GraduationCap, CalendarCheck2, FileWarning, BadgeDollarSign, FileUp, Phone, Mail, Clock } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


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

function ComplianceFormCard({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
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

      form.reset();
      onComplete();

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

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} placeholder="e.g., ABC (Pty) Ltd" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="registrationNumber" render={({ field }) => ( <FormItem><FormLabel>Company Registration Number</FormLabel><FormControl><Input {...field} placeholder="e.g., 2024/123456/07" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="sarsUsername" render={({ field }) => ( <FormItem><FormLabel>SARS e-Filing Username (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="sarsPassword" render={({ field }) => ( <FormItem><FormLabel>SARS e-Filing Password (Optional)</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <h3 className="text-lg font-medium pt-4">Your Contact Details</h3>
            <FormField control={form.control} name="yourName" render={({ field }) => ( <FormItem><FormLabel>Your Full Name</FormLabel><FormControl><Input {...field} placeholder="John Doe" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="yourEmail" render={({ field }) => ( <FormItem><FormLabel>Your Email Address</FormLabel><FormControl><Input type="email" {...field} placeholder="name@example.com" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="yourPhone" render={({ field }) => ( <FormItem><FormLabel>Your Phone Number</FormLabel><FormControl><Input type="tel" {...field} placeholder="0821234567" /></FormControl><FormMessage /></FormItem> )}/>
            <Button type="submit" disabled={isLoading || isStaffLoading} className="w-full">
            {(isLoading || isStaffLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Submitting...' : 'Sign up, get my free compliance assessment and 5% discount'}
            </Button>
        </form>
    </Form>
  )
}

export default function CompliancePage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleFormComplete = () => {
    setIsFormOpen(false);
    setIsComplete(true);
  }

  const whyChooseUs = [
    {
      title: 'Same-day service options',
      description: 'for urgent SARS or CIPC filings.',
      icon: Rocket,
    },
    {
      title: 'Affordable pricing',
      description: 'no hidden fees, just transparent packages.',
      icon: Wallet,
    },
    {
      title: 'Trusted experts',
      description: 'over 150 five-star reviews from South African businesses.',
      icon: ShieldCheck,
    },
      {
      title: 'Free compliance assessment',
      description: 'includes a SARS & CIPC health check (valued at R250).',
      icon: CalendarCheck2,
    },
    {
      title: 'All-in-one platform',
      description: 'track orders, upload documents, and get instant updates online.',
      icon: FileUp,
    },
     {
      title: 'Common mistakes fixed',
      description: 'We identify and correct issues before they affect your business.',
      icon: FileWarning,
    },
  ];

  return (
     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <div className="space-y-6 pb-16">
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
                <DialogTrigger asChild>
                    <Button size="lg">Get My Free Assessment</Button>
                </DialogTrigger>
                </div>
            </div>
            </div>
        </section>

        <TrustIndexWidget />

        <section className="bg-background py-16">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold">🧾 SARS & CIPC Compliance</h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    Stay compliant. Stay confident.
                    </p>
                </div>
                <p className="text-lg text-center max-w-3xl mx-auto text-muted-foreground">
                    Running a business in South Africa means keeping up with both SARS (South African Revenue Service) and CIPC (Companies and Intellectual Property Commission) regulations. At My Accountant, we take the stress out of compliance — so you can focus on growth while we handle the paperwork.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3"><Landmark className="h-6 w-6 text-primary"/> SARS Compliance</CardTitle>
                        <CardDescription>We make sure your business meets all SARS tax obligations — on time, every time.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                        <h4 className="font-semibold">Outstanding Returns & Debt</h4>
                        <p className="text-sm text-muted-foreground mt-1">Missed deadlines happen — but SARS penalties add up fast. We help you bring your company’s tax affairs up to date.</p>
                        <ul className="mt-3 space-y-2 text-sm grid grid-cols-1 gap-x-4">
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Filing all outstanding Income Tax, VAT, and PAYE returns</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Resolving late submission penalties and interest</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Set up payment arrangements or compromise applications</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Reconciling your tax accounts to ensure future compliance</li>
                        </ul>
                        </div>
                    </CardContent>
                    </Card>

                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3"><Building className="h-6 w-6 text-primary"/> CIPC Compliance</CardTitle>
                        <CardDescription>Keep your company active and legally protected with our CIPC services.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                        <h4 className="font-semibold">Annual Returns & Maintenance</h4>
                        <p className="text-sm text-muted-foreground mt-1">Every registered company must file its annual returns with CIPC each year to remain active. Failure to do so can result in deregistration, which means your company bank accounts may be frozen and contracts rendered invalid.</p>
                        <ul className="mt-3 space-y-2 text-sm grid grid-cols-1 gap-x-4">
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Submission of all outstanding annual returns</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Reactivation of deregistered companies</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Amendments to director details, company name, or address</li>
                            <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> Preparing and submitting your Beneficial Ownership Declaration</li>
                        </ul>
                        </div>
                    </CardContent>
                    </Card>
                </div>

                <div className="text-center mt-16 max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold">🌟 Why Choose My Accountant?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                        {whyChooseUs.map((item) => (
                            <div key={item.title} className="text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                                        <item.icon className="h-8 w-8 text-primary" />
                                    </div>
                                </div>
                                <h4 className="font-bold text-lg">{item.title}</h4>
                                <p className="text-muted-foreground text-sm">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center mt-16 max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold">🚀 Ready to Get Compliant?</h2>
                    <p className="text-lg text-muted-foreground mt-4">Take the hassle out of SARS and CIPC compliance with professionals who care. Start your compliance journey today — fast, affordable, and fully online.</p>
                    <div className="mt-8">
                        <DialogTrigger asChild>
                            <Button size="lg">Book a Free Compliance Check</Button>
                        </DialogTrigger>
                        <p className="mt-4 text-sm text-muted-foreground">
                            Or contact us: <Phone className="inline h-4 w-4 mr-1"/> <a href="tel:0108244360" className="hover:underline">010 824 4360</a> | <Mail className="inline h-4 w-4 ml-2 mr-1"/> <a href="mailto:info@myacc.co.za" className="hover:underline">info@myacc.co.za</a>
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {isComplete && (
             <section className="container mx-auto max-w-2xl px-4 py-12 scroll-m-20">
                <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Thank You!</AlertTitle>
                    <AlertDescription>
                        Your request has been submitted. One of our consultants will contact you within 24 hours with the results of your free compliance check. We have also sent a welcome email with your 5% discount code.
                    </AlertDescription>
                </Alert>
             </section>
        )}
        
        </div>
        <DialogContent className="sm:max-w-xl">
             <DialogHeader>
                <DialogTitle>Free Compliance Assessment</DialogTitle>
                <DialogDescription>
                Enter your details below and we'll perform a free, no-obligation compliance check for your company.
                </DialogDescription>
            </DialogHeader>
            <ComplianceFormCard onComplete={handleFormComplete} />
        </DialogContent>
     </Dialog>
  );
}
