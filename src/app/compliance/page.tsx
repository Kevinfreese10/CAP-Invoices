
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    console.log("Compliance Check Request:", values);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: 'Request Submitted!',
        description: "We've received your compliance check request and will be in touch shortly with your results.",
      });
      setIsLoading(false);
      setIsComplete(true);
      form.reset();
    }, 2000);
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
                Your request has been submitted. One of our consultants will contact you within 24 hours with the results of your free compliance check.
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
                  {isLoading ? 'Signing up...' : 'Sign up, get my free compliance assessment and 10% discount'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
