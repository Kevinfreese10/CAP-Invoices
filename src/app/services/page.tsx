
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

export default function ServicesPage() {
  const serviceCategories = [
    "SARS & Tax",
    "Company Registrations",
    "CIPC",
    "Payroll",
    "NCR/COIDA/CIDB",
  ];
  
  const categorizedServices = serviceCategories.map(category => ({
    name: category,
    data: services.filter(s => s.category === category)
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
                    <div className="flex items-center text-muted-foreground pt-2">
                        <Clock className="h-4 w-4 mr-1.5" />
                        <span className="text-xs font-medium">{service.turnaroundTime}</span>
                    </div>
                    <CardDescription className="pt-2">{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-2xl font-bold">R {service.price.toFixed(2)}</p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" asChild className="w-full">
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
