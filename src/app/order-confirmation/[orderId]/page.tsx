import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function OrderConfirmationPage({ params }: { params: { orderId: string } }) {
  return (
    <div className="container mx-auto flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="mt-4 text-2xl">Thank You For Your Order!</CardTitle>
                <CardDescription>
                    Your order <span className="font-semibold text-primary">{params.orderId}</span> has been placed successfully.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    You will receive an email confirmation shortly. To upload documents or track your order status, please visit your dashboard.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                    <Button asChild>
                        <Link href="/dashboard/orders">View My Orders</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/services">Continue Shopping</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
