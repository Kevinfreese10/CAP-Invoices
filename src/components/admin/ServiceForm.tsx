
'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash, Sparkles, Loader2, Plus, Info, Images } from 'lucide-react';
import { generateServiceDetails } from '@/ai/flows/generate-service-details';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import MediaLibrary from './MediaLibrary';
import Image from 'next/image';

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().min(10, 'Short description is required.'),
  longDescription: z.string().min(20, 'Long description is required.'),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price must be a positive number.')),
  resellerPrice: z.preprocess(val => Number(val), z.number().min(0, 'Reseller price must be a positive number.').optional()),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().min(1, 'Image hint is required.'),
  category: z.string().min(1, 'Category is required.'),
  department: z.enum(departments),
  turnaroundTime: z.string().min(1, 'Turnaround time is required.'),
  whatsIncluded: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
  clientRequirements: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
  informationToProvide: z.array(z.object({
    label: z.string().min(1, 'Label cannot be empty.'),
  })),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.object({ value: z.string() })).optional(),
});

type ServiceFormProps = {
  service: Service | null;
  onSubmit: (data: Service) => void;
};

const serviceCategories = [
    "SARS Services",
    "Entity Registrations",
    "CIPC Services",
    "COIDA Services",
    "NCR Registrations",
    "Accounting Services",
    "CIDB Services",
];

