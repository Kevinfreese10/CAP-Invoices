import { notFound } from 'next/navigation';
import { orders, services } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import DocumentUpload from '@/components/dashboard/DocumentUpload';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const order = orders.find(o => o.id === params.id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/dashboard/orders">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Order {order.id}</CardTitle>
                <CardDescription>
                Date: {order.date} | Status: <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'}>{order.status}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                {order.items.map(item => (
                    <div key={item.service.id} className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{item.service.title}</p>
                        <p className="text-sm text-muted-foreground">Quantity: 1</p>
                    </div>
                    <p>R {item.service.price.toFixed(2)}</p>
                    </div>
                ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R {order.total.toFixed(2)}</span>
                </div>
            </CardContent>
        </Card>

        <DocumentUpload orderId={order.id} />
    </div>
  );
}
