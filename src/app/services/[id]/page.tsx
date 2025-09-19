
import { notFound } from 'next/navigation';
import { services } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Check, Clock } from 'lucide-react';
import { Service } from '@/lib/types';
import ClientServiceCheckoutForm from '@/components/checkout/ClientServiceCheckoutForm';
import { Separator } from '@/components/ui/separator';

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = services.find(s => s.id === params.id) as Service;

  if (!service) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-8 md:col-span-2">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">{service.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.title}</h1>
             <p className="text-3xl font-bold text-primary">R {service.price.toFixed(2)}</p>
            <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">{service.turnaroundTime}</span>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold">Service Description</h2>
            <Separator className="my-3" />
            <p className="text-muted-foreground">{service.longDescription}</p>
          </div>

          {service.whatsIncluded && service.whatsIncluded.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold">What's Included</h2>
              <Separator className="my-3" />
              <ul className="space-y-3">
                {service.whatsIncluded.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold">Prerequisites</h2>
            <Separator className="my-3" />
             <ul className="space-y-3">
              {service.requiredDocuments.map((doc, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="md:col-span-1">
          <ClientServiceCheckoutForm service={service} />
        </div>
      </div>
    </div>
  );
}
