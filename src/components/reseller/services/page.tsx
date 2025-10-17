
'use client';
import { useState, useEffect } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ServicePreview from '@/components/admin/ServicePreview';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

export default function ResellerServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setServices(fetchedServices);
        } catch (error) {
            console.error("Error fetching services:", error);
            toast({ title: "Error", description: "Could not load products.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    fetchServices();
  }, [toast]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Our Products</h1>
      <Card>
        <CardHeader>
          <CardTitle>Product & Price List</CardTitle>
          <CardDescription>A complete list of all products available for you to resell.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Public Price</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(service => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.title}</TableCell>
                  <TableCell>{service.category}</TableCell>
                  <TableCell>{formatPrice(service.price)}</TableCell>
                  <TableCell className="font-semibold">{service.resellerPrice ? formatPrice(service.resellerPrice) : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(isOpen) => !isOpen && setViewingService(null)}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setViewingService(service)}>
                                View Details
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                              <DialogTitle>Product Preview</DialogTitle>
                              <DialogDescription>
                                  This is how your clients will see the product on the public-facing site.
                              </DialogDescription>
                          </DialogHeader>
                          {viewingService && <ServicePreview service={viewingService} />}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
