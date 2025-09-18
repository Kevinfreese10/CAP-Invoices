import Image from 'next/image';
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
import AddToCartButton from '@/components/cart/AddToCartButton';
import { CheckCircle } from 'lucide-react';

export default function Home() {
  const featuredServices = services.slice(0, 3);
  const whyChooseUs = [
    'Expert & Reliable',
    'Affordable Pricing',
    'Fast Turnaround',
    'SARS Compliant',
  ];

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
                <Link href="/services">Explore Services</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/support">Get Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      <section id="services" className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Featured Services</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Get started with our most popular services for individuals and businesses.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredServices.map((service) => (
            <Card
              key={service.id}
              className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <CardHeader>
                <CardTitle>{service.title}</CardTitle>
                <p className="text-2xl font-bold pt-2">R {service.price.toFixed(2)}</p>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{service.description}</CardDescription>
              </CardContent>
              <CardFooter className="flex justify-between">
                <AddToCartButton service={service} />
                <Button variant="ghost" asChild>
                  <Link href={`/services/${service.id}`}>Learn More</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="text-center mt-12">
            <Button asChild variant="secondary">
                <Link href="/services">View All Services</Link>
            </Button>
        </div>
      </section>

      <section className="bg-card">
         <div className="container mx-auto px-4 py-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose Tax Shop?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We're committed to providing you with the best service possible.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {whyChooseUs.map(item => (
                    <div key={item} className="flex items-center gap-4">
                        <CheckCircle className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-semibold">{item}</h3>
                            <p className="text-sm text-muted-foreground">Quality and assurance guaranteed.</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

    </div>
  );
}
