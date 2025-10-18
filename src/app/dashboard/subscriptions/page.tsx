
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubscriptionData } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

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
};

const planDetails = {
    free: {
        title: 'Free Plan',
        description: 'Manage one company manually. Perfect for getting started.',
        features: [
            '1 Company Profile',
            '1 User',
            'Manual Transaction Processing',
            'Basic Reporting',
        ],
    },
    ai_addon: {
        title: 'AI Accountant Add-on',
        description: 'Unlock the power of AI for full automation.',
        features: [
            'Automated AI transaction allocation',
            'Bank statement PDF reading',
            'Advanced real-time reports',
        ],
    },
};


export default function SubscriptionsPage() {
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    const [currentSubscription, setCurrentSubscription] = useState<SubscriptionData | undefined>(user?.subscription);
    const [pendingPlanChange, setPendingPlanChange] = useState<'free' | 'ai_addon' | null>(null);

    const handlePlanChange = () => {
        if (!pendingPlanChange) return;
        setCurrentSubscription(prev => ({ ...(prev as SubscriptionData), serviceLevel: pendingPlanChange }));
        setPendingPlanChange(null);
    };
    
    const handleSave = async () => {
        if (!user || !currentSubscription) return;
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateUser({ ...user, subscription: currentSubscription });
        setIsLoading(false);
    }
    
    if (!user) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const currentPlan = user.subscription?.serviceLevel || 'free';
    const newTotal = pendingPlanChange ? pricing[pendingPlanChange] + ((user.subscription?.extraUsers || 0) * pricing.extraUser) : 0;

    return (
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
            
            <Dialog open={!!pendingPlanChange} onOpenChange={(isOpen) => !isOpen && setPendingPlanChange(null)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                    {Object.entries(planDetails).map(([planKey, plan]) => {
                        const isCurrent = currentPlan === planKey;
                        const isUpgrade = pricing[planKey as keyof typeof pricing] > pricing[currentPlan as keyof typeof pricing];
                        return (
                            <Card key={planKey} className={`flex flex-col ${isCurrent ? 'border-primary' : ''}`}>
                                <CardHeader>
                                    <CardTitle>{plan.title}</CardTitle>
                                    <CardDescription>{plan.description}</CardDescription>
                                    <div className="flex items-baseline pt-4">
                                    <span className="text-4xl font-bold">{formatPrice(pricing[planKey as keyof typeof pricing])}</span>
                                    {planKey !== 'free' && <span className="text-sm text-muted-foreground">/month</span>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <ul className="space-y-3">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-center gap-2 text-sm">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span>{feature}</span>
                                        </li>
                                    ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    {isCurrent ? (
                                        <Button disabled className="w-full">Current Plan</Button>
                                    ) : (
                                        <DialogTrigger asChild>
                                            <Button 
                                                className="w-full"
                                                variant={isUpgrade ? 'default' : 'outline'}
                                                onClick={() => setPendingPlanChange(planKey as any)}
                                            >
                                                {isUpgrade ? 'Upgrade' : 'Downgrade'}
                                            </Button>
                                        </DialogTrigger>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Plan Change</DialogTitle>
                        <DialogDescription>Please review the changes to your monthly subscription.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">New Plan:</span>
                            <span className="font-semibold">{pendingPlanChange && planDetails[pendingPlanChange].title}</span>
                        </div>
                        <Separator/>
                        <div className="flex justify-between items-center font-bold text-lg">
                            <span>New Monthly Total:</span>
                            <span>{formatPrice(newTotal)}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPendingPlanChange(null)}>Cancel</Button>
                        <Button onClick={handlePlanChange}>Confirm Upgrade</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
