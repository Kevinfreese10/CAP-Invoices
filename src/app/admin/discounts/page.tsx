

'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DiscountCode } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { customAlphabet } from 'nanoid';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(6, 'Code must be at least 6 characters.').max(20, 'Code must be 20 characters or less.'),
  percentage: z.preprocess(val => Number(val), z.number().min(1, 'Percentage must be at least 1.').max(100, 'Percentage cannot exceed 100.')),
  clientEmail: z.string().email('A valid client email is required.'),
});

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

function DiscountForm({ discount, onSubmit, onCancel }: { discount: DiscountCode | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: discount?.id || '',
            code: discount?.id || `WELCOME-${nanoid()}`,
            percentage: discount?.percentage || 5,
            clientEmail: discount?.clientEmail || '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Discount Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="percentage" render={({ field }) => ( <FormItem><FormLabel>Percentage (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Client Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Discount</Button>
                </div>
            </form>
        </Form>
    )
}

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountCode | null>(null);
  const { toast } = useToast();
  
  const fetchDiscounts = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "discounts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedDiscounts = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DiscountCode));
        setDiscounts(fetchedDiscounts);
    } catch (error) {
        console.error("Error fetching discounts:", error);
        toast({ title: 'Error', description: 'Could not fetch discounts from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleAdd = () => {
    setSelectedDiscount(null);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (discountId: string) => {
    try {
        await deleteDoc(doc(db, "discounts", discountId));
        fetchDiscounts();
        toast({
            title: 'Discount Deleted',
            description: 'The discount code has been removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting discount:", error);
        toast({ title: 'Error', description: 'Could not delete discount code.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
        const discountRef = doc(db, "discounts", data.code);
        const discountData: Omit<DiscountCode, 'id'> = {
            percentage: data.percentage,
            status: 'active',
            clientEmail: data.clientEmail,
            createdAt: serverTimestamp(),
        };
        await setDoc(discountRef, discountData);
        toast({ title: 'Discount Created', description: `Code ${data.code} has been created.`});
        fetchDiscounts();
        setIsFormOpen(false);
        setSelectedDiscount(null);
    } catch (error) {
        console.error("Error saving discount:", error);
        toast({ title: 'Error', description: 'Could not save the discount.', variant: 'destructive'});
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return format(timestamp.toDate(), 'dd/MM/yyyy, HH:mm');
    }
    return format(new Date(timestamp), 'dd/MM/yyyy, HH:mm');
  };

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Manage Discounts</h1>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Discount
                    </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedDiscount ? 'Edit Discount' : 'Create New Discount'}</DialogTitle>
                        <DialogDescription>
                            {selectedDiscount ? 'This feature is not yet implemented.' : 'Manually create a new discount code for a client.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DiscountForm 
                        discount={selectedDiscount} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                    />
            </DialogContent>
            </Dialog>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>All Generated Discount Codes</CardTitle>
                <CardDescription>View all discount codes generated through the compliance form or manually.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                 ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Client Email</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {discounts.map(d => (
                        <TableRow key={d.id}>
                        <TableCell className="font-mono">{d.id}</TableCell>
                        <TableCell>{d.clientEmail}</TableCell>
                        <TableCell>{d.percentage}%</TableCell>
                        <TableCell>
                            <Badge variant={d.status === 'active' ? 'success' : 'secondary'}>{d.status}</Badge>
                        </TableCell>
                        <TableCell>{d.orderId || 'N/A'}</TableCell>
                        <TableCell>{formatDate(d.createdAt)}</TableCell>
                        <TableCell className="text-right">
                             <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete the discount code <span className="font-semibold">{d.id}</span>.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(d.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                 )}
            </CardContent>
        </Card>
    </div>
  );
}
