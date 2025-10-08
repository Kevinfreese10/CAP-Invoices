
'use client';

import { useState, useEffect } from 'react';
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
import { ImportedTransaction, ChartOfAccount, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

const bankAccountSchema = z.object({
  bankName: z.string().min(2, 'Bank name is required.'),
});

const fileImportSchema = z.object({
  file: z.custom<FileList>().refine((files) => files && files.length > 0, 'A file is required.'),
});


export default function BankPage() {
  const [client, setClient] = useState<User | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importedTransactions, setImportedTransactions] = useState<any[]>([]);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();

  const bankForm = useForm<z.infer<typeof bankAccountSchema>>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { bankName: '' },
  });
  
  const importForm = useForm<z.infer<typeof fileImportSchema>>({
    resolver: zodResolver(fileImportSchema),
  });

  const fetchClient = async () => {
    if (!clientId) return;
    setIsLoadingClient(true);
    try {
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
            setClient(clientData);
            const cashbookAccounts = clientData.chartOfAccounts?.filter(
                acc => acc.accountNumber.startsWith('8400/')
            ) || [];
            setBankAccounts(cashbookAccounts);
        } else {
            toast({ title: 'Error', description: 'Client not found.', variant: 'destructive'});
        }
    } catch (e) {
        toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive'});
    } finally {
        setIsLoadingClient(false);
    }
  }
  
  useEffect(() => {
    fetchClient();
  }, [clientId]);

  const onAddBankAccount = async (values: z.infer<typeof bankAccountSchema>) => {
    if (!client || !client.id) {
        toast({ title: 'Error', description: 'Client data is not loaded.', variant: 'destructive' });
        return;
    }
    
    // Find the next available account number
    const existingBankNumbers = bankAccounts.map(acc => parseInt(acc.accountNumber.split('/')[1], 10));
    const nextNumber = existingBankNumbers.length > 0 ? Math.max(...existingBankNumbers) + 1 : 1;
    const newAccountNumber = `8400/${String(nextNumber).padStart(3, '0')}`;
    
    const newAccount: ChartOfAccount = {
        id: newAccountNumber,
        accountNumber: newAccountNumber,
        description: values.bankName,
        section: 'Balance Sheet',
    };

    try {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, {
            chartOfAccounts: arrayUnion(newAccount)
        });
        toast({ title: 'Success', description: 'Bank account added successfully.' });
        bankForm.reset();
        setIsAddAccountOpen(false);
        await fetchClient(); // Re-fetch to get updated accounts list
    } catch (e) {
        toast({ title: 'Error', description: 'Failed to save new bank account.', variant: 'destructive' });
        console.error(e);
    }
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
           {isLoadingClient ? (
                <Loader2 className="h-6 w-6 animate-spin" />
           ) : bankAccounts.length > 0 ? (
                <ul className="space-y-2">
                    {bankAccounts.map((acc, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md">
                            <div className="flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">{acc.description}</p>
                                    <p className="text-xs text-muted-foreground">{acc.accountNumber}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
           ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No bank accounts added yet.</p>
           )}
          <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Bank Account</DialogTitle>
                <DialogDescription>Enter the name of the new bank account.</DialogDescription>
              </DialogHeader>
              <Form {...bankForm}>
                <form onSubmit={bankForm.handleSubmit(onAddBankAccount)} className="space-y-4">
                    <FormField control={bankForm.control} name="bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} placeholder="e.g. FNB Cheque Account" /></FormControl><FormMessage /></FormItem> )} />
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
