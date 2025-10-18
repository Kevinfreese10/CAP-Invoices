
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubscriptionData } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

const pricing = {
  free: 0,
  ai_addon: 450,
  monthly_non_vat: 950,
  monthly_vat: 2450,
  extraUser: 50,
  submissions: 150,
  payslip: 110,
  payrollSetup: 550,
  catchUp: 750,
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
    monthly_non_vat: {
        title: 'Monthly Accounting (Non-VAT)',
        description: 'Comprehensive accounting for non-VAT registered companies.',
        features: [
            'Annual financial statements',
            'Provisional tax returns (2 per year)',
            'Annual income tax return',
            'CIPC annual return',
            'B-BBEE certificate or affidavit',
            'Beneficial ownership declaration',
            'Tax clearance certificate',
        ],
    },
    monthly_vat: {
        title: 'Monthly Accounting (VAT Registered)',
        description: 'Full-service accounting for VAT registered companies.',
        features: [
            'All features of the Non-VAT plan',
            'Bi-monthly VAT201 submissions',
        ],
    },
};


export default function SubscriptionsPage() {
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    // Local state to manage UI changes before saving
    const [currentSubscription, setCurrentSubscription] = useState<SubscriptionData | undefined>(user?.subscription);

    const handlePlanChange = (newPlan: 'free' | 'ai_addon' | 'monthly_non_vat' | 'monthly_vat') => {
        // Here you would handle the logic for plan changes,
        // which might involve proration, confirmation modals, etc.
        // For now, we'll just optimistically update the state.
        console.log(`Changing plan to ${newPlan}`);
        setCurrentSubscription(prev => ({ ...(prev as SubscriptionData), serviceLevel: newPlan }));
    }
    
    const handleSave = async () => {
        if (!user || !currentSubscription) return;
        setIsLoading(true);
        // This is a placeholder for a server action that would handle
        // the subscription update, payment processing, etc.
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Optimistically update the user context
        updateUser({ ...user, subscription: currentSubscription });
        
        setIsLoading(false);
    }
    
    if (!user) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const currentPlan = user.subscription?.serviceLevel || 'free';

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
                            <p className="font-semibold text-lg">{planDetails[currentPlan].title}</p>
                             <p className="text-sm text-muted-foreground">{planDetails[currentPlan].description}</p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                {Object.entries(planDetails).map(([planKey, plan]) => {
                    const isCurrent = currentPlan === planKey;
                    const isUpgrade = pricing[planKey as keyof typeof pricing] > pricing[currentPlan];
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
                                     <Button 
                                        className="w-full"
                                        variant={isUpgrade ? 'default' : 'outline'}
                                        onClick={() => handlePlanChange(planKey as any)}
                                     >
                                        {isUpgrade ? 'Upgrade' : 'Downgrade'}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
}
