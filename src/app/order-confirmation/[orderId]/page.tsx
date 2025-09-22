import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Banknote, Clock, Building } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function OrderConfirmationPage({ params }: { params: { orderId: string } }) {
  return (
    <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex justify-center md:justify-end">
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
                            Your order is pending payment. Please follow the EFT instructions to complete your purchase. An email has also been sent to you with these details.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <div className="w-full flex flex-col sm:flex-row justify-center gap-4">
                            <Button variant="outline" asChild>
                                <Link href="/services">Continue Shopping</Link>
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>

             <div className="flex justify-center md:justify-start">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Banknote className="h-6 w-6 text-primary" />
                            <CardTitle>Manual EFT Instructions</CardTitle>
                        </div>
                        <CardDescription>
                            Please make payment to the details below to finalize your order.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Bank Name:</p>
                            <p className="text-lg font-semibold p-2 bg-muted rounded-md">FNB</p>
                        </div>
                         <div className="space-y-2">
                            <p className="text-sm font-medium">Account Holder:</p>
                            <p className="text-lg font-semibold p-2 bg-muted rounded-md">My Accountant (Pty) Ltd</p>
                        </div>
                         <div className="space-y-2">
                            <p className="text-sm font-medium">Account Number:</p>
                            <p className="text-lg font-semibold p-2 bg-muted rounded-md">6280 123 4567</p>
                        </div>
                         <div className="space-y-2">
                            <p className="text-sm font-medium">Branch Code:</p>
                            <p className="text-lg font-semibold p-2 bg-muted rounded-md">250655</p>
                        </div>
                         <div className="space-y-2">
                            <p className="text-sm font-medium">Reference:</p>
                            <p className="text-lg font-semibold p-2 bg-destructive/10 text-destructive rounded-md">{params.orderId}</p>
                        </div>
                        <Separator />
                        <div>
                             <div className="flex items-center gap-3 mb-2">
                                <Building className="h-6 w-6 text-primary" />
                                <h3 className="text-base font-semibold">Cash Payments</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                We also accept cash payments at our offices: <strong>369 Oak Avenue, Ferndale, Randburg</strong>.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Clock className="h-4 w-4" />
                                <span>Office Hours: Mon - Fri, 8:00 AM - 5:00 PM</span>
                            </div>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <p className="text-xs text-muted-foreground">Please use your Order ID as the payment reference for EFTs. Your order will be processed once payment is confirmed.</p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    </div>
  );
}