
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useBlog } from '@/contexts/BlogContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateServiceDetails } from '@/ai/flows/generate-service-details';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import SeoPageForm from '@/components/admin/SeoPageForm';

const db = getFirestore(firebaseApp);

const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().max(60, "Title must be 60 characters or less."),
  description: z.string().max(160, "Description must be 160 characters or less."),
  keywords: z.array(z.object({ value: z.string() })).optional(),
});

const formSchema = z.object({
  pages: z.array(seoSchema),
});

type SeoFormValues = z.infer<typeof formSchema>;


export default function SeoManagementPage() {
  const { blogPosts } = useBlog();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiUpdating, setIsAiUpdating] = useState<string | null>(null);
  
  const form = useForm<SeoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pages: [],
    },
    mode: 'onChange',
  });

  const { control, setValue } = form;

  useEffect(() => {
    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setServices(fetchedServices);
        } catch(error) {
            console.error("Error fetching services: ", error);
            toast({ title: 'Error', description: 'Could not fetch services.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    fetchServices();
  }, [toast]);
  
  useEffect(() => {
    const initialSeoData = [
        { id: 'home', path: '/home', title: 'My Accountant | Professional Accounting & Tax Services', description: 'Your trusted partner for professional financial services in South Africa. We simplify your finances so you can focus on what matters.', keywords: [{value: 'accounting'}, {value: 'tax services'}] },
        { id: 'services', path: '/services', title: 'Our Services | My Accountant', description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.', keywords: [] },
        { id: 'blog', path: '/blog', title: 'Tax Tip Blog | My Accountant', description: 'Stay informed with our latest articles, tips, and updates on tax-related topics for South Africans.', keywords: [] },
        { id: 'contact', path: '/contact', title: 'Contact Us | My Accountant', description: 'Have a question? Fill out the form below and we\'ll get back to you.', keywords: [] },
        { id: 'support', path: '/support', title: 'Support Center | My Accountant', description: 'Find answers to common questions or contact our support team.', keywords: [] },
        ...services.map(s => ({
            id: `service-${s.id}`,
            path: `/services/${s.slug}`,
            title: s.metaTitle || `${s.title} | My Accountant`,
            description: s.metaDescription || s.description,
            keywords: s.metaKeywords?.map(k => ({ value: k })) || [],
        })),
        ...blogPosts.map(p => ({
            id: `blog-${p.id}`,
            path: `/blog/${p.slug}`,
            title: p.metaTitle || `${p.title} | My Accountant`,
            description: p.metaDescription || p.excerpt,
            keywords: p.metaKeywords?.map(k => ({ value: k })) || [],
        })),
    ];
    setValue('pages', initialSeoData);
  }, [services, blogPosts, setValue]);


  const onSubmit = (data: SeoFormValues) => {
    console.log('Saving SEO Data:', data);
    toast({
      title: 'SEO Settings Saved',
      description: 'Your changes have been saved successfully.',
    });
    // Here you would typically send the data to your backend
  };

  const pages = form.watch('pages');

  const pageGroups = {
    'Static Pages': pages.filter(f => !f.path.startsWith('/services/') && !f.path.startsWith('/blog/')),
    'Service Pages': pages.filter(f => f.path.startsWith('/services/')),
    'Blog Posts': pages.filter(f => f.path.startsWith('/blog/')),
  };

  const handleAiUpdate = async (groupName: string) => {
    setIsAiUpdating(groupName);
    toast({
        title: `Optimizing ${groupName}...`,
        description: 'The AI is generating new SEO content. Please wait.',
    });

    try {
        const pagesToUpdate = pageGroups[groupName as keyof typeof pageGroups];

        for (const [index, page] of pagesToUpdate.entries()) {
            const originalIndex = pages.findIndex(p => p.id === page.id);
            if (originalIndex === -1) continue;

            let result;
            if (groupName === 'Service Pages') {
                const originalService = services.find(s => `service-${s.id}` === page.id);
                if (originalService) {
                    result = await generateServiceDetails({ title: originalService.title });
                }
            } else if (groupName === 'Blog Posts') {
                const originalPost = blogPosts.find(p => `blog-${p.id}` === page.id);
                if (originalPost) {
                    result = await generateBlogPostSeo({ title: originalPost.title });
                }
            } else { // Static Pages
                const pageTitle = page.title.split('|')[0].trim();
                result = await generateBlogPostSeo({ title: pageTitle });
            }

            if (result) {
                form.setValue(`pages.${originalIndex}.title`, result.metaTitle);
                form.setValue(`pages.${originalIndex}.description`, result.metaDescription);
                form.setValue(`pages.${originalIndex}.keywords`, result.metaKeywords.map(k => ({ value: k })));
            }
        }
        
        toast({
            title: 'Optimization Complete!',
            description: `${groupName} have been updated with AI-generated SEO content.`,
        });
    } catch (error) {
        console.error("AI Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiUpdating(null);
    }
  }

  if (isLoading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">SEO Management</h1>
        <Button onClick={form.handleSubmit(onSubmit)}>Save All Changes</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page SEO Details</CardTitle>
          <CardDescription>Update the meta titles and descriptions for pages on your site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-8">
               <Accordion type="multiple" defaultValue={['Static Pages']} className="w-full">
                {Object.entries(pageGroups).map(([groupName, groupPages]) => (
                  <AccordionItem key={groupName} value={groupName}>
                    <div className="flex items-center">
                      <AccordionTrigger className="text-xl font-semibold flex-grow">{groupName} ({groupPages.length})</AccordionTrigger>
                      {(groupName !== 'Static Pages') && (
                        <Button type="button" onClick={() => handleAiUpdate(groupName)} size="sm" variant="ghost" disabled={!!isAiUpdating}>
                            {isAiUpdating === groupName ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" />}
                            Update with AI
                        </Button>
                      )}
                    </div>
                    <AccordionContent className="space-y-6 pt-4">
                       {groupPages.map((page) => {
                         const originalIndex = pages.findIndex(p => p.id === page.id);
                         if (originalIndex === -1) return null;
                         return (
                            <SeoPageForm
                                key={page.id}
                                form={form}
                                control={control}
                                index={originalIndex}
                                page={page}
                            />
                        )})}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
