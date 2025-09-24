
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChartOfAccount } from '@/lib/types';
import { chartOfAccounts } from '@/lib/chart-of-accounts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const accountSections: ChartOfAccount['section'][] = ['Income Statement', 'Balance Sheet'];

const formSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().regex(/^\d{4}\/\d{3}$/, 'Account number must be in XXXX/XXX format.'),
  description: z.string().min(3, 'Description is required.'),
  section: z.enum(accountSections),
});

function AccountForm({ account, onSubmit, onCancel }: { account: ChartOfAccount | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: account?.id || '',
            accountNumber: account?.accountNumber || '',
            description: account?.description || '',
            section: account?.section || 'Income Statement',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 1000/000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{accountSections.map(section => <SelectItem key={section} value={section}>{section}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Account</Button>
                </div>
            </form>
        </Form>
    )
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>(chartOfAccounts);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const { toast } = useToast();

  const handleAdd = () => {
    setSelectedAccount(null);
    setIsFormOpen(true);
  };

  const handleEdit = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setIsFormOpen(true);
  };
  
  const handleDelete = (accountId: string) => {
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    toast({
        title: 'Account Deleted',
        description: 'The account has been removed.',
        variant: 'destructive',
    })
  };

  const handleFormSubmit = (data: Omit<ChartOfAccount, 'id'>) => {
    if (selectedAccount) {
      // Update
      setAccounts(prev =>
        prev.map(a => (a.id === selectedAccount.id ? { ...a, ...data, id: data.accountNumber } : a))
      );
       toast({
        title: 'Account Updated',
        description: 'The account details have been saved.',
      });
    } else {
      // Add
      const newAccount = { ...data, id: data.accountNumber };
      setAccounts(prev => [...prev, newAccount].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)));
       toast({
        title: 'Account Created',
        description: 'The new account has been added.',
      });
    }
    setIsFormOpen(false);
    setSelectedAccount(null);
  };

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Account
                    </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedAccount ? 'Edit Account' : 'Create New Account'}</DialogTitle>
                        <DialogDescription>
                            {selectedAccount ? 'Update the details for this account.' : 'Enter the details for a new account.'}
                        </DialogDescription>
                    </DialogHeader>
                    <AccountForm 
                        account={selectedAccount} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                    />
            </DialogContent>
            </Dialog>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Standard Chart of Accounts</CardTitle>
                <CardDescription>Manage the general ledger accounts for financial reporting.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {accounts.map(account => (
                        <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.accountNumber}</TableCell>
                        <TableCell className="font-medium">{account.description}</TableCell>
                        <TableCell>{account.section}</TableCell>
                        <TableCell className="text-right">
                            <AlertDialog>
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleEdit(account)}>
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive">
                                            Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the account:
                                        <span className="font-semibold"> {account.description}</span>.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(account.id)}>
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
