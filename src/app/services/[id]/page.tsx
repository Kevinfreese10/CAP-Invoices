import Image from 'next/image';
import { notFound } from 'next/navigation';
import { services } from '@/lib/data';
import AddToCartButton from '@/components/cart/AddToCartButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = services.find(s => s.id === params.id);

  if (!service) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="relative min-h-[300px] md:min-h-[400px]">
          <Image
            src={service.imageUrl}
            alt={service.title}
            fill
            className="rounded-lg object-cover shadow-lg"
            data-ai-hint={service.imageHint}
          />
        </div>
        <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="w-fit mb-2">{service.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.title}</h1>
            <p className="mt-4 text-3xl font-bold text-primary">R {service.price.toFixed(2)}</p>
            <p className="mt-4 text-lg text-muted-foreground">{service.longDescription}</p>
            <div className="mt-8">
                <AddToCartButton service={service} />
            </div>
        </div>
      </div>
    </div>
  );
}
