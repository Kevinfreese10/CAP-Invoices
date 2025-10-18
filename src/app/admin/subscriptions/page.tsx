'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BadgeDollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const db = getFirestore(firebaseApp);

type SubscriptionData = {
    serviceLevel: 'free' | 'ai_addon' | 'monthly_non_vat' | 'monthly_vat';
    extraUsers: number;
    includeSubmissions: boolean;
    includePayslips: boolean;
    payslipCount: number;
    includeCatchUp: boolean;
    monthlyTotal: number;
    catchUpFee: number;
    payrollSetupFee: number;
};

type SubscribedClient = User & {
    subscription: SubscriptionData;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

const getPlanName = (serviceLevel: SubscriptionData['serviceLevel']) => {
    switch (serviceLevel) {
        case 'free': return 'Free Plan';
        case 'ai_addon': return 'AI Accountant Add-on';
        case 'monthly_non_vat': return 'Monthly Accounting (Non-VAT)';
        case 'monthly_vat': return 'Monthly Accounting (VAT)';
        default: return 'Unknown Plan';
    }
}

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<SubscribedClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSubscriptions = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'aiAccountantClients'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedSubscriptions = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as SubscribedClient))
                    .filter(client => client.subscription); // Ensure subscription data exists
                setSubscriptions(fetchedSubscriptions);
            } catch (error) {
                console.error("Error fetching subscriptions:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSubscriptions();
    }, []);

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">AI Accountant Subscriptions</h1>
            <Card>
                <CardHeader>
                    <CardTitle>All Subscriptions</CardTitle>
                    <CardDescription>A log of all signups from the AI Accountant page.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : subscriptions.length === 0 ? (
                         <div className="text-center text-muted-foreground py-10">
                            <BadgeDollarSign className="mx-auto h-12 w-12" />
                            <p className="mt-4">No AI Accountant subscriptions found yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Monthly Total</TableHead>
                                    <TableHead>Once-off Fees</TableHead>
                                    <TableHead>Signup Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subscriptions.map(client => (
                                    <TableRow key={client.id}>
                                        <TableCell>
                                            <p className="font-semibold">{client.name}</p>
                                            <p className="text-xs text-muted-foreground">{client.email}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{getPlanName(client.subscription.serviceLevel)}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">{formatPrice(client.subscription.monthlyTotal)}</TableCell>
                                        <TableCell className="font-mono">{formatPrice(client.subscription.catchUpFee + client.subscription.payrollSetupFee)}</TableCell>
                                        <TableCell>
                                            {client.createdAt?.toDate ? new Date(client.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
