
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Order } from '@/lib/types';
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

export default function DashboardPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const monthlyPackages = [
        {
            title: 'Monthly Accounting (Non-VAT)',
            price: 'R850',
            priceDetail: '/month',
            features: [
                'Up to 50 transactions',
                'Bank reconciliations',
                'Monthly management reports',
                'Annual Financial Statements',
                'Company & Personal Tax Returns'
            ]
        },
        {
            title: 'Monthly Accounting (VAT)',
            price: 'R1,950',
            priceDetail: '/month',
            features: [
                'Up to 100 transactions',
                'Includes all Non-VAT features',
                'Bi-monthly VAT201 submissions'
            ]
        },
        {
            title: 'Monthly Payroll',
            price: 'R550',
            priceDetail: '/month + R110 / employee',
            features: [
                'Monthly payslips',
                'EMP201 submissions (PAYE, UIF, SDL)',
                'UIF Declaration',
                'Included EMP501 recons x 2',
            ]
        },
    ];

    useEffect(() => {
        const fetchOrders = async () => {
            if (!user?.uid) return;
            setIsLoading(true);
            try {
                const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('date', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedOrders = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        date: data.date.toDate(),
                    } as Order;
                });
                setOrders(fetchedOrders);
            } catch (error) {
                console.error("Error fetching orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [user]);

    const getStatusVariant = (status: Order['status']) => {
        switch (status) {
            case 'Completed': return 'success';
            case 'Processing': return 'info';
            case 'Pending Payment': return 'warning';
            case 'Cancelled': return 'destructive';
            default: return 'secondary';
        }
    };
    
     const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                <p className="text-muted-foreground">Here's a summary of your recent activity and available services.</p>
            </div>

            <section id="packages">
                <div className="space-y-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Monthly Service Packages</h2>
                        <p className="text-muted-foreground">Automate your finances with our comprehensive monthly packages.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
                        {monthlyPackages.map((pkg) => (
                            <Card key={pkg.title} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{pkg.title}</CardTitle>
                                    <div className="flex items-baseline pt-2">
                                        <span className="text-3xl font-bold">{pkg.price}</span>
                                        {pkg.priceDetail && <span className="ml-1.5 text-sm text-muted-foreground">{pkg.priceDetail}</span>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <ul className="space-y-3">
                                        {pkg.features.map((feature, index) => (
                                            <li key={index} className="flex items-center gap-2 text-sm">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" asChild>
                                        <Link href="/contact">Contact Us</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>My Orders</CardTitle>
                    <CardDescription>A list of your recent product orders.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
                            <Button asChild className="mt-4">
                                <Link href="/products">Browse Products</Link>
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>{format(order.date, 'dd MMMM yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/dashboard/orders/${order.id}`}>
                                                    View <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
