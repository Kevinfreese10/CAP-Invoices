

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash, RefreshCw, Clock, ClipboardCheck } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service } from '@/lib/types';
import { Separator } from '../ui/separator';
import { services as allServices } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';

const db = getFirestore(firebaseApp);

const lineItemSchema = z.object({
  isCustom: z.boolean().default(false),
  serviceId: z.string().optional(),
  description: z.string().min(1, 'Description is required.'),
  quantity: z.preprocess(val => Number(val), z.number().min(1, 'Quantity must be at least 1.')),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
  discountType: z.enum(['fixed', 'percentage']).default('fixed'),
  discountValue: z.preprocess(val => Number(val) || 0, z.number().min(0, 'Discount cannot be negative.').optional()),
});

const formSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required.'),
  customerEmail: z.string().email('Invalid email address.'),
  customerPhone: z.string().min(10, 'A valid phone number is required.'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type CreateOrderFormValues = z.infer<typeof formSchema>;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

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
      customerPhone: '',
      items: [{ isCustom: false, serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0 }],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const watchedItems = form.watch('items');

  const calculateTotal = (items: any[]) => {
     return (items || []).reduce((acc, item) => {
        const quantity = item?.quantity || 0;
        const price = item?.price || 0;
        const discountValue = item?.discountValue || 0;
        const lineItemTotal = price * quantity;

        let discountAmount = 0;
        if (item.discountType === 'percentage') {
            discountAmount = lineItemTotal * (discountValue / 100);
        } else {
            discountAmount = discountValue * quantity;
        }

        return acc + (lineItemTotal - discountAmount);
    }, 0);
  }

  useEffect(() => {
    const subscription = form.watch((value) => {
        setTotal(calculateTotal(value.items || []));
    });
    return () => subscription.unsubscribe();
  }, [form]);
  
  useEffect(() => {
    setTotal(calculateTotal(form.getValues('items')));
  }, []);

  const handleServiceChange = (serviceId: string, index: number) => {
    const selectedService = allServices.find(s => s.id === serviceId);
    if (selectedService) {
        form.setValue(`items.${index}.description`, selectedService.title);
        form.setValue(`items.${index}.price`, selectedService.price);
        form.trigger(`items.${index}`);
    }
  };

  const getLineItemTotal = (item: any) => {
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    const discountValue = item.discountValue || 0;
    const lineItemTotal = price * quantity;

    let discountAmount = 0;
    if (item.discountType === 'percentage') {
        discountAmount = lineItemTotal * (discountValue / 100);
    } else {
        discountAmount = discountValue * quantity;
    }
    return (lineItemTotal - discountAmount);
  };


  async function onSubmit(values: CreateOrderFormValues) {
    setIsLoading(true);
    toast({
      title: 'Creating Order...',
      description: 'Please wait while we generate the new order.',
    });

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    
    try {
        const firstService = allServices.find(s => s.id === values.items[0]?.serviceId);
        const department = firstService?.department;

      const orderData: Order = {
        id: orderId,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        items: values.items.map(item => ({ 
            id: item.serviceId || item.description.toLowerCase().replace(/\s/g, '-'),
            title: item.description, 
            price: item.price,
            quantity: item.quantity
        })),
        total: total,
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: department || null,
        assignedTo: null,
        source: 'Staff',
      };

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      // Send confirmation email
      const emailHtml = render(<OrderConfirmationEmail order={orderData} />);
      await sendEmail({
        to: values.customerEmail,
        bcc: 'kev@thinkestry.co.za',
        subject: `Your My Accountant Order Confirmation: #${orderId}`,
        html: emailHtml,
      });

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <FormLabel>Customer Email</FormLabel>
                <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="customerPhone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Customer Phone</FormLabel>
                <FormControl><Input placeholder="0821234567" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Order Items</h3>
            <div className="space-y-4">
                {fields.map((field, index) => {
                    const isCustom = form.watch(`items.${index}.isCustom`);
                    const lineItem = form.watch(`items.${index}`);
                    const serviceId = form.watch(`items.${index}.serviceId`);
                    const selectedService = serviceId ? allServices.find(s => s.id === serviceId) : null;
                    
                    return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 p-3 border rounded-md relative">
                         <div className="md:col-span-4 space-y-2">
                             {isCustom ? (
                                 <FormField
                                    control={form.control}
                                    name={`items.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Description</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             ) : (
                                <>
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.serviceId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Service</FormLabel>
                                            <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value, index);}} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {allServices.map(service => (
                                                        <SelectItem key={service.id} value={service.id}>{service.title}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {selectedService && (
                                    <div className="text-xs space-y-2 pt-2">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{selectedService.turnaroundTime}</span>
                                        </div>
                                        {selectedService.clientRequirements.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="font-medium">Prerequisites:</p>
                                                <ul className="list-disc pl-5">
                                                    {selectedService.clientRequirements.map((req, i) => <li key={i}>{req}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                                </>
                             )}
                             <FormField
                                control={form.control}
                                name={`items.${index}.isCustom`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 pt-2">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs !mt-0">Enter custom item</FormLabel>
                                    </FormItem>
                                )}
                            />
                         </div>
                        <div className="md:col-span-1">
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
                        <div className="md:col-span-2">
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Unit Price (R)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-2">
                             <FormField
                                control={form.control}
                                name={`items.${index}.discountType`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Discount</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed (R)</SelectItem>
                                                <SelectItem value="percentage">Percent (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1">
                             <FormField
                                control={form.control}
                                name={`items.${index}.discountValue`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Value</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1 flex items-end">
                            <p className="text-right w-full font-semibold">
                                {formatPrice(getLineItemTotal(lineItem))}
                            </p>
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
                )})}
            </div>
            <div className="flex gap-2">
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => append({ isCustom: false, serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0 })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Line Item
                </Button>
                 <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => form.trigger()}
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Update Totals & Validate
                </Button>
            </div>
        </div>

        <Separator />
        
        <div className="flex justify-end items-start gap-8">
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatPrice(total)}</p>
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading || !form.formState.isValid || total === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Creating Order...' : 'Create Order'}
        </Button>
      </form>
    </Form>
  );
}
