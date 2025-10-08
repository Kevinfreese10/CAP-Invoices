
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Download } from 'lucide-react';
import Papa from 'papaparse';

const formSchema = z.object({
  pdf: z.custom<FileList>().refine((files) => files && files.length > 0, 'A PDF file is required.'),
});

// Mock data for demonstration purposes
const mockCsvData = [
    { Date: '2024-01-01', Description: 'Opening Balance', Amount: '1000.00' },
    { Date: '2024-01-05', Description: 'DEBIT ORDE PAYMENT - TELKOM', Amount: '-150.00' },
    { Date: '2024-01-15', Description: 'PAYMENT RECEIVED - CLIENT ABC', Amount: '500.00' },
    { Date: '2024-01-25', Description: 'BANK CHARGES', Amount: '-25.00' },
];

export default function PDFConverterPage() {
  const [isConverting, setIsConverting] = useState(false);
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFileName(files[0].name);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsConverting(true);
    toast({ title: 'Conversion Started...', description: 'Your PDF is being processed.' });

    // In a real app, you would send the PDF to a backend or use a wasm-based
    // library to parse the PDF in the browser. For this demo, we'll simulate it.
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Set mock data
    setCsvData(mockCsvData);
    
    setIsConverting(false);
    toast({ title: 'Conversion Successful', description: 'Your CSV file is ready for download.' });
  };
  
  const handleDownload = () => {
    if (!csvData) return;

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const originalFileName = fileName.replace(/\.[^/.]+$/, "");
    link.setAttribute('download', `${originalFileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">PDF to CSV Converter</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upload PDF Statement</CardTitle>
          <CardDescription>Upload a bank statement in PDF format to convert it to a CSV file.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="pdf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PDF File</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          field.onChange(e.target.files);
                          handleFileChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-4">
                <Button type="submit" disabled={isConverting}>
                  {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isConverting ? 'Converting...' : 'Convert to CSV'}
                </Button>
                {csvData && (
                    <Button type="button" variant="secondary" onClick={handleDownload}>
                       <Download className="mr-2 h-4 w-4" />
                       Download CSV
                    </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
