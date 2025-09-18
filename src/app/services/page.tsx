import Image from 'next/image';
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
import AddToCartButton from '@/components/cart/AddToCartButton';
import { Button } from '@/components/ui/button';

export default function ServicesPage() {
  const taxServices = services.filter(s => s.category === 'Tax Services');
  const businessServices = services.filter(s => s.category === 'Business Services');
  const accountingServices = services.filter(s => s.category === 'Accounting');

  const categories = [
    { name: 'Tax Services', data: taxServices },
    { name: 'Business Services', data: businessServices },
    { name: 'Accounting', data: accountingServices },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Our Services</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.
        </p>
      </div>

      <div className="space-y-12">
        {categories.map(category => (
          <section key={category.name}>
            <h2 className="text-2xl font-bold mb-6">{category.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {category.data.map(service => (
                <Card
                  key={service.id}
                  className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={service.imageUrl}
                      alt={service.title}
                      fill
                      className="object-cover"
                      data-ai-hint={service.imageHint}
                    />
                  </div>
                  <CardHeader>
                    <CardTitle>{service.title}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-2xl font-bold">R {service.price.toFixed(2)}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <AddToCartButton service={service} />
                    <Button variant="outline" asChild>
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
