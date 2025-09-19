'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Separator } from '../ui/separator';

const db = getFirestore(firebaseApp);

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.preprocess(val => Number(val), z.number().min(1, 'Quantity must be at least 1.')),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
});

const formSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required.'),
  customerEmail: z.string().email('Invalid email address.'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type CreateOrderFormValues = z.infer<typeof formSchema>;

export default function CreateOrderForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      items: [{ description: '', quantity: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');

  useEffect(() => {
    const newTotal = watchedItems.reduce((acc, item) => {
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      return acc + quantity * price;
    }, 0);
    setTotal(newTotal);
  }, [watchedItems]);

  async function onSubmit(values: CreateOrderFormValues) {
    setIsLoading(true);
    toast({
      title: 'Creating Order...',
      description: 'Please wait while we generate the new order.',
    });

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    
    try {
      const orderData: Order = {
        id: orderId,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        items: values.items.map(item => ({ 
            id: item.description.toLowerCase().replace(/\s/g, '-'), // Simple ID generation
            title: item.description, 
            price: item.price,
            quantity: item.quantity
        })),
        total: total,
        status: 'Pending Payment',
        date: Timestamp.now(),
      };

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      toast({
        title: 'Order Created Successfully',
        description: `Order ${orderId} has been created.`,
      });
      
      setIsLoading(false);
      router.push('/admin/orders');

    } catch (error) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Order Creation Failed',
            description: 'There was a problem saving the order. Please try again.',
            variant: 'destructive',
        });
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Customer Full Name</FormLabel>
                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="customerEmail"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Customer Email Address</FormLabel>
                <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Order Items</h3>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded-md relative">
                         <div className="md:col-span-6">
                             <FormField
                                control={form.control}
                                name={`items.${index}.description`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                        <div className="md:col-span-2">
                             <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Qty</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                        <div className="md:col-span-3">
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Price (R)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1 flex items-end">
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => remove(index)}
                                className="w-full"
                                disabled={fields.length === 1}
                            >
                                <Trash className="h-4 w-4" />
                            </Button>
                         </div>
                    </div>
                ))}
            </div>
             <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ description: '', quantity: 1, price: 0 })}
            >
                <Plus className="mr-2 h-4 w-4" /> Add Line Item
            </Button>
        </div>

        <Separator />
        
        <div className="flex justify-end items-center">
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">R {total.toFixed(2)}</p>
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Creating Order...' : 'Create Order'}
        </Button>
      </form>
    </Form>
  );
}
