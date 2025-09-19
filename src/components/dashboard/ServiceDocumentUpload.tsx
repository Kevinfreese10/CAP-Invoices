
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Service } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileText, X, Check, ThumbsDown, ThumbsUp, MoreVertical, File as FileIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';

type FieldStatus = 'pending' | 'approved' | 'declined';
type AllFieldStatuses = Record<string, FieldStatus>;

const formSchema = z.object({
  // We will build the schema dynamically
});

export default function ServiceDocumentUpload({ service, orderId }: { service: Service; orderId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const [fieldStatuses, setFieldStatuses] = useState<AllFieldStatuses>({});
  const [reason, setReason] = useState('');
  const [conditionalValue, setConditionalValue] = useState(service.conditionalFields?.fieldValues[0] || '1');

  const allFields = useMemo(() => {
    const fields = [...service.informationToUpload];
    if (service.conditionalFields?.enabled) {
      const count = parseInt(conditionalValue, 10);
      Array.from({ length: count }).forEach((_, index) => {
        service.conditionalFields?.duplicatedDocuments.forEach(doc => {
          fields.push({
            label: `${doc.label} #${index + 1}`,
            type: doc.type,
          });
        });
      });
    }
    return fields;
  }, [service, conditionalValue]);

  // Initialize statuses when component mounts or fields change
  useState(() => {
    const initialStatuses: AllFieldStatuses = {};
    allFields.forEach(field => {
      initialStatuses[field.label.replace(/\s/g, '')] = 'pending';
    });
    setFieldStatuses(initialStatuses);
  });


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
  
  useState(() => {
    form.reset(generateFormConfig(parseInt(conditionalValue, 10)).defaults);
  });


  const onSubmit = (data: z.infer<typeof dynamicSchema>) => {
    setIsUploading(true);
    toast({ title: "Submitting information...", description: "Please wait." });
    
    setTimeout(() => {
      const processedData: Record<string, any> = {};
      for (const key in data) {
        if (data[key] instanceof FileList) {
          processedData[key] = { name: (data[key] as FileList)[0].name, type: 'file' };
        } else {
          processedData[key] = { value: data[key], type: 'text' };
        }
      }
      
      setSubmittedData(processedData);
      setIsUploading(false);
      toast({
        title: 'Information Submitted',
        description: `Your documents and information for "${service.title}" have been received.`,
      });
    }, 2000);
  };

  const handleStatusChange = (fieldName: string, newStatus: FieldStatus) => {
    setFieldStatuses(prev => ({ ...prev, [fieldName]: newStatus }));
    toast({
        title: `Item ${newStatus}`,
        description: `The item has been marked as ${newStatus}.`
    });
    setReason('');
  };
  
  const handleDeclineWithReason = (fieldName: string) => {
     handleStatusChange(fieldName, 'declined');
     // In a real app, you'd save this reason along with the status
     console.log(`Declined ${fieldName} with reason: ${reason}`);
  }

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
  
  const renderReviewItem = (fieldName: string, submittedValue: { name?: string; value?: string; type: 'file' | 'text' }) => {
    const status = fieldStatuses[fieldName];
    const originalLabel = allFields.find(f => f.label.replace(/\s/g, '') === fieldName)?.label || fieldName;

    const getStatusIndicator = () => {
        switch (status) {
            case 'approved': return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Approved</Badge>;
            case 'declined': return <Badge variant="destructive">Declined</Badge>;
            default: return <Badge variant="secondary">Pending</Badge>;
        }
    };

    return (
        <div key={fieldName} className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center gap-4">
                {submittedValue.type === 'file' ? <FileIcon className="h-5 w-5 text-muted-foreground" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                <div>
                    <p className="font-medium">{originalLabel}</p>
                    <p className="text-sm text-muted-foreground">{submittedValue.name || submittedValue.value}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {getStatusIndicator()}
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(fieldName, 'approved')} disabled={status === 'approved'}>
                                <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" disabled={status === 'declined'}>
                                    <ThumbsDown className="mr-2 h-4 w-4" /> Decline
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reason for Declining</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please provide a clear reason why this item is being declined. This will be sent to the client.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea placeholder="e.g., The ID copy provided is not clear." value={reason} onChange={(e) => setReason(e.target.value)} />
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setReason('')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeclineWithReason(fieldName)}>Confirm Decline</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
  }

  // CLIENT VIEW (UPLOAD)
  if (user?.role === 'client' && !submittedData) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Required Information for: {service.title}</CardTitle>
                <CardDescription>Please complete the form below to proceed with your order.</CardDescription>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
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
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isUploading || !form.formState.isValid}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? 'Submitting...' : 'Submit Information'}
                </Button>
            </CardFooter>
            </form>
        </Form>
        </Card>
    );
  }
  
  // CLIENT VIEW (SUBMITTED) / ADMIN VIEW
  return (
     <Card>
      <CardHeader>
        <CardTitle>Required Information for: {service.title}</CardTitle>
        <CardDescription>
            {user?.role === 'client' ? 'Your information has been submitted for review.' : 'Review the information submitted by the client.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
         {submittedData ? (
             Object.keys(submittedData).map(fieldName => renderReviewItem(fieldName, submittedData[fieldName]))
         ) : (
             <div className="flex items-center justify-center flex-col gap-4 text-center p-8 text-muted-foreground">
                <FileText className="h-12 w-12" />
                <h3 className="text-xl font-semibold">Pending Submission</h3>
                <p>The client has not yet submitted the required information for this service.</p>
            </div>
         )}
      </CardContent>
    </Card>
  )
}

    