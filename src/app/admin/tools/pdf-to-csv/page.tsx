
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
import { Loader2, Download, Sparkles, FileText, Upload } from 'lucide-react';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import Papa from 'papaparse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formSchema = z.object({
  statement: z.custom<FileList>().refine((files) => files && files.length > 0, 'A PDF file is required.'),
});

type Transaction = {
  date: string;
  description: string;
  amount: number;
};

export default function PdfToCsvPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedTransactions, setExtractedTransactions] = useState<Transaction[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.statement[0];
    if (!file) {
      toast({ title: 'Error', description: 'No file selected.', variant: 'destructive' });
      return;
    }

    setIsExtracting(true);
    setExtractedTransactions([]);
    toast({ title: 'Extraction Started...', description: 'The AI is processing your bank statement.' });

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const result = await extractStatementData({ statementPdf: dataUrl });
        if (!result || !result.transactions || result.transactions.length === 0) {
          toast({ title: 'Extraction Failed', description: 'The AI could not extract any transactions. Please try a different file.', variant: 'destructive' });
        } else {
          setExtractedTransactions(result.transactions);
          toast({ title: 'Extraction Complete!', description: `${result.transactions.length} transactions were found.` });
        }
      } catch (error) {
        console.error('Statement extraction error:', error);
        toast({ title: 'Extraction Failed', description: 'Could not extract data from this PDF. Please ensure it is a valid bank statement.', variant: 'destructive' });
      } finally {
        setIsExtracting(false);
      }
    };
    reader.onerror = (error) => {
        console.error('File reading error:', error);
        toast({ title: 'File Error', description: 'Could not read the selected file.', variant: 'destructive' });
        setIsExtracting(false);
    };
  };

  const handleDownloadCsv = () => {
    if (extractedTransactions.length === 0) return;
    const csv = Papa.unparse(extractedTransactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">PDF to CSV Converter</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statement</CardTitle>
            <CardDescription>Upload a bank statement in PDF format to extract transactions into a CSV file using AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="statement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PDF Statement File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => field.onChange(e.target.files)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isExtracting}>
                  {isExtracting ? <Sparkles className="mr-2 h-4 w-4 animate-ping" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isExtracting ? 'Extracting Transactions...' : 'Extract Transactions'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Extracted Transactions</CardTitle>
            <CardDescription>Review the transactions extracted by the AI below.</CardDescription>
          </CardHeader>
          <CardContent>
            {isExtracting ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <Loader2 className="h-10 w-10 mb-4 animate-spin" />
                <p className="font-semibold">AI is processing...</p>
                <p className="text-sm mt-2">This may take a moment depending on the file size.</p>
              </div>
            ) : extractedTransactions.length > 0 ? (
                <div className="space-y-4">
                     <div className="max-h-80 overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractedTransactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{tx.date}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     </div>
                     <Button onClick={handleDownloadCsv} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
                </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <FileText className="h-10 w-10 mb-4" />
                <p className="font-semibold">No transactions extracted yet.</p>
                <p className="text-sm mt-2">Upload a PDF bank statement to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
