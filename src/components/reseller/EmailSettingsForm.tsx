
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
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { sendEmail } from '@/lib/email';

const formSchema = z.object({
  smtpDetails: z.object({
      host: z.string().min(3, 'SMTP host is required.'),
      port: z.string().min(2, 'SMTP port is required.'),
      user: z.string().min(1, 'SMTP username is required.'),
      pass: z.string().min(1, 'SMTP password is required.'),
  }),
  testEmail: z.string().email('Please enter a valid email to send a test to.'),
});

export default function EmailSettingsForm() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      smtpDetails: { 
          host: user?.smtpDetails?.host || '', 
          port: user?.smtpDetails?.port || '', 
          user: user?.smtpDetails?.user || '', 
          pass: user?.smtpDetails?.pass || ''
      },
      testEmail: user?.email || '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    console.log('Updating SMTP settings:', values);
    setTimeout(() => {
        // In a real app, this would be a call to your backend to save the details.
        // For this demo, we'll just update the user in the context.
        if (user) {
            const updatedUser = {
                ...user,
                smtpDetails: values.smtpDetails,
            };
            // This is a mock login to update the user state in the context
            login(updatedUser.email);
        }
        toast({
            title: 'Settings Saved!',
            description: `Your SMTP settings have been updated.`,
        });
        setIsSaving(false);
    }, 1500)
  }

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
            subject: 'SMTP Settings Test',
            html: `<p>This is a test email to confirm your SMTP settings are working correctly.</p>`,
            resellerId: user?.id,
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
            <h3 className="text-lg font-medium">SMTP Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="smtpDetails.host" render={({ field }) => ( <FormItem><FormLabel>SMTP Host</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.port" render={({ field }) => ( <FormItem><FormLabel>SMTP Port</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.user" render={({ field }) => ( <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="smtpDetails.pass" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
        <Separator />
        
        <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
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
