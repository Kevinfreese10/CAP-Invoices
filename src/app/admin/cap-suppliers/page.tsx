
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
import { Loader2, Upload, Sparkles, FileText, TableIcon } from 'lucide-react';
import Image from 'next/image';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

const formSchema = z.object({
  invoice: z.custom<FileList>().refine((files) => files && files.length > 0, 'An invoice file is required.'),
});

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function CAPSuppliersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractInvoiceDataOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExtractedData(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.invoice[0];
    if (!preview) {
      toast({ title: 'Error', description: 'No file preview available.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setExtractedData(null);
    toast({ title: 'Processing Invoice...', description: 'The AI is extracting data from your invoice. Please wait.' });

    try {
      const result = await extractInvoiceData({
        invoiceImage: preview,
      });
      setExtractedData(result);
      toast({ title: 'Extraction Complete!', description: 'Data has been successfully extracted from the invoice.' });
    } catch (error) {
      console.error('Invoice extraction error:', error);
      toast({ title: 'Extraction Failed', description: 'Could not extract data from the invoice. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Upload Invoice</CardTitle>
            <CardDescription>Upload an invoice PDF to automatically extract its details using AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="invoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice File</FormLabel>
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
                {preview && (
                  <div className="relative mt-4 aspect-auto w-full overflow-hidden rounded-md border h-[700px]">
                    <object data={preview} type="application/pdf" width="100%" height="100%">
                        <p>This browser does not support PDF previews. Please download the PDF to view it: <a href={preview}>Download PDF</a></p>
                    </object>
                  </div>
                )}
                <Button type="submit" disabled={isLoading || !preview}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isLoading ? 'Extracting Data...' : 'Extract Data with AI'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
            <CardDescription>The data extracted from the invoice will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            )}
            {!isLoading && !extractedData && (
                 <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                    <FileText className="h-10 w-10 mb-4" />
                    <p className="font-semibold">Your extracted data will be displayed here.</p>
                    <p className="text-sm">Upload an invoice and click "Extract Data" to begin.</p>
                </div>
            )}
            {extractedData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><h4 className="font-semibold">Supplier:</h4><p>{extractedData.supplier}</p></div>
                    <div><h4 className="font-semibold">Date:</h4><p>{extractedData.date}</p></div>
                </div>
                 <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2"><TableIcon className="h-4 w-4" /> Line Items</h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Exclusive</TableHead>
                                <TableHead className="text-right">VAT</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {extractedData.lineItems.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right">{formatPrice(item.exclusiveAmount)}</TableCell>
                                    <TableCell className="text-right">{formatPrice(item.vatAmount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold text-lg">Invoice Total</TableCell>
                                <TableCell className="text-right font-bold text-lg">{formatPrice(extractedData.invoiceTotal)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
