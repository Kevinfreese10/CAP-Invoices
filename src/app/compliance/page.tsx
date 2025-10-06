

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
import { Loader2, ShieldCheck } from 'lucide-react';
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
  const [isComplete, setIsComplete] = useState(false);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const { user } = useAuth(); // Can be null on a public page

  useEffect(() => {
    const fetchStaff = async () => {
        try {
            const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "admin"]));
            const staffSnapshot = await getDocs(staffQuery);
            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
            setAllStaff(fetchedStaff);
        } catch(e) {
            console.error("Could not fetch staff for task assignment", e);
        }
    };
    fetchStaff();
  }, []);

  const getNextAdminStaff = (): User | undefined => {
      const adminStaff = allStaff.filter(u => u.department === 'Administration' && (u.role === 'staff' || u.role === 'admin'));
      if (adminStaff.length === 0) return undefined;
      // Simple round-robin for this example. In a real app, you might use a more sophisticated method.
      const nextStaff = adminStaff[Math.floor(Math.random() * adminStaff.length)];
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
      const assignedStaff = getNextAdminStaff();
      if (assignedStaff) {
          const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
          
          // Ensure createdBy is always valid. If no one is logged in, assign creator to be the assignee.
          const creatorId = user?.uid || assignedStaff.uid;

          const taskData: Omit<Task, 'id'> = {
              title: `Follow up on Compliance Assessment for ${values.companyName}`,
              description: `A new compliance assessment request has been submitted by ${values.yourName} (${values.yourEmail}). Please review and follow up.`,
              assignedTo: [assignedStaff.uid],
              status: 'To-Do',
              priority: 'Medium',
              dueDate: Timestamp.fromDate(dueDate),
              createdBy: creatorId, 
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
      } else {
          toast({
              title: 'Warning',
              description: 'No admin staff available to assign a follow-up task.',
              variant: 'destructive',
          });
      }

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

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight">Free Compliance Check</h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
                Ensure your business is compliant with CIPC and SARS. Enter your details below for a free, no-obligation compliance assessment.
            </p>
        </div>
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
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Submitting...' : 'Sign up, get my free compliance assessment and 5% discount'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
