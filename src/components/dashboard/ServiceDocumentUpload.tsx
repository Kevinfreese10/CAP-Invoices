'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Service } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileText, File as FileIcon, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

const formSchema = z.object({
  // We will build the schema dynamically
});

export default function ServiceDocumentUpload({ service, orderId }: { service: Service; orderId: string }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [conditionalValue, setConditionalValue] = useState(service.conditionalFields?.fieldValues[0] || '1');

  // Helper function to generate the schema and default values
  const generateFormConfig = (conditionalCount: number) => {
    let schema: Record<string, z.ZodType<any, any>> = {};
    let defaults: Record<string, any> = {};

    service.informationToUpload.forEach(field => {
      const fieldName = field.label.replace(/\s/g, '');
      schema[fieldName] = field.type === 'file' 
        ? z.custom<FileList>().refine(files => files?.length > 0, `${field.label} is required.`)
        : z.string().min(1, `${field.label} is required.`);
      defaults[fieldName] = field.type === 'file' ? undefined : '';
    });

    if (service.conditionalFields?.enabled) {
      Array.from({ length: conditionalCount }).forEach((_, index) => {
        service.conditionalFields?.duplicatedDocuments.forEach(doc => {
          const fieldName = `${doc.label.replace(/\s/g, '')}_${index + 1}`;
          schema[fieldName] = doc.type === 'file'
            ? z.custom<FileList>().refine(files => files?.length > 0, `${doc.label} for item ${index + 1} is required.`)
            : z.string().min(1, `${doc.label} for item ${index + 1} is required.`);
          defaults[fieldName] = doc.type === 'file' ? undefined : '';
        });
      });
    }
    return { schema: z.object(schema), defaults };
  };

  const { schema: dynamicSchema, defaults: defaultValues } = generateFormConfig(parseInt(conditionalValue, 10));

  const form = useForm<z.infer<typeof dynamicSchema>>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: defaultValues,
    mode: 'onChange',
  });
  
  // Re-initialize form when conditional value changes
  // This is not ideal, but necessary for dynamic fields with react-hook-form
  useState(() => {
    form.reset(generateFormConfig(parseInt(conditionalValue, 10)).defaults);
  });


  const onSubmit = (data: z.infer<typeof dynamicSchema>) => {
    setIsUploading(true);
    toast({ title: "Submitting information...", description: "Please wait." });
    
    // Simulate upload process
    setTimeout(() => {
      console.log('Submitted data for service', service.title, data);
      setIsUploading(false);
      setSubmitted(true);
      toast({
        title: 'Information Submitted',
        description: `Your documents and information for "${service.title}" have been received.`,
      });
    }, 2000);
  };

  const renderField = (label: string, type: 'text' | 'file', fieldName: string) => {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={fieldName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              {type === 'file' ? (
                <Input type="file" onChange={(e) => field.onChange(e.target.files)} />
              ) : (
                <Input {...field} />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };
  
  if (submitted) {
    return (
        <Card className="bg-muted/40">
            <CardHeader>
                <CardTitle>{service.title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center flex-col gap-4 text-center p-8">
                    <FileText className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-semibold">Information Received</h3>
                    <p className="text-muted-foreground">
                        Your information for this service has been submitted for review. We will notify you if any changes are required.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Information for: {service.title}</CardTitle>
        <CardDescription>Please complete the form below to proceed with your order.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {service.informationToUpload.map(field => 
              renderField(field.label, field.type, field.label.replace(/\s/g, ''))
            )}

            {service.conditionalFields?.enabled && (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                 <FormField
                    control={form.control}
                    name={service.conditionalFields.fieldName.replace(/\s/g, '')}
                    render={() => (
                      <FormItem>
                        <FormLabel>{service.conditionalFields.fieldName}</FormLabel>
                         <Select onValueChange={(value) => {
                             setConditionalValue(value);
                             // This is a trick to re-evaluate the form with new fields
                             setTimeout(() => form.reset(generateFormConfig(parseInt(value, 10)).defaults), 0);
                         }} defaultValue={conditionalValue}>
                            <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {service.conditionalFields.fieldValues.map(val => (
                                    <SelectItem key={val} value={val}>{val}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <Separator />

                {Array.from({ length: parseInt(conditionalValue, 10) }).map((_, index) => (
                  <div key={index} className="space-y-4 rounded-md border p-4">
                    <p className="font-medium">Details for Item #{index + 1}</p>
                    {service.conditionalFields?.duplicatedDocuments.map(doc =>
                      renderField(doc.label, doc.type, `${doc.label.replace(/\s/g, '')}_${index + 1}`)
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" disabled={isUploading || !form.formState.isValid}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? 'Submitting...' : 'Submit Information'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
