
'use client';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2, Trash } from 'lucide-react';
import { generateServiceDetails } from '@/ai/flows/generate-service-details';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';

const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().max(60, "Title should be under 60 characters"),
  description: z.string().max(160, "Description should be under 160 characters"),
  keywords: z.array(z.object({ value: z.string() })).optional(),
});

const formSchema = z.object({
  pages: z.array(seoSchema),
});

type SeoFormValues = z.infer<typeof formSchema>;

const initialSeoData = [
  { id: 'home', path: '/', title: 'My Accountant | Professional Accounting & Tax Services', description: 'Your trusted partner for professional financial services in South Africa. We simplify your finances so you can focus on what matters.', keywords: [{value: 'accounting'}, {value: 'tax services'}] },
  { id: 'services', path: '/services', title: 'Our Services | My Accountant', description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.', keywords: [] },
  { id: 'blog', path: '/blog', title: 'Tax Tip Blog | My Accountant', description: 'Stay informed with our latest articles, tips, and updates on tax-related topics for South Africans.', keywords: [] },
  { id: 'contact', path: '/contact', title: 'Contact Us | My Accountant', description: 'Have a question? Fill out the form below and we\'ll get back to you.', keywords: [] },
  { id: 'support', path: '/support', title: 'Support Center | My Accountant', description: 'Find answers to common questions or contact our support team.', keywords: [] },
  ...services.map(s => ({
    id: `service-${s.id}`,
    path: `/services/${s.id}`,
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


export default function SeoManagementPage() {
  const { toast } = useToast();
  const [isAiUpdating, setIsAiUpdating] = useState<string | null>(null);

  const form = useForm<SeoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pages: initialSeoData,
    },
  });

  const { fields, update } = useFieldArray({
    control: form.control,
    name: 'pages',
  });

  const onSubmit = (data: SeoFormValues) => {
    console.log('Saving SEO Data:', data);
    toast({
      title: 'SEO Settings Saved',
      description: 'Your changes have been saved successfully.',
    });
    // Here you would typically send the data to your backend
  };

  const pageGroups = {
    'Static Pages': fields.filter(f => !f.path.startsWith('/services/') && !f.path.startsWith('/blog/')),
    'Service Pages': fields.filter(f => f.path.startsWith('/services/')),
    'Blog Posts': fields.filter(f => f.path.startsWith('/blog/')),
  };

  const handleAiUpdate = async (groupName: string) => {
    setIsAiUpdating(groupName);
    toast({
        title: `Optimizing ${groupName}...`,
        description: 'The AI is generating new SEO content. Please wait.',
    });

    try {
        if (groupName === 'Service Pages') {
            for (const page of pageGroups['Service Pages']) {
                const originalService = services.find(s => `service-${s.id}` === page.id);
                if (originalService) {
                    const result = await generateServiceDetails({ title: originalService.title });
                    const index = fields.findIndex(f => f.id === page.id);
                    if (index !== -1) {
                         update(index, {
                             ...fields[index],
                             title: result.metaTitle,
                             description: result.metaDescription,
                             keywords: result.metaKeywords.map(k => ({ value: k })),
                         });
                    }
                }
            }
        } else if (groupName === 'Blog Posts') {
             for (const page of pageGroups['Blog Posts']) {
                const originalPost = blogPosts.find(p => `blog-${p.id}` === page.id);
                if (originalPost) {
                    const result = await generateBlogPostSeo({ title: originalPost.title });
                    const index = fields.findIndex(f => f.id === page.id);
                    if (index !== -1) {
                         update(index, {
                             ...fields[index],
                             title: result.metaTitle,
                             description: result.metaDescription,
                             keywords: result.metaKeywords.map(k => ({ value: k })),
                         });
                    }
                }
            }
        } else if (groupName === 'Static Pages') {
            for (const page of pageGroups['Static Pages']) {
                const pageTitle = page.title.split('|')[0].trim();
                const result = await generateBlogPostSeo({ title: pageTitle });
                const index = fields.findIndex(f => f.id === page.id);
                 if (index !== -1) {
                    update(index, {
                        ...fields[index],
                        title: result.metaTitle,
                        description: result.metaDescription,
                        keywords: result.metaKeywords.map(k => ({ value: k })),
                    });
                }
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
                {Object.entries(pageGroups).map(([groupName, pages]) => (
                  <AccordionItem key={groupName} value={groupName}>
                    <div className="flex items-center">
                      <AccordionTrigger className="text-xl font-semibold flex-grow">{groupName} ({pages.length})</AccordionTrigger>
                      <Button type="button" onClick={() => handleAiUpdate(groupName)} size="sm" variant="ghost" disabled={isAiUpdating === groupName}>
                        {isAiUpdating === groupName ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" />}
                        Update with AI
                      </Button>
                    </div>
                    <AccordionContent className="space-y-6 pt-4">
                       {pages.map((field) => {
                         const originalIndex = fields.findIndex(f => f.id === field.id);
                         const {fields: keywordFields, append: appendKeyword, remove: removeKeyword} = useFieldArray({
                           control: form.control,
                           name: `pages.${originalIndex}.keywords`,
                         });
                         const titleLength = form.watch(`pages.${originalIndex}.title`).length;
                         const descLength = form.watch(`pages.${originalIndex}.description`).length;
                         return (
                            <div key={field.id} className="p-4 border rounded-lg space-y-4">
                                <h3 className="font-semibold text-lg">{field.path}</h3>
                                <FormField
                                    control={form.control}
                                    name={`pages.${originalIndex}.title`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <div className="flex justify-between items-center">
                                          <FormLabel>Meta Title</FormLabel>
                                          <span className={`text-xs ${titleLength > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>{titleLength}/60</span>
                                        </div>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`pages.${originalIndex}.description`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <div className="flex justify-between items-center">
                                          <FormLabel>Meta Description</FormLabel>
                                          <span className={`text-xs ${descLength > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>{descLength}/160</span>
                                        </div>
                                        <FormControl>
                                            <Textarea {...field} rows={3} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <div>
                                  <FormLabel>Meta Keywords</FormLabel>
                                  <div className="space-y-2 mt-2">
                                     {keywordFields.map((kwField, kwIndex) => (
                                        <FormField
                                            key={kwField.id}
                                            control={form.control}
                                            name={`pages.${originalIndex}.keywords.${kwIndex}.value`}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2">
                                                    <FormControl><Input {...field} /></FormControl>
                                                    <Button type="button" variant="destructive" size="icon" onClick={() => removeKeyword(kwIndex)}><Trash className="h-4 w-4"/></Button>
                                                </FormItem>
                                            )}
                                        />
                                     ))}
                                  </div>
                                   <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendKeyword({ value: '' })}>Add Keyword</Button>
                                </div>
                            </div>
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
