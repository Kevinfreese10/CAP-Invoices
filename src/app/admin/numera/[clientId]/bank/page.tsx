
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Banknote, FileUp, Loader2, PlusCircle, TableIcon } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const bankAccountSchema = z.object({
  bankName: z.string().min(2, 'Bank name is required.'),
  accountNumber: z.string().min(5, 'A valid account number is required.'),
  accountName: z.string().min(2, 'Account name is required.'),
});

const fileImportSchema = z.object({
  file: z.custom<FileList>().refine((files) => files && files.length > 0, 'A file is required.'),
});


export default function BankPage() {
  const [bankAccounts, setBankAccounts] = useState<z.infer<typeof bankAccountSchema>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importedTransactions, setImportedTransactions] = useState<any[]>([]);

  const bankForm = useForm<z.infer<typeof bankAccountSchema>>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { bankName: '', accountNumber: '', accountName: '' },
  });
  
  const importForm = useForm<z.infer<typeof fileImportSchema>>({
    resolver: zodResolver(fileImportSchema),
  });

  const onAddBankAccount = (values: z.infer<typeof bankAccountSchema>) => {
    setBankAccounts([...bankAccounts, values]);
    bankForm.reset();
  };

  const handleFileImport = async (values: z.infer<typeof fileImportSchema>) => {
    setIsImporting(true);
    const file = values.file[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        const data = e.target?.result;
        let transactions: any[] = [];

        if (file.name.endsWith('.csv')) {
            const result = Papa.parse(data as string, { header: true });
            transactions = result.data;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            transactions = XLSX.utils.sheet_to_json(sheet);
        }
        setImportedTransactions(transactions);
        setIsImporting(false);
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>Manage the client's bank accounts.</CardDescription>
        </CardHeader>
        <CardContent>
           {bankAccounts.length > 0 ? (
                <ul className="space-y-2">
                    {bankAccounts.map((acc, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md">
                            <div className="flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">{acc.bankName} - {acc.accountName}</p>
                                    <p className="text-xs text-muted-foreground">{acc.accountNumber}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
           ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No bank accounts added yet.</p>
           )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Bank Account</DialogTitle>
                <DialogDescription>Enter the details of the new bank account.</DialogDescription>
              </DialogHeader>
              <Form {...bankForm}>
                <form onSubmit={bankForm.handleSubmit(onAddBankAccount)} className="space-y-4">
                    <FormField control={bankForm.control} name="bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={bankForm.control} name="accountName" render={({ field }) => ( <FormItem><FormLabel>Account Name / Type</FormLabel><FormControl><Input {...field} placeholder="e.g. Cheque Account" /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={bankForm.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <Button type="submit">Add Account</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Import Transactions</CardTitle>
            <CardDescription>Import bank statements from CSV or Excel files.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...importForm}>
                <form onSubmit={importForm.handleSubmit(handleFileImport)} className="flex gap-4">
                    <FormField control={importForm.control} name="file" render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => field.onChange(e.target.files)} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <Button type="submit" disabled={isImporting}>
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        Import
                    </Button>
                </form>
            </Form>

            {importedTransactions.length > 0 && (
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-2">
                        <TableIcon className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Imported Data Preview ({importedTransactions.length} rows)</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {Object.keys(importedTransactions[0]).map(key => <TableHead key={key}>{key}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {importedTransactions.slice(0, 10).map((row, index) => (
                                    <TableRow key={index}>
                                        {Object.values(row).map((val: any, i) => <TableCell key={i}>{val}</TableCell>)}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
