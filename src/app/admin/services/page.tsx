
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, Clock, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ServiceForm from '@/components/admin/ServiceForm';
import { useToast } from '@/hooks/use-toast';
import ServicePreview from '@/components/admin/ServicePreview';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';

const db = getFirestore(firebaseApp);

const serviceCategories = [
    "SARS Services",
    "Entity Registrations",
    "CIPC Services",
    "COIDA Services",
    "NCR Registrations",
    "Accounting Services",
    "CIDB Services",
];

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const { toast } = useToast();

  const [titleFilter, setTitleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fetchServices = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "services"), orderBy("title"));
        const querySnapshot = await getDocs(q);
        const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
        setServices(fetchedServices);
    } catch (error) {
        console.error("Error fetching services:", error);
        toast({ title: 'Error', description: 'Could not fetch services from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    return services.filter(service => {
        const titleMatch = service.title.toLowerCase().includes(titleFilter.toLowerCase());
        const categoryMatch = categoryFilter === 'all' || service.category === categoryFilter;
        const departmentMatch = departmentFilter === 'all' || service.department === departmentFilter;
        return titleMatch && categoryMatch && departmentMatch;
    });
  }, [services, titleFilter, categoryFilter, departmentFilter]);


  const handleAddService = () => {
    setSelectedService(null);
    setIsFormOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };
  
  const handleDeleteService = async (serviceId: string) => {
    try {
        await deleteDoc(doc(db, "services", serviceId));
        fetchServices();
        toast({
            title: 'Product Deleted',
            description: 'The product has been successfully removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting service:", error);
        toast({ title: 'Error', description: 'Could not delete the product.', variant: 'destructive' });
    }
  };

  const handleCopyService = async (service: Service) => {
    const newTitle = `Copy of ${service.title}`;
    const newSlug = newTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const { id, slug, title, ...restOfServiceData } = service;

    const newServiceData = {
        ...restOfServiceData,
        title: newTitle,
        slug: newSlug,
        createdAt: serverTimestamp(),
    };
    
    try {
      await addDoc(collection(db, "services"), newServiceData);
      toast({ title: 'Product Copied', description: `A copy of "${service.title}" has been created.` });
      fetchServices();
    } catch (error) {
      console.error("Error copying product:", error);
      toast({ title: 'Error', description: 'Could not copy the product.', variant: 'destructive'});
    }
  };

  const handleFormSubmit = async (serviceData: Omit<Service, 'id'> & { id?: string }) => {
    const { id, ...data } = serviceData;
    
    const finalData = {
        ...data,
        resellerPrice: data.price * 0.9,
    };
    
    try {
        if (id) {
            await setDoc(doc(db, "services", id), finalData, { merge: true });
            toast({ title: 'Product Updated', description: 'The product details have been saved.' });
        } else {
            await addDoc(collection(db, "services"), { ...finalData, createdAt: serverTimestamp() });
            toast({ title: 'Product Created', description: 'The new product has been added successfully.' });
        }
        fetchServices();
        setIsFormOpen(false);
        setSelectedService(null);
    } catch (error) {
        console.error("Error saving service:", error);
        toast({ title: 'Error', description: 'Could not save the product.', variant: 'destructive'});
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Products</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAddService}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Product
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedService ? 'Edit Product' : 'Create New Product'}</DialogTitle>
                    <DialogDescription>
                        {selectedService ? 'Update the details of this product.' : 'Fill out the form to add a new product.'}
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
          <CardTitle>All Products</CardTitle>
          <CardDescription>View, edit, and delete your company's products.</CardDescription>
           <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Input
                    placeholder="Filter by title..."
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by category..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {serviceCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by department..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map(dep => (
                            <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Turnaround</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Reseller Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map(service => (
                <TableRow key={service.id}>
                   <TableCell>
                      <Image src={service.imageUrl} alt={service.title} width={40} height={40} className="rounded-md object-cover" />
                  </TableCell>
                  <TableCell className="font-medium">{service.title}</TableCell>
                  <TableCell>{service.category}</TableCell>
                   <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{service.turnaroundTime}</span>
                      </div>
                  </TableCell>
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
                              <DropdownMenuItem onClick={() => handleCopyService(service)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Product
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
                                  This action cannot be undone. This will permanently delete the product
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
                              <DialogTitle>Product Preview</DialogTitle>
                              <DialogDescription>
                                  This is how clients will see the product page.
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
