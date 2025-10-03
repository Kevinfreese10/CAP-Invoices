
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { services } from '@/lib/data';
import { Rocket, ShieldCheck, Wallet, Clock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

const formatPrice = (price: number) => {
    // Use simple formatting to avoid hydration mismatch between server/client
    return `R ${price.toLocaleString('en-US')}`;
};

export default function Home() {

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

  const serviceCategories = [
    { name: "SARS Services", description: "Comprehensive tax services to ensure you are compliant with SARS.", order: 1 },
    { name: "Entity Registrations", description: "Register your new business entity with all the necessary bodies.", order: 2 },
    { name: "CIPC Services", description: "All services related to the Companies and Intellectual Property Commission.", order: 3 },
    { name: "COIDA Services", description: "Services related to the Compensation for Occupational Injuries and Diseases Act.", order: 4 },
    { name: "NCR Registrations", description: "Registration services for the National Credit Regulator.", order: 5 },
    { name: "Accounting Services", description: "Professional accounting and bookkeeping to keep your finances in order.", order: 6 },
    { name: "CIDB Services", description: "Services for the Construction Industry Development Board.", order: 7 }
  ];
  
  const categorizedServices = serviceCategories
    .map(category => ({
        ...category,
        data: services.filter(s => s.category === category.name)
    }))
    .filter(c => c.data.length > 0)
    .sort((a, b) => a.order - b.order);


  return (
    <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Stress-Free Tax &amp; Accounting
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Your trusted partner for professional financial services in South Africa. We simplify your finances so you can focus on what matters.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="#services">Explore Services</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Get Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trustindex Reviews Widget */}
      <TrustIndexWidget />

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-20">
        <WebsiteAIWidget />
      </section>

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
          <form className="relative">
            <Input
              type="search"
              placeholder="Search for a service (e.g., 'Company Registration')"
              className="h-12 w-full rounded-md border-input bg-background pr-14 text-base"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>
          </form>
        </div>
      </section>
      
        <div id="services" className="container mx-auto px-4 space-y-12 scroll-m-20">
            {categorizedServices.map(category => (
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
                        <Link href={`/services/${service.id}`}>Learn More</Link>
                        </Button>
                    </CardFooter>
                    </Card>
                ))}
                </div>
            </section>
            ))}
      </div>
    </div>
  );
}
