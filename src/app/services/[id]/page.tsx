import { notFound } from 'next/navigation';
import { services } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Clock, ClipboardCheck } from 'lucide-react';
import { Service } from '@/lib/types';
import ClientServiceCheckoutForm from '@/components/checkout/ClientServiceCheckoutForm';
import { Separator } from '@/components/ui/separator';
import type { Metadata } from 'next';
import Image from 'next/image';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const service = services.find(s => s.id === params.id);

  if (!service) {
    return {
      title: 'Service Not Found',
    };
  }

  const title = service.metaTitle || `${service.title} | Fast & Affordable - My Accountant`;
  const description = service.metaDescription || service.description;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: service.seoImageUrl || service.imageUrl,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [service.seoImageUrl || service.imageUrl],
    },
  };
}

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = services.find(s => s.id === params.id) as Service;

  if (!service) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-8 md:col-span-2">
            
          <div className="relative h-64 md:h-80 w-full rounded-lg overflow-hidden mb-8">
            <Image
              src={service.imageUrl}
              alt={service.imageHint || service.title}
              fill
              className="object-cover"
              data-ai-hint={service.imageHint}
            />
          </div>

          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">{service.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.title}</h1>
             <p className="text-3xl font-bold text-primary">{formatPrice(service.price)}</p>
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
                    <BadgeCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
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
              {service.clientRequirements.map((doc, index) => (
                <li key={index} className="flex items-start">
                  <ClipboardCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
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
