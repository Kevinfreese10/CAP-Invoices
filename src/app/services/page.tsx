

import Link from 'next/link';
import { services } from '@/lib/data';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ServicesPage() {
  const serviceCategories = [
    {
      name: "SARS Services",
      description: "Comprehensive tax services to ensure you are compliant with SARS."
    },
    {
      name: "Entity Registrations",
      description: "Register your new business entity with all the necessary bodies."
    },
    {
      name: "CIPC Services",
      description: "All services related to the Companies and Intellectual Property Commission."
    },
    {
      name: "COIDA Services",
      description: "Services related to the Compensation for Occupational Injuries and Diseases Act."
    },
     {
      name: "NCR Registrations",
      description: "Registration services for the National Credit Regulator."
    },
    {
      name: "Accounting Services",
      description: "Professional accounting and bookkeeping to keep your finances in order."
    },
    {
        name: "CIDB Services",
        description: "Services for the Construction Industry Development Board."
    }
  ];
  
  const categorizedServices = serviceCategories.map(category => ({
    ...category,
    data: services.filter(s => s.category === category.name)
  })).filter(c => c.data.length > 0);


  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Our Services</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.
        </p>
      </div>

      <div className="space-y-12">
        {categorizedServices.map(category => (
          <section key={category.name}>
            <h2 className="text-2xl font-bold mb-6">{category.name}</h2>
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
