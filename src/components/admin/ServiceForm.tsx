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
import { Trash } from 'lucide-react';

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().min(10, 'Short description is required.'),
  longDescription: z.string().min(20, 'Long description is required.'),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price must be a positive number.')),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().min(1, 'Image hint is required.'),
  category: z.string().min(1, 'Category is required.'),
  turnaroundTime: z.string().min(1, 'Turnaround time is required.'),
  whatsIncluded: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
  requiredDocuments: z.array(z.object({ value: z.string().min(1, 'This field cannot be empty.') })),
});

type ServiceFormProps = {
  service: Service | null;
  onSubmit: (data: Service) => void;
};

const serviceCategories = [
    "SARS & Tax",
    "Company Registrations",
    "CIPC",
    "Payroll",
    "NCR/COIDA/CIDB",
  ];

export default function ServiceForm({ service, onSubmit }: ServiceFormProps) {
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
      turnaroundTime: service?.turnaroundTime || '',
      whatsIncluded: service?.whatsIncluded.map(v => ({ value: v })) || [{ value: '' }],
      requiredDocuments: service?.requiredDocuments.map(v => ({ value: v })) || [{ value: '' }],
    },
  });

  const { fields: includedFields, append: appendIncluded, remove: removeIncluded } = useFieldArray({
    control: form.control,
    name: 'whatsIncluded',
  });

  const { fields: requiredFields, append: appendRequired, remove: removeRequired } = useFieldArray({
    control: form.control,
    name: 'requiredDocuments',
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const serviceData = {
        ...values,
        whatsIncluded: values.whatsIncluded.map(v => v.value),
        requiredDocuments: values.requiredDocuments.map(v => v.value),
    } as Service
    onSubmit(serviceData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
         <div>
            <FormLabel>Required Documents</FormLabel>
            {requiredFields.map((field, index) => (
                 <FormField
                    key={field.id}
                    control={form.control}
                    name={`requiredDocuments.${index}.value`}
                    render={({ field }) => (
                        <FormItem className="flex items-center gap-2 mt-2">
                             <FormControl><Input {...field} /></FormControl>
                             <Button type="button" variant="destructive" size="icon" onClick={() => removeRequired(index)}><Trash className="h-4 w-4"/></Button>
                        </FormItem>
                    )}
                />
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendRequired({ value: '' })}>Add Document</Button>
        </div>

        <Button type="submit" className="w-full">Save Service</Button>
      </form>
    </Form>
  );
}
