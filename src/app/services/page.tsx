
import Link from 'next/link';
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
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';

const db = getFirestore(firebaseApp);

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

async function getData(): Promise<{ services: Service[], categories: Category[] }> {
    const servicesCollection = collection(db, 'services');
    const servicesQuery = query(servicesCollection, orderBy('title'));
    const servicesSnapshot = await getDocs(servicesQuery);
    const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

    const categoriesCollection = collection(db, 'categories');
    const categoriesQuery = query(categoriesCollection, orderBy('order'));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

    return { services, categories };
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default async function ServicesPage() {
  const { services, categories: serviceCategories } = await getData();
  
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
