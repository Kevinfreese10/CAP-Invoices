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
import { Trash, Sparkles, Loader2, Plus, Info } from 'lucide-react';
import { generateServiceDetails } from '@/ai/flows/generate-service-details';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const departments = ['Accounting and Tax', 'Administration'] as const;

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().min(10, 'Short description is required.'),
  longDescription: z.string().min(20, 'Long description is required.'),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price must be a positive number.')),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().min(1, 'Image hint is required.'),
  category: z.string().min(1, 'Category is required.'),
  department: z.enum(departments),
  turnaroundTime: z.string().min(1, 'Turnaround time is required.'),
  whatsIncluded: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
  clientRequirements: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
  informationToUpload: z.array(z.object({
    label: z.string().min(1, 'Label cannot be empty.'),
    type: z.enum(['text', 'file']),
  })),
  conditionalFields: z.object({
    enabled: z.boolean(),
    fieldName: z.string(),
    fieldValues: z.array(z.object({ value: z.string().min(1, 'Value cannot be empty.') })),
    duplicatedDocuments: z.array(z.object({
      label: z.string().min(1, 'Label cannot be empty.'),
      type: z.enum(['text', 'file']),
    })),
  }).optional(),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: service?.id || '',
      title: service?.title || '',
      description: service?.description || '',
      longDescription: service?.longDescription || '',
      price: service?.price || 0,
      imageUrl: service?.imageUrl || 'https://picsum.photos/seed/new/600/400',
      imageHint: service?.imageHint || 'abstract',
      category: service?.category || '',
      department: service?.department || 'Administration',
      turnaroundTime: service?.turnaroundTime || '',
      whatsIncluded: service?.whatsIncluded.map(v => ({ value: v })) || [{ value: '' }],
      clientRequirements: service?.clientRequirements.map(v => ({ value: v })) || [{ value: '' }],
      informationToUpload: service?.informationToUpload || [],
      conditionalFields: {
        enabled: service?.conditionalFields?.enabled || false,
        fieldName: service?.conditionalFields?.fieldName || '',
        fieldValues: service?.conditionalFields?.fieldValues.map(v => ({ value: v })) || [{ value: '' }],
        duplicatedDocuments: service?.conditionalFields?.duplicatedDocuments || [],
      },
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

  const { fields: uploadFields, append: appendUpload, remove: removeUpload } = useFieldArray({
    control: form.control,
    name: 'informationToUpload',
  });
  
  const { fields: conditionalValueFields, append: appendConditionalValue, remove: removeConditionalValue } = useFieldArray({
    control: form.control,
    name: 'conditionalFields.fieldValues',
  });

  const { fields: duplicatedDocFields, append: appendDuplicatedDoc, remove: removeDuplicatedDoc } = useFieldArray({
    control: form.control,
    name: 'conditionalFields.duplicatedDocuments',
  });

  const { fields: keywordFields, append: appendKeyword, remove: removeKeyword } = useFieldArray({
    control: form.control,
    name: 'metaKeywords',
  });
  
  const conditionalFieldsEnabled = form.watch('conditionalFields.enabled');

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
        whatsIncluded: values.whatsIncluded.map(v => v.value),
        clientRequirements: values.clientRequirements.map(v => v.value),
        informationToUpload: values.informationToUpload,
        conditionalFields: {
          ...values.conditionalFields,
          fieldValues: values.conditionalFields?.fieldValues.map(v => v.value),
          duplicatedDocuments: values.conditionalFields?.duplicatedDocuments,
        },
        metaKeywords: values.metaKeywords?.map(v => v.value),
    } as Service
    onSubmit(serviceData);
  };

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
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Price (R)</FormLabel>
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
            <h3 className="text-sm font-medium">Information to be Uploaded (Post-Purchase)</h3>
            {uploadFields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                 <FormField
                    control={form.control}
                    name={`informationToUpload.${index}.label`}
                    render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormLabel>Field Label</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage/>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name={`informationToUpload.${index}.type`}
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="text">Text Input</SelectItem>
                                  <SelectItem value="file">Document Upload</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage/>
                        </FormItem>
                    )}
                />
                <Button type="button" variant="destructive" size="icon" onClick={() => removeUpload(index)}><Trash className="h-4 w-4"/></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendUpload({ label: '', type: 'text' })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Upload Field
            </Button>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
          <FormField
              control={form.control}
              name="conditionalFields.enabled"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none flex items-center gap-2">
                          <FormLabel className="font-semibold text-base">Conditional Fields</FormLabel>
                           <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Use this to dynamically ask for documents based on user input. For example, ask for the number of directors, then request an ID for each one.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                      </div>
                  </FormItem>
              )}
          />

          {conditionalFieldsEnabled && (
            <div className="space-y-4 pl-6 pt-4 border-l-2">
              <FormField
                control={form.control}
                name="conditionalFields.fieldName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditional Field Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Number of Directors" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Dropdown Values</FormLabel>
                <div className="space-y-2 mt-2">
                  {conditionalValueFields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`conditionalFields.fieldValues.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl><Input {...field} placeholder="e.g., 1 Director" /></FormControl>
                          <Button type="button" variant="destructive" size="icon" onClick={() => removeConditionalValue(index)}><Trash className="h-4 w-4" /></Button>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendConditionalValue({ value: '' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Dropdown Value
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Documents That Will Be Duplicated</h3>
                <div className="space-y-2">
                  {duplicatedDocFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                      <FormField
                          control={form.control}
                          name={`conditionalFields.duplicatedDocuments.${index}.label`}
                          render={({ field }) => (
                              <FormItem className="flex-grow">
                                <FormLabel>Document name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage/>
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name={`conditionalFields.duplicatedDocuments.${index}.type`}
                          render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="text">Text Input</SelectItem>
                                        <SelectItem value="file">Upload</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage/>
                              </FormItem>
                          )}
                      />
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeDuplicatedDoc(index)}><Trash className="h-4 w-4"/></Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">These documents will be repeated for each dropdown value (e.g., for each director).</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendDuplicatedDoc({ label: '', type: 'file' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Duplicated Document
                </Button>
              </div>
            </div>
          )}
        </div>


        <Separator />

        <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-lg font-medium">SEO Information</h3>
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
