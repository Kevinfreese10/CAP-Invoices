
'use client';
import { useState } from 'react';
import { services as initialServices } from '@/lib/data';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ServiceForm from '@/components/admin/ServiceForm';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import ServicePreview from '@/components/admin/ServicePreview';

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const { toast } = useToast();

  const handleAddService = () => {
    setSelectedService(null);
    setIsFormOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };
  
  const handleDeleteService = (serviceId: string) => {
    setServices(prevServices => prevServices.filter(s => s.id !== serviceId));
    toast({
        title: 'Service Deleted',
        description: 'The service has been successfully removed.',
        variant: 'destructive',
    })
  };

  const handleFormSubmit = (serviceData: Service) => {
    if (selectedService) {
      // Update existing service
      setServices(prevServices =>
        prevServices.map(s => (s.id === serviceData.id ? serviceData : s))
      );
       toast({
        title: 'Service Updated',
        description: 'The service details have been saved.',
      });
    } else {
      // Add new service
      setServices(prevServices => [
        ...prevServices,
        { ...serviceData, id: `new-service-${Date.now()}` }, // Mock ID
      ]);
       toast({
        title: 'Service Created',
        description: 'The new service has been added successfully.',
      });
    }
    setIsFormOpen(false);
    setSelectedService(null);
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Services</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAddService}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Service
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{selectedService ? 'Edit Service' : 'Create New Service'}</DialogTitle>
                    <DialogDescription>
                        {selectedService ? 'Update the details of this service.' : 'Fill out the form to add a new service.'}
                    </DialogDescription>
                </DialogHeader>
                <ServiceForm 
                    service={selectedService} 
                    onSubmit={handleFormSubmit}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
          <CardDescription>View, edit, and delete your company's services.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Reseller Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(service => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.title}</TableCell>
                  <TableCell>{service.category}</TableCell>
                  <TableCell>{service.department || 'N/A'}</TableCell>
                  <TableCell className="text-right">R {service.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {service.resellerPrice ? `R ${service.resellerPrice.toFixed(2)}` : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(isOpen) => !isOpen && setViewingService(null)}>
                      <AlertDialog>
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                               <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={() => setViewingService(service)}>
                                    View Preview
                                </DropdownMenuItem>
                               </DialogTrigger>
                              <DropdownMenuItem onClick={() => handleEditService(service)}>
                                  Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive">
                                      Delete
                                  </DropdownMenuItem>
                              </AlertDialogTrigger>
                          </DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the service
                                  <span className="font-semibold"> {service.title}</span>.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteService(service.id)}>
                                      Continue
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                      <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                              <DialogTitle>Service Preview</DialogTitle>
                              <DialogDescription>
                                  This is how clients will see the service page.
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
        </CardContent>
      </Card>
    </div>
  );
}
