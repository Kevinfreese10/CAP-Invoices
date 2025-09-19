
'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/types';
import ServiceCheckoutForm from '@/components/checkout/ServiceCheckoutForm';
import { Skeleton } from '../ui/skeleton';

export default function ClientServiceCheckoutForm({ service }: { service: Service }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  return <ServiceCheckoutForm service={service} />;
}
