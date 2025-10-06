
'use client';
import { notFound, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Clock, ClipboardCheck, Loader2 } from 'lucide-react';
import { Service } from '@/lib/types';
import ClientServiceCheckoutForm from '@/components/checkout/ClientServiceCheckoutForm';
import { Separator } from '@/components/ui/separator';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useEffect, useState } from 'react';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ServiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, 'services', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setService({ id: docSnap.id, ...docSnap.data() } as Service);
      } else {
        setService(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!service) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
            <TrustIndexWidget />
        </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-8 md:col-span-2">
            
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
