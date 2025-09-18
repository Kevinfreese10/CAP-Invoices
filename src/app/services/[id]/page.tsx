import Image from 'next/image';
import { notFound } from 'next/navigation';
import { services } from '@/lib/data';
import AddToCartButton from '@/components/cart/AddToCartButton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Clock, FileText } from 'lucide-react';

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = services.find(s => s.id === params.id);

  if (!service) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 gap-8 lg:gap-12">
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

      <div className="mt-16">
        <Tabs defaultValue="included" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="included">What's Included</TabsTrigger>
            <TabsTrigger value="documents">Required Docs</TabsTrigger>
            <TabsTrigger value="turnaround">Turnaround Time</TabsTrigger>
          </TabsList>
          <TabsContent value="included" className="mt-4 rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">What's Included in this Service:</h3>
            <ul className="space-y-3">
              {service.whatsIncluded.map((item, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="documents" className="mt-4 rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Documents You'll Need to Provide:</h3>
            <ul className="space-y-3">
              {service.requiredDocuments.map((doc, index) => (
                <li key={index} className="flex items-start">
                  <FileText className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="turnaround" className="mt-4 rounded-lg border p-6">
             <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                    <h3 className="text-lg font-semibold">Estimated Turnaround Time</h3>
                    <p className="text-xl font-medium">{service.turnaroundTime}</p>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
