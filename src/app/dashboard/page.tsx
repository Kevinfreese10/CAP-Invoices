
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Order, Service } from '@/lib/types';
import { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};


export default function DashboardPage() {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const monthlyPackages = [
        {
            title: 'Monthly Accounting (Non-VAT)',
            price: 'R950',
            priceDetail: '/month',
            features: [
                'Annual Financial Statements',
                'Provisional tax returns (2 per year)',
                'Annual income tax return',
                'CIPC annual return',
                'B-BBEE certificate or affidavit',
                'Beneficial ownership declaration',
                'Tax clearance certificate'
            ]
        },
        {
            title: 'Monthly Accounting (VAT Registered)',
            price: 'R2,450',
            priceDetail: '/month',
            features: [
                'Annual Financial Statements',
                'Provisional tax returns (2 per year)',
                'Annual income tax return',
                'CIPC annual return',
                'B-BBEE certificate or affidavit',
                'Beneficial ownership declaration',
                'Tax clearance certificate',
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
        const servicesUnsubscribe = onSnapshot(query(collection(db, 'services'), orderBy('title')), (snapshot) => {
            const fetchedServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
            setServices(fetchedServices);
            setIsLoading(false);
        });
        
        const categoriesUnsubscribe = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
            const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
            setCategories(fetchedCategories);
        });

        return () => {
        servicesUnsubscribe();
        categoriesUnsubscribe();
        }
  }, []);

    const categorizedServices = useMemo(() => {
        return categories
        .map(category => ({
            ...category,
            data: services.filter(s => s.category === category.name)
        }))
        .filter(c => c.data.length > 0);
    }, [categories, services]);
    
     const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: price % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
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

             <div className="space-y-12">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                ) : (
                categorizedServices.map(category => (
                    <section key={category.name}>
                        <h2 className="text-2xl font-bold mb-6">{category.name}</h2>
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Turnaround Time</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {category.data.map(service => (
                                            <TableRow key={service.id}>
                                                <TableCell className="font-medium">{service.title}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Clock className="mr-1.5 h-4 w-4" />
                                                        {service.turnaroundTime}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">{formatPrice(service.price)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/services/${service.slug}`}>Learn More</Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>
                ))
                )}
            </div>
        </div>
    );
}
