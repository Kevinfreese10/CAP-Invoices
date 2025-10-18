
'use client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Service } from '@/lib/types';
import { BadgeCheck, Clock, ClipboardCheck } from 'lucide-react';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ServicePreview({ service }: { service: Service }) {
  if (!service) return null;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
        <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">{service.category}</Badge>
            <p className="text-2xl font-bold text-primary">{formatPrice(service.price)}</p>
            <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">{service.turnaroundTime}</span>
            </div>
        </div>
        
        <div>
            <h2 className="text-lg font-semibold">Service Description</h2>
            <Separator className="my-2" />
            <p className="text-sm text-muted-foreground">{service.longDescription}</p>
        </div>

        {service.whatsIncluded && service.whatsIncluded.length > 0 && (
            <div>
                <h2 className="text-lg font-semibold">What's Included</h2>
                <Separator className="my-2" />
                <ul className="space-y-2 text-sm">
                    {service.whatsIncluded.map((item, index) => (
                    <li key={index} className="flex items-start">
                        <BadgeCheck className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                    </li>
                    ))}
                </ul>
            </div>
        )}

        <div>
            <h2 className="text-lg font-semibold">Prerequisites</h2>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
            {service.clientRequirements.map((doc, index) => (
                <li key={index} className="flex items-start">
                <ClipboardCheck className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>{doc}</span>
                </li>
            ))}
            </ul>
        </div>
    </div>
  );
}
