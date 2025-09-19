
'use server';

import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
});

export default async function ContactPage() {
  
  async function handleSubmit(formData: FormData) {
    'use server';
    const rawFormData = Object.fromEntries(formData.entries());
    const parsed = contactFormSchema.safeParse(rawFormData);

    if (!parsed.success) {
      console.error('Form validation failed:', parsed.error.flatten().fieldErrors);
      // You could potentially use a toast or state to show errors on the client
      return { success: false, errors: parsed.error.flatten().fieldErrors };
    }

    try {
      await sendEmail({
        to: 'your-email@example.com', // Replace with your actual email
        from: 'My Accountant Contact Form <noreply@yourdomain.com>', // Replace with a verified sender from Resend
        subject: `New Contact Form Submission from ${parsed.data.name}`,
        html: `
          <p><strong>Name:</strong> ${parsed.data.name}</p>
          <p><strong>Email:</strong> ${parsed.data.email}</p>
          <hr />
          <p><strong>Message:</strong></p>
          <p>${parsed.data.message}</p>
        `,
      });
      // In a real app, you would redirect or show a success message.
      // Since we can't easily do that from a server action without more setup,
      // we'll just log it. For a better UX, you'd typically use a client component with `useFormState`.
      console.log('Email sent successfully!');
      return { success: true };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, errors: { _form: ['Failed to send message. Please try again later.'] } };
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Contact Us</CardTitle>
          <CardDescription>Have a question? Fill out the form below and we'll get back to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="name">Name</label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1">
              <label htmlFor="email">Email</label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <label htmlFor="message">Message</label>
              <Textarea id="message" name="message" required minLength={10} />
            </div>
            <Button type="submit">Send Message</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
