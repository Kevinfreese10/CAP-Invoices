
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Rocket, ShieldCheck, Wallet, Clock, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { collection, getDocs, orderBy, query, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';

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


export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const whyChooseUs = [
    {
      title: 'Expert & Reliable',
      description: 'Our team of seasoned professionals ensures accuracy and dependability.',
      icon: ShieldCheck,
    },
    {
      title: 'Affordable Pricing',
      description: 'Transparent, competitive rates with no hidden costs.',
      icon: Wallet,
    },
    {
      title: 'Fast Turnaround',
      description: 'We prioritize efficiency to meet your deadlines without compromising quality.',
      icon: Rocket,
    },
  ];
  
  const categorizedServices = useMemo(() => {
    let filteredServices = services;
    if (searchTerm) {
        filteredServices = services.filter(service => 
            service.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    return categories
      .map(category => ({
          ...category,
          data: filteredServices.filter(s => s.category === category.name)
      }))
      .filter(c => c.data.length > 0);
  }, [categories, services, searchTerm]);


  return (
    <div className="space-y-16 pb-16">
      <section 
        className="relative bg-cover bg-center bg-no-repeat"
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center text-white">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              South Africa’s leading online <span className="text-gradient">#accounting</span> and <span className="text-gradient">#tax</span> store
            </h1>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="#products">Explore Products</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trustindex Reviews Widget */}
      <TrustIndexWidget />

      <section className="bg-background pt-16">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose My Accountant?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We're committed to providing you with the best service possible.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {whyChooseUs.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-2xl px-4">
          <form className="relative" onSubmit={(e) => e.preventDefault()}>
            <Input
              type="search"
              placeholder="Search for a product (e.g., 'Company Registration')"
              className="h-12 w-full rounded-md border-input bg-background pr-14 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div
              className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 flex items-center justify-center"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">Search</span>
            </div>
          </form>
        </div>
      </section>
      
        <div id="products" className="container mx-auto px-4 space-y-12 scroll-m-20">
            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : (
              categorizedServices.length > 0 ? (
                categorizedServices.map(category => (
                <section key={category.name} id={category.name.toLowerCase().replace(/ /g, '-')}>
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold">{category.name}</h2>
                        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                            {category.description}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {category.data.map(service => (
                        <Card
                        key={service.id}
                        className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                        >
                        <CardHeader>
                            <CardTitle>{service.title}</CardTitle>
                            <p className="text-2xl font-bold text-primary pt-2">{formatPrice(service.price)}</p>
                            <div className="flex items-center text-muted-foreground pt-1">
                                <Clock className="h-4 w-4 mr-1.5" />
                                <span className="text-xs font-medium">{service.turnaroundTime}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <CardDescription>{service.description}</CardDescription>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full">
                            <Link href={`/products/${service.slug}`}>Learn More</Link>
                            </Button>
                        </CardFooter>
                        </Card>
                    ))}
                    </div>
                </section>
                ))
              ) : (
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">No services found for "{searchTerm}".</p>
                 </div>
              )
            )}
      </div>
    </div>
  );
}
