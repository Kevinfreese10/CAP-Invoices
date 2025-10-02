
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

const profileFormSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email(),
});

const passwordFormSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ['confirmPassword'],
});


export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  
  if (!user) {
    return <p>Loading...</p>;
  }

  const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    setIsSaving(true);
     try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { name: values.name });
        updateUser({ ...user, name: values.name });
        toast({ title: 'Profile Updated', description: 'Your name has been updated.' });
    } catch (error) {
        console.error("Error updating profile:", error);
        toast({ title: 'Error', description: 'Could not update your profile.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
    setIsPasswordSaving(true);
    try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { password: values.password });
        updateUser({ ...user, password: values.password });
        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
        passwordForm.reset();
    } catch (error) {
        console.error("Error updating password:", error);
        toast({ title: 'Error', description: 'Could not update your password.', variant: 'destructive' });
    } finally {
        setIsPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <Card>
            <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>View and update your personal information.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                        <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={profileForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem> )} />
                         <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your login password.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                        <FormField control={passwordForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" disabled={isPasswordSaving}>
                            {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}

