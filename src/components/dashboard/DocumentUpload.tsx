'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, File, X } from 'lucide-react';

const formSchema = z.object({
  documents: z.custom<FileList>().refine(files => files?.length > 0, 'At least one file is required.'),
});

export default function DocumentUpload({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setIsUploading(true);
    // Simulate upload
    setTimeout(() => {
      const newFiles = Array.from(data.documents);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setIsUploading(false);
      form.reset();
      toast({
        title: 'Files Uploaded',
        description: `${newFiles.length} file(s) have been successfully uploaded for order ${orderId}.`,
      });
    }, 1500);
  };
  
  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>Securely upload required documents for your order.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="documents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Files</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      multiple
                      className="cursor-pointer"
                      onChange={(e) => field.onChange(e.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </form>
        </Form>
        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium">Uploaded Files:</h4>
            <ul className="mt-2 space-y-2">
              {uploadedFiles.map((file, index) => (
                <li key={index} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                   <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                     <X className="h-4 w-4" />
                   </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
