
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Order, Service, User } from '@/lib/types';
import { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, onSnapshot, setDoc, doc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ArrowRight, CheckCircle, Clock, Banknote, FileSpreadsheet, TrendingUp, ShieldCheck, Users, Briefcase, BrainCircuit, UserPlus, BadgeDollarSign, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import ServicePreview from '@/components/admin/ServicePreview';
import { useToast } from '@/hooks/use-toast';
import { getNextOrderId } from '@/lib/sequence';
import { generatePayFastSignature } from '@/app/actions/payfast';
import { Input } from '@/components/ui/input';


const db = getFirestore(firebaseApp);

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

const formatPrice = (price: number) => {
    // Use simple formatting to avoid hydration mismatch between server/client
    return `R ${price.toLocaleString('en-US')}`;
};


export default function DashboardPage() {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingService, setViewingService] = useState<Service | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [payfastFormData, setPayfastFormData] = useState<{ [key: string]: string } | null>(null);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const monthlyPackages = [
        {
            title: 'Monthly Accounting (Non-VAT)',
            price: 'R950',
            priceDetail: '/month',
            features: [
                'Annual financial statements',
                'Provisional tax returns (2 per year)',
                'Annual income tax return',
                'CIPC annual return',
                'B-BBEE certificate or affidavit',
                'Beneficial ownership declaration',
                'Tax clearance certificate',
            ]
        },
        {
            title: 'Monthly Accounting (VAT Registered)',
            price: 'R2450',
            priceDetail: '/month',
            features: [
                'Annual financial statements',
                'Provisional tax returns (2 per year)',
                'Annual income tax return',
                'CIPC annual return',
                'B-BBEE certificate or affidavit',
                'Beneficial ownership declaration',
                'Tax clearance certificate',
                'Bi-monthly VAT201 submissions',
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
                'IRP5s',
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

    useEffect(() => {
        if (payfastFormData) {
          const formElement = document.getElementById('payfast-redirect-form') as HTMLFormElement;
          if (formElement) {
            formElement.submit();
          }
        }
    }, [payfastFormData]);

    const handleBuyNow = async (service: Service) => {
        if (!user) {
            toast({ title: 'Not Logged In', description: 'Please log in to make a purchase.', variant: 'destructive'});
            return;
        }

        setIsProcessingPayment(true);
        toast({ title: "Processing Order...", description: "Please wait while we redirect you to payment."});

        try {
            const orderId = await getNextOrderId();
            const orderData: Order = {
                id: orderId,
                userId: user.uid,
                customerName: user.name,
                customerEmail: user.email,
                items: [{ id: service.id, title: service.title, price: service.price, quantity: 1 }],
                total: service.price,
                discountCode: null,
                discountAmount: null,
                status: 'Pending Payment',
                date: Timestamp.now(),
                source: 'Client',
                department: service.department || null,
            };

            await setDoc(doc(db, 'orders', orderId), orderData);

            const dataForSignature = {
                merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
                merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${orderId}`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
                notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                email_address: user.email,
                m_payment_id: orderId,
                amount: service.price.toFixed(2),
                item_name: service.title,
            };

            const signature = await generatePayFastSignature(dataForSignature);
            setPayfastFormData({ ...dataForSignature, signature });

        } catch (error) {
            console.error("Error creating order:", error);
            toast({ title: 'Error', description: 'Could not create your order.', variant: 'destructive'});
            setIsProcessingPayment(false);
        }
    };

    const categorizedServices = useMemo(() => {
        return categories
        .map(category => ({
            ...category,
            data: services.filter(s => s.category === category.name)
        }))
        .filter(c => c.data.length > 0);
    }, [categories, services]);
    
     const formatPriceFmt = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: price % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(price);
    };

     const filteredCategorizedServices = useMemo(() => {
        if (!searchTerm) {
            return categorizedServices;
        }
        return categorizedServices
            .map(category => ({
                ...category,
                data: category.data.filter(service =>
                    service.title.toLowerCase().includes(searchTerm.toLowerCase())
                ),
            }))
            .filter(category => category.data.length > 0);
    }, [categorizedServices, searchTerm]);


    return (
        <>
            <Dialog onOpenChange={(isOpen) => !isOpen && setViewingService(null)}>
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
                    <Card>
                        <CardHeader>
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <CardTitle>Once-off Services</CardTitle>
                                    <CardDescription>Browse and purchase individual services.</CardDescription>
                                </div>
                                <div className="relative w-full sm:max-w-xs">
                                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                     <Input
                                        placeholder="Search for a service..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                             </div>
                        </CardHeader>
                        <CardContent className="space-y-8">
                             {filteredCategorizedServices.map(category => (
                                <section key={category.name}>
                                    <h3 className="text-xl font-semibold mb-4">{category.name}</h3>
                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Service</TableHead>
                                                    <TableHead className="text-left w-48">Turnaround Time</TableHead>
                                                    <TableHead className="text-right w-32">Price</TableHead>
                                                    <TableHead className="text-right w-32">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {category.data.map(service => (
                                                    <TableRow key={service.id}>
                                                        <TableCell className="font-medium">{service.title}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-start text-sm text-muted-foreground">
                                                                <Clock className="mr-1.5 h-4 w-4" />
                                                                <span>{service.turnaroundTime}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">{formatPriceFmt(service.price)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm" onClick={() => setViewingService(service)}>Learn More</Button>
                                                            </DialogTrigger>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </section>
                            ))}
                            {filteredCategorizedServices.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">No services match your search.</p>
                            )}
                        </CardContent>
                    </Card>
                    )}
                </div>
            </div>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{viewingService?.title}</DialogTitle>
                    <DialogDescription>
                        {viewingService?.description}
                    </DialogDescription>
                </DialogHeader>
                {viewingService && (
                    <>
                        <ServicePreview service={viewingService} />
                        <DialogFooter>
                            <Button onClick={() => handleBuyNow(viewingService)} disabled={isProcessingPayment}>
                                {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Buy Now ({formatPriceFmt(viewingService.price)})
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
            </Dialog>

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

    