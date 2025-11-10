
'use client';
import { Service } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Separator } from '../ui/separator';
import { CheckCircle2, Clock, Info, Paperclip, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

export default function ServicePreview({ service }: { service: Service }) {

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };
  
  if (!service) return null;
  
  return (
    <div className="space-y-6">
        <div className="relative h-48 w-full overflow-hidden rounded-lg">
             <Image src={service.imageUrl} alt={service.title} fill className="object-cover" data-ai-hint={service.imageHint} />
        </div>
      <p>{service.longDescription}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold text-lg flex items-center gap-2"><CheckCircle2 className="text-green-500" />What's Included</h4>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            {service.whatsIncluded.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div className="space-y-4">
            <h4 className="font-semibold text-lg flex items-center gap-2"><AlertTriangle className="text-orange-500" />Client Prerequisites</h4>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            {service.clientRequirements.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      </div>
      
       <div className="flex items-center gap-4 text-sm bg-muted p-3 rounded-md">
            <Clock className="h-5 w-5" />
            <div>
                <span className="font-semibold">Turnaround Time: </span>
                <span>{service.turnaroundTime}</span>
            </div>
      </div>

       {service.attachmentUrl && (
          <div className="flex items-center gap-4 text-sm bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md">
                <Info className="h-5 w-5" />
                <div>
                    <span className="font-semibold">Additional Info: </span>
                     <a href={service.attachmentUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 flex items-center gap-1">
                        Download additional document <Paperclip className="h-4 w-4" />
                    </a>
                </div>
            </div>
       )}

      <Separator />

      <div className="flex justify-end items-center">
         <div className="text-right">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-3xl font-bold">{formatPrice(service.price)}</p>
         </div>
      </div>
    </div>
  );
}


    