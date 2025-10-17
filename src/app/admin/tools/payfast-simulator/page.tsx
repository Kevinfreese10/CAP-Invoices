
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
import { Loader2, Send } from 'lucide-react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required.'),
});

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

function generateSignatureForITN(data: { [key: string]: any }, passphrase?: string): string {
    let pfParamString = '';
    for (const key in data) {
        if (key !== 'signature') {
            pfParamString += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    }
    pfParamString = pfParamString.slice(0, -1);
    if (passphrase) {
        pfParamString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }
    return crypto.createHash('md5').update(pfParamString).digest('hex');
}


export default function PayfastSimulatorPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSimulating(true);
    toast({ title: 'Simulating Payment...', description: `Sending ITN for Order ID: ${values.orderId}` });

    try {
        const orderRef = doc(db, 'orders', values.orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            toast({ title: 'Error', description: 'Order not found.', variant: 'destructive' });
            setIsSimulating(false);
            return;
        }
        const order = orderSnap.data() as Order;

        const payload: { [key: string]: any } = {
            m_payment_id: values.orderId,
            pf_payment_id: `SIM_${Date.now()}`,
            payment_status: 'COMPLETE',
            item_name: `Order #${values.orderId}`,
            item_description: 'Simulated Payment',
            amount_gross: order.total.toFixed(2),
            amount_fee: (-order.total * 0.02).toFixed(2),
            amount_net: (order.total * 0.98).toFixed(2),
            name_first: order.customerName.split(' ')[0],
            name_last: order.customerName.split(' ').slice(1).join(' '),
            email_address: order.customerEmail,
            merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
        };

        const passphrase = process.env.PAYFAST_PASSPHRASE || '';
        payload.signature = generateSignatureForITN(payload, passphrase);

        const formData = new FormData();
        for (const key in payload) {
            formData.append(key, payload[key]);
        }
        
        const response = await fetch('/api/payfast/notify', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            toast({
                title: 'Simulation Successful!',
                description: 'The ITN was sent and processed. Check the order status.',
            });
        } else {
             const errorText = await response.text();
             throw new Error(`Simulation failed with status ${response.status}: ${errorText}`);
        }

    } catch (error: any) {
        console.error("Simulation error:", error);
        toast({ title: 'Simulation Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">PayFast ITN Simulator</h1>
      <Card>
        <CardHeader>
          <CardTitle>Simulate a Payment</CardTitle>
          <CardDescription>
            Enter an order ID to simulate a successful payment notification from PayFast.
            This will trigger the same logic as a real payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter an order ID in 'Pending Payment' status" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSimulating}>
                {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Simulated ITN
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

