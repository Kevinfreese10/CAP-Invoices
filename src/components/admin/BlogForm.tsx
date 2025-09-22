
'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BlogPost } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash, Sparkles, Loader2 } from 'lucide-react';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { generateBlogPost } from '@/ai/flows/generate-blog-post';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Separator } from '../ui/separator';

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(10, 'Title must be at least 10 characters.'),
  excerpt: z.string().min(20, 'Excerpt must be at least 20 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  author: z.string().min(2, "Author's name is required."),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().min(1, 'Image hint is required.'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.object({ value: z.string() })).optional(),
});

type BlogFormProps = {
  post: BlogPost | null;
  onSubmit: (data: any) => void;
};

export default function BlogForm({ post, onSubmit }: BlogFormProps) {
  const { toast } = useToast();
  const [isAiContentUpdating, setIsAiContentUpdating] = useState(false);
  const [isAiSeoUpdating, setIsAiSeoUpdating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: post?.id || '',
      title: post?.title || '',
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      author: post?.author || 'Jane Doe', // Default author
      imageUrl: post?.imageUrl || 'https://picsum.photos/seed/new-post/800/400',
      imageHint: post?.imageHint || 'business office',
      metaTitle: post?.metaTitle || '',
      metaDescription: post?.metaDescription || '',
      metaKeywords: post?.metaKeywords?.map(v => ({value: v})) || [{ value: '' }],
    },
  });

  const { fields: keywordFields, append: appendKeyword, remove: removeKeyword } = useFieldArray({
    control: form.control,
    name: 'metaKeywords',
  });

  const handleAiContentUpdate = async () => {
    const title = form.getValues('title');
    if (!title) {
        toast({
            title: 'Title is missing',
            description: 'Please enter a post title before using AI.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsAiContentUpdating(true);
    toast({
        title: 'Generating Blog Content...',
        description: 'The AI is writing your blog post. Please wait.',
    });

    try {
        const result = await generateBlogPost({ title });
        form.setValue('excerpt', result.excerpt);
        form.setValue('content', result.content);
        toast({
            title: 'Blog Content Generated',
            description: 'The excerpt and main content fields have been populated by AI.',
        });
    } catch (error) {
        console.error("AI Content Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiContentUpdating(false);
    }
  };

  const handleAiSeoUpdate = async () => {
    const title = form.getValues('title');
    if (!title) {
        toast({
            title: 'Title is missing',
            description: 'Please enter a post title before using AI.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsAiSeoUpdating(true);
    toast({
        title: 'Generating SEO Content...',
        description: 'The AI is creating SEO data for your post. Please wait.',
    });

    try {
        const result = await generateBlogPostSeo({ title });
        form.setValue('metaTitle', result.metaTitle);
        form.setValue('metaDescription', result.metaDescription);
        form.setValue('metaKeywords', result.metaKeywords.map(k => ({ value: k })));
        toast({
            title: 'SEO Content Updated',
            description: 'The SEO fields have been populated by AI.',
        });
    } catch (error) {
        console.error("AI SEO Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating SEO content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiSeoUpdating(false);
    }
  };


  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const postData = {
        ...values,
        metaKeywords: values.metaKeywords?.map(v => v.value),
    }
    onSubmit(postData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <FormLabel>Excerpt & Main Content</FormLabel>
                <Button type="button" size="sm" onClick={handleAiContentUpdate} disabled={isAiContentUpdating}>
                    {isAiContentUpdating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                    Generate Content with AI
                </Button>
            </div>
            <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
                <FormItem>
                <FormControl><Textarea {...field} rows={3} placeholder="A short summary of the post..." /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
                <FormItem>
                <FormControl><Textarea {...field} rows={10} placeholder="The main content of the blog post. HTML is supported." /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="author" render={({ field }) => ( <FormItem><FormLabel>Author</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="imageHint" render={({ field }) => ( <FormItem><FormLabel>Image AI Hint</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />

        <Separator />

        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">SEO Information</h3>
                 <Button type="button" onClick={handleAiSeoUpdate} disabled={isAiSeoUpdating}>
                    {isAiSeoUpdating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                    Update SEO with AI
                </Button>
            </div>
            <FormField
                control={form.control}
                name="metaTitle"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Meta Title</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Meta Description</FormLabel>
                    <FormControl><Textarea {...field} rows={2} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div>
                <FormLabel>Meta Keywords</FormLabel>
                {keywordFields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`metaKeywords.${index}.value`}
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 mt-2">
                                <FormControl><Input {...field} /></FormControl>
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeKeyword(index)}><Trash className="h-4 w-4"/></Button>
                            </FormItem>
                        )}
                    />
                ))}
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendKeyword({ value: '' })}>Add Keyword</Button>
            </div>
        </div>

        <Button type="submit" className="w-full">Save Post</Button>
      </form>
    </Form>
  );
}
