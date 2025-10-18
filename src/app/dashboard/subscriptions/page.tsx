
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubscriptionData, Order } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getNextOrderId } from '@/lib/sequence';
import { generatePayFastSignature } from '@/app/actions/payfast';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

const pricing = {
  free: 0,
  ai_addon: 450,
  extraUser: 50,
  extraCompany: 140,
};

const planDetails = {
    free: {
        title: 'Free Plan',
        description: 'Manage one company manually. Perfect for getting started.',
    },
    ai_addon: {
        title: 'AI Accountant Add-on',
        description: 'Unlock the power of AI for full automation.',
    },
};


export default function SubscriptionsPage() {
    const { user, updateUser } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [payfastFormData, setPayfastFormData] = useState<{ [key: string]: string } | null>(null);

    
    const [isAiActive, setIsAiActive] = useState(user?.subscription?.serviceLevel === 'ai_addon');
    const [extraUsers, setExtraUsers] = useState(user?.subscription?.extraUsers || 0);
    const [extraCompanies, setExtraCompanies] = useState(0); 
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const planPrice = isAiActive ? pricing.ai_addon : pricing.free;
    const usersPrice = extraUsers * pricing.extraUser;
    const companiesPrice = extraCompanies * pricing.extraCompany;
    const newTotal = planPrice + usersPrice + companiesPrice;

    useEffect(() => {
        if (payfastFormData) {
            const formElement = document.getElementById('payfast-redirect-form');
            if (formElement) {
                (formElement as HTMLFormElement).submit();
            }
        }
    }, [payfastFormData]);

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);
        
        toast({
            title: 'Processing Subscription Change...',
            description: 'Please wait while we redirect you to payment.',
        });

        try {
            const orderId = await getNextOrderId();
            const items = [];
            if (isAiActive) {
                items.push({ id: 'ai_addon', title: 'AI Accountant Add-on', price: pricing.ai_addon, quantity: 1 });
            }
            if (extraUsers > 0) {
                items.push({ id: 'extra_user', title: 'Additional Users', price: pricing.extraUser, quantity: extraUsers });
            }
             if (extraCompanies > 0) {
                items.push({ id: 'extra_company', title: 'Additional Companies', price: pricing.extraCompany, quantity: extraCompanies });
            }

            const orderData: Order = {
                id: orderId,
                userId: user.uid,
                customerName: user.name,
                customerEmail: user.email,
                items: items,
                total: newTotal,
                discountCode: null,
                discountAmount: null,
                status: 'Pending Payment',
                date: Timestamp.now(),
                source: 'AI Accountant Signup',
                renewalForClientId: user.uid,
            };
            
            await setDoc(doc(db, 'orders', orderId), orderData);
            
            const dataForSignature = {
                merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
                merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${orderId}`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions`,
                notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                email_address: user.email,
                m_payment_id: orderId,
                amount: newTotal.toFixed(2),
                item_name: `Subscription Update for ${user.name}`,
            };

            const signature = await generatePayFastSignature(dataForSignature);
            setPayfastFormData({ ...dataForSignature, signature });

        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not create subscription order.', variant: 'destructive'});
            setIsLoading(false);
            setIsConfirmOpen(false);
        }
    }
    
    if (!user) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const currentPlan = user.subscription?.serviceLevel || 'free';
    
    return (
        <>
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">My Subscription</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>Your active subscription and add-ons.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg">
                        <div>
                            <p className="font-semibold text-lg">{planDetails[currentPlan as keyof typeof planDetails].title}</p>
                             <p className="text-sm text-muted-foreground">{planDetails[currentPlan as keyof typeof planDetails].description}</p>
                        </div>
                        <p className="text-2xl font-bold text-primary">{formatPrice(user.subscription?.monthlyTotal || 0)}/month</p>
                    </div>
                </CardContent>
            </Card>

            <Separator />

             <div>
                <h2 className="text-2xl font-bold tracking-tight">Manage Your Plan</h2>
                <p className="text-muted-foreground">Upgrade, downgrade, or manage your subscription details.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Plan & Add-ons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label htmlFor="ai-addon-switch" className="font-semibold">AI Accountant Add-on</Label>
                            <p className="text-sm text-muted-foreground">Unlock AI-powered automation for your company.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold">{formatPrice(pricing.ai_addon)}/month</span>
                            <Switch
                                id="ai-addon-switch"
                                checked={isAiActive}
                                onCheckedChange={setIsAiActive}
                            />
                        </div>
                    </div>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="extra-companies">Additional Companies (+{formatPrice(pricing.extraCompany)} per company)</Label>
                            <Input
                                id="extra-companies"
                                type="number"
                                min="0"
                                value={extraCompanies}
                                onChange={(e) => setExtraCompanies(Number(e.target.value))}
                                className="w-24"
                            />
                        </div>
                         <div className="flex items-center justify-between">
                            <Label htmlFor="extra-users">Additional Users (+{formatPrice(pricing.extraUser)} per user)</Label>
                             <Input
                                id="extra-users"
                                type="number"
                                min="0"
                                value={extraUsers}
                                onChange={(e) => setExtraUsers(Number(e.target.value))}
                                className="w-24"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-4 bg-muted/50 p-4">
                     <div className="flex justify-between items-center w-full font-bold text-lg">
                        <span>New Monthly Total:</span>
                        <span>{formatPrice(newTotal)}</span>
                    </div>
                    <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">Save Changes</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Subscription Changes</DialogTitle>
                                <DialogDescription>Please review the changes to your monthly subscription.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Base Plan:</span>
                                        <span className="font-semibold">{isAiActive ? planDetails.ai_addon.title : planDetails.free.title}</span>
                                        <span className="font-semibold">{formatPrice(planPrice)}</span>
                                    </div>
                                    {extraCompanies > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Additional Companies ({extraCompanies} x {formatPrice(pricing.extraCompany)}):</span>
                                            <span className="font-semibold">{formatPrice(companiesPrice)}</span>
                                        </div>
                                    )}
                                    {extraUsers > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Additional Users ({extraUsers} x {formatPrice(pricing.extraUser)}):</span>
                                            <span className="font-semibold">{formatPrice(usersPrice)}</span>
                                        </div>
                                    )}
                                </div>
                                <Separator/>
                                <div className="flex justify-between items-center font-bold text-lg">
                                    <span>New Monthly Total:</span>
                                    <span>{formatPrice(newTotal)}</span>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={isLoading}>
                                     {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Proceed to Payment
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardFooter>
            </Card>
        </div>
        {payfastFormData && (
            <form id="payfast-redirect-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" style={{ display: 'none' }}>
                {Object.entries(payfastFormData).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value as string} />
                ))}
            </form>
        )}
        </>
    );
}

