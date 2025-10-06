
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '../ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { sendEmail } from '@/lib/email';
import { users } from '@/lib/data'; // Import static user data

const formSchema = z.object({
  smtpDetails: z.object({
      host: z.string(),
      port: z.string(),
      user: z.string(),
      pass: z.string(),
  }),
  testEmail: z.string().email('Please enter a valid email to send a test to.'),
});

export default function EmailSettingsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  // Get the specific SMTP settings for no_reply@myacc.co.za
  const systemSmtpConfig = users.find(u => u.email === 'kev@thinkestry.co.za')?.smtpDetails;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      smtpDetails: { 
          host: systemSmtpConfig?.host || '', 
          port: systemSmtpConfig?.port || '', 
          user: systemSmtpConfig?.user || '', 
          pass: systemSmtpConfig?.pass || ''
      },
      testEmail: user?.email || '',
    },
  });

  async function onTestEmail() {
    const testEmailAddress = form.getValues('testEmail');
     if (!testEmailAddress) {
      form.setError('testEmail', { message: 'Please enter a valid email to send a test to.' });
      return;
    }
    
    setIsTesting(true);
    toast({
        title: 'Sending Test Email...',
        description: 'Please wait a moment.'
    });

    try {
        await sendEmail({
            to: testEmailAddress,
            subject: 'SMTP Settings Test from My Accountant',
            html: `<p>This is a test email to confirm your SMTP settings are working correctly.</p>`,
        });
        toast({
            title: 'Test Email Sent!',
            description: `An email has been sent to ${testEmailAddress}. Please check your inbox.`,
        });
    } catch (error) {
        console.error("Failed to send test email:", error);
        toast({
            title: 'Test Failed',
            description: 'Could not send test email. Please check your SMTP credentials and try again.',
            variant: 'destructive',
        });
    } finally {
        setIsTesting(false);
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-8">
        <div className="space-y-4">
            <h3 className="text-lg font-medium">System SMTP Details (Read-Only)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="smtpDetails.host" render={({ field }) => ( <FormItem><FormLabel>SMTP Host</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.port" render={({ field }) => ( <FormItem><FormLabel>SMTP Port</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.user" render={({ field }) => ( <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.pass" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Secure SSL/TLS Settings (Recommended)</h3>
            <div className="flex items-center space-x-2 rounded-md border border-green-500 bg-green-50 p-4">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                    A secure SSL/TLS connection is enabled and enforced for all outgoing emails.
                </p>
            </div>
        </div>
        
        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Test Settings</h3>
            <FormField control={form.control} name="testEmail" render={({ field }) => ( <FormItem><FormLabel>Recipient Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="button" variant="outline" onClick={onTestEmail} disabled={isTesting}>
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Test Email
            </Button>
        </div>
      </form>
    </Form>
  );
}
