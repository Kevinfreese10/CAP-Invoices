

'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const user = await login(values.email, values.password);
    
    if (user === 'invalid_credentials') {
        toast({
            title: 'Login Failed',
            description: 'Invalid email or password.',
            variant: 'destructive',
        });
        return;
    }
    
    if (user === 'invalid_role') {
      toast({
        title: 'Access Denied',
        description: 'This portal is for staff and admins only.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
        toast({
            title: 'Login Failed',
            description: 'An unknown error occurred.',
            variant: 'destructive',
        });
        return;
    }
    
    toast({
      title: 'Logged in successfully',
      description: `Welcome back, ${user?.name}! Redirecting...`,
    });
    
    if (user.role === 'admin' || user.role === 'staff') {
        router.push('/admin/dashboard');
    } else if (user.role === 'reseller') {
        router.push('/reseller/dashboard');
    } else {
        router.push('/dashboard');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          Log In
        </Button>
      </form>
    </Form>
  );
}