export default function ServiceForm({ service, onSubmit }: ServiceFormProps) {
  const { toast } = useToast();
  const [isAiUpdating, setIsAiUpdating] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: service?.id || '',
      title: service?.title || '',
      description: service?.description || '',
      longDescription: service?.longDescription || '',
      price: service?.price || 0,
      resellerPrice: service?.resellerPrice || 0,
      imageUrl: service?.imageUrl || 'https://picsum.photos/seed/new/600/400',
      imageHint: service?.imageHint || 'abstract',
      category: service?.category || '',
      department: service?.department || 'Administration',
      turnaroundTime: service?.turnaroundTime || '',
      whatsIncluded: service?.whatsIncluded.map(v => ({ value: v })) || [{ value: '' }],
      clientRequirements: service?.clientRequirements.map(v => ({ value: v })) || [{ value: '' }],
      informationToProvide: service?.informationToProvide || [],
      metaTitle: service?.metaTitle || '',
      metaDescription: service?.metaDescription || '',
      metaKeywords: service?.metaKeywords?.map(v => ({value: v})) || [{ value: '' }],
    },
  });

  const { fields: includedFields, append: appendIncluded, remove: removeIncluded } = useFieldArray({
    control: form.control,
    name: 'whatsIncluded',
  });

  const { fields: prereqFields, append: appendPrereq, remove: removePrereq } = useFieldArray({
    control: form.control,
    name: 'clientRequirements',
  });

  const { fields: infoFields, append: appendInfo, remove: removeInfo } = useFieldArray({
    control: form.control,
    name: 'informationToProvide',
  });
  
  const { fields: keywordFields, append: appendKeyword, remove: removeKeyword } = useFieldArray({
    control: form.control,
    name: 'metaKeywords',
  });

  const handleAiUpdate = async () => {
    const title = form.getValues('title');
    if (!title) {
        toast({
            title: 'Title is missing',
            description: 'Please enter a service title before using AI.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsAiUpdating(true);
    toast({
        title: 'Generating Content...',
        description: 'The AI is creating content for your service. Please wait.',
    });

    try {
        const result = await generateServiceDetails({ title });
        form.setValue('title', result.correctedTitle);
        form.setValue('description', result.shortDescription);
        form.setValue('longDescription', result.longDescription);
        form.setValue('turnaroundTime', result.turnaroundTime);
        form.setValue('metaTitle', result.metaTitle);
        form.setValue('metaDescription', result.metaDescription);
        form.setValue('metaKeywords', result.metaKeywords.map(k => ({ value: k })));
        toast({
            title: 'Content Updated',
            description: 'The service details have been populated by AI.',
        });
    } catch (error) {
        console.error("AI Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiUpdating(false);
    }
  };


  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const serviceData = {
        ...values,
        seoImageUrl: values.imageUrl,
        whatsIncluded: values.whatsIncluded.map(v => v.value),
        clientRequirements: values.clientRequirements.map(v => v.value),
        informationToProvide: values.informationToProvide,
        metaKeywords: values.metaKeywords?.map(v => v.value),
    } as Service
    onSubmit(serviceData);
  };

  const currentImageUrl = form.watch('imageUrl');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <div className="flex items-center justify-between gap-4">
            <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
                <FormItem className="flex-grow">
                <FormLabel>Service Title</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <Button type="button" onClick={handleAiUpdate} disabled={isAiUpdating} className="mt-8">
              {isAiUpdating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              <span className="ml-2 hidden sm:inline">Update with AI</span>
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Public Price (R)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="resellerPrice"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Reseller Price (R)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Category</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {serviceCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
         <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Responsible Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {departments.map(dep => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short Description</FormLabel>
              <FormControl><Textarea {...field} rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="longDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Long Description</FormLabel>
              <FormControl><Textarea {...field} rows={4} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="turnaroundTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turnaround Time</FormLabel>
              <FormControl><Input {...field} placeholder="e.g., 5-7 working days" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
            <FormLabel>What's Included</FormLabel>
            {includedFields.map((field, index) => (
                 <FormField
                    key={field.id}
                    control={form.control}
                    name={`whatsIncluded.${index}.value`}
                    render={({ field }) => (
                        <FormItem className="flex items-center gap-2 mt-2">
                             <FormControl><Input {...field} /></FormControl>
                             <Button type="button" variant="destructive" size="icon" onClick={() => removeIncluded(index)}><Trash className="h-4 w-4"/></Button>
                        </FormItem>
                    )}
                />
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendIncluded({ value: '' })}>Add Item</Button>
        </div>
         <div className="space-y-2 rounded-lg border p-4">
            <h3 className="text-sm font-medium">Prerequisites (Shown on public service page)</h3>
            {prereqFields.map((field, index) => (
                 <FormField
                    key={field.id}
                    control={form.control}
                    name={`clientRequirements.${index}.value`}
                    render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                             <FormControl><Input {...field} /></FormControl>
                             <Button type="button" variant="destructive" size="icon" onClick={() => removePrereq(index)}><Trash className="h-4 w-4"/></Button>
                        </FormItem>
                    )}
                />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendPrereq({ value: '' })}>Add Prerequisite</Button>
        </div>
        
        <div className="space-y-2 rounded-lg border p-4">
            <h3 className="text-sm font-medium">Information to be provided by the client</h3>
            {infoFields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                 <FormField
                    control={form.control}
                    name={`informationToProvide.${index}.label`}
                    render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormLabel>Field Label</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage/>
                        </FormItem>
                    )}
                />
                <Button type="button" variant="destructive" size="icon" onClick={() => removeInfo(index)}><Trash className="h-4 w-4"/></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendInfo({ label: '' })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Information Field
            </Button>
        </div>

        <Separator />

        <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-lg font-medium">SEO & Content</h3>
             <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Display Image</FormLabel>
                        <div className="flex items-center gap-4">
                             <div className="relative h-24 w-24 flex-shrink-0 border rounded-md overflow-hidden">
                                {currentImageUrl && <Image src={currentImageUrl} alt="Current service image" fill className="object-cover"/>}
                            </div>
                            <div className="flex-grow space-y-2">
                                <FormControl><Input {...field} placeholder="https://example.com/image.jpg" /></FormControl>
                                 <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="sm">
                                            <Images className="mr-2 h-4 w-4"/>
                                            Select from Media Library
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl">
                                        <DialogHeader>
                                            <DialogTitle>Media Library</DialogTitle>
                                            <DialogDescription>Select an image to use for this service.</DialogDescription>
                                        </DialogHeader>
                                        <MediaLibrary onSelectImage={(url) => {
                                            form.setValue('imageUrl', url);
                                            setIsMediaLibraryOpen(false);
                                        }} />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="imageHint"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Display Image AI Hint</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <Separator className="my-4" />
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

        <Button type="submit" className="w-full">Save Service</Button>
      </form>
    </Form>
  );
}

    