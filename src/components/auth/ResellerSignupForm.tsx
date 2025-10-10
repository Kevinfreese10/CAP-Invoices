
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Service } from '@/lib/types';


const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  contactPerson: z.string().min(2, 'Contact person is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  wantsOutsourcedWork: z.boolean().default(false),
  cv: z.any().optional(),
  certificate: z.any().optional(),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions.',
  }),
  capableServices: z.array(z.string()).optional(),
}).refine(data => {
    if (data.wantsOutsourcedWork) {
      return data.cv?.[0] && data.certificate?.[0];
    }
    return true;
}, {
    message: 'CV and Certificate are required to be considered for outsourced work.',
    path: ['wantsOutsourcedWork'],
});

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};


export default function ResellerSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { reauthenticate, login } = useAuth();
  const adminUser = auth.currentUser;
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      contactPerson: '',
      email: '',
      password: '',
      contactNumber: '',
      wantsOutsourcedWork: false,
      agreeTerms: false,
      capableServices: [],
    },
  });
  
  useEffect(() => {
    const fetchServicesAndCategories = async () => {
        setIsServicesLoading(true);
        try {
            const servicesQuery = query(collection(db, "services"), orderBy("title"));
            const servicesSnapshot = await getDocs(servicesQuery);
            const fetchedServices = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setAllServices(fetchedServices);

            const categoriesQuery = query(collection(db, "categories"), orderBy("order"));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
            setAllCategories(fetchedCategories);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({
                title: 'Error',
                description: 'Could not load required data. Please try refreshing the page.',
                variant: 'destructive',
            });
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServicesAndCategories();
  }, [toast]);

  const categorizedServices = useMemo(() => {
    if (!allCategories.length || !allServices.length) return [];
    
    return allCategories
      .map(category => ({
        ...category,
        services: allServices.filter(service => service.category === category.name),
      }))
      .filter(category => category.services.length > 0);
  }, [allCategories, allServices]);


  const wantsOutsourcedWork = form.watch('wantsOutsourcedWork');

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const { password, cv, certificate, ...resellerData } = values;

        // 1. Create the user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;
        const uid = newFirebaseUser.uid;
        
        let cvUrl = '';
        let certificateUrl = '';

        // 2. Upload files if they exist
        if (values.wantsOutsourcedWork && values.cv?.[0] && values.certificate?.[0]) {
            toast({ title: 'Uploading Documents...', description: 'Please wait while we upload your files.' });
            cvUrl = await uploadFile(values.cv[0], `reseller-applications/${uid}/cv-${values.cv[0].name}`);
            certificateUrl = await uploadFile(values.certificate[0], `reseller-applications/${uid}/certificate-${values.certificate[0].name}`);
        }

        // 3. Save reseller data to Firestore in the 'users' collection
        await setDoc(doc(db, 'users', uid), {
            ...resellerData,
            name: values.contactPerson, // Use contact person as the main name
            uid: uid,
            role: 'reseller',
            status: 'Active',
            cvUrl: cvUrl,
            certificateUrl: certificateUrl,
        });
        
        // 4. Re-authenticate the original admin user if one was logged in, then log in the new user.
        if (adminUser) {
            await reauthenticate(adminUser);
        }
        await login(values.email, values.password);

        toast({
            title: 'Application Received!',
            description: `Thank you, ${values.contactPerson}. Your reseller account has been created. Redirecting to your dashboard...`,
        });
        
        router.push('/reseller/dashboard');

    } catch (error: any) {
        console.error("Reseller signup error:", error);
        toast({
            title: 'Signup Failed',
            description: error.message || 'There was a problem creating your account. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
         <Separator />

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Work With Us</h3>
             <FormField
                control={form.control}
                name="wantsOutsourcedWork"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>
                            Would you like us to outsource work to you?
                        </FormLabel>
                         <p className="text-sm text-muted-foreground">
                            If you belong to a professional accounting or tax body, we can send overflow work your way. You can complete this later.
                        </p>
                         <FormMessage />
                    </div>
                    </FormItem>
                )}
            />
            {wantsOutsourcedWork && (
                <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="cv"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Upload your CV</FormLabel>
                                    <FormControl>
                                        <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => field.onChange(e.target.files)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="certificate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Upload Professional Certificate</FormLabel>
                                    <FormControl>
                                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => field.onChange(e.target.files)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                      control={form.control}
                      name="capableServices"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Service Capabilities</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Select all the services you are qualified to perform.
                            </p>
                          </div>
                          {isServicesLoading ? (
                             <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading services...</span>
                            </div>
                          ) : (
                          <div className="space-y-4">
                             {categorizedServices.map(category => (
                                <div key={category.id}>
                                    <h4 className="font-semibold mb-2">{category.name}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
                                        {category.services.map((service) => (
                                            <FormField
                                                key={service.id}
                                                control={form.control}
                                                name="capableServices"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                        <Checkbox
                                                        checked={field.value?.includes(service.id)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? field.onChange([...(field.value || []), service.id])
                                                            : field.onChange(
                                                                field.value?.filter(
                                                                    (value) => value !== service.id
                                                                )
                                                            )
                                                        }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {service.title}
                                                    </FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                          </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            )}
        </div>


        <Separator />

        <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>
                        I agree to the <Link href="/terms" className="underline" target="_blank">terms and conditions</Link> of the reseller program.
                    </FormLabel>
                    <FormMessage />
                </div>
                </FormItem>
            )}
        />
        
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
        </Button>
      </form>
    </Form>
  );
}
