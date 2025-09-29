
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Mock data, as there's no database
const initialCategories = [
    { id: '1', name: "SARS Services", description: "Comprehensive tax services to ensure you are compliant with SARS.", order: 1 },
    { id: '2', name: "Entity Registrations", description: "Register your new business entity with all the necessary bodies.", order: 2 },
    { id: '3', name: "CIPC Services", description: "All services related to the Companies and Intellectual Property Commission.", order: 3 },
    { id: '4', name: "COIDA Services", description: "Services related to the Compensation for Occupational Injuries and Diseases Act.", order: 4 },
    { id: '5', name: "NCR Registrations", description: "Registration services for the National Credit Regulator.", order: 5 },
    { id: '6', name: "Accounting Services", description: "Professional accounting and bookkeeping to keep your finances in order.", order: 6 },
    { id: '7', name: "CIDB Services", description: "Services for the Construction Industry Development Board.", order: 7 }
];

type Category = { id: string; name: string; description: string; order: number; };

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'Category name is required.'),
  description: z.string().min(10, 'Description is required.'),
});

function CategoryForm({ category, onSubmit, onCancel }: { category: Omit<Category, 'order'> | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: category?.id || '',
            name: category?.name || '',
            description: category?.description || '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea {...field} rows={3} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Category</Button>
                </div>
            </form>
        </Form>
    )
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(initialCategories.sort((a,b) => a.order - b.order));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const handleAdd = () => {
    setSelectedCategory(null);
    setIsFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setIsFormOpen(true);
  };
  
  const handleDelete = (categoryId: string) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId));
    toast({
        title: 'Category Deleted',
        description: 'The category has been successfully removed.',
        variant: 'destructive',
    })
  };

  const handleFormSubmit = (data: Omit<Category, 'id' | 'order'>) => {
    if (selectedCategory) {
      // Update
      setCategories(prev =>
        prev.map(c => (c.id === selectedCategory.id ? { ...c, ...data } : c))
      );
       toast({
        title: 'Category Updated',
        description: 'The category details have been saved.',
      });
    } else {
      // Add
       const newOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1;
      setCategories(prev => [
        ...prev,
        { ...data, id: `new-cat-${Date.now()}`, order: newOrder }, // Mock ID
      ]);
       toast({
        title: 'Category Created',
        description: 'The new category has been added successfully.',
      });
    }
    setIsFormOpen(false);
    setSelectedCategory(null);
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === categories.length - 1)
    ) {
      return;
    }

    const newCategories = [...categories];
    const itemToMove = newCategories[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const itemToSwap = newCategories[swapIndex];

    // Swap orders
    [itemToMove.order, itemToSwap.order] = [itemToSwap.order, itemToMove.order];

    setCategories(newCategories.sort((a, b) => a.order - b.order));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Categories</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Category
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{selectedCategory ? 'Edit Category' : 'Create New Category'}</DialogTitle>
                    <DialogDescription>
                        {selectedCategory ? 'Update the details of this category.' : 'Fill out the form to add a new category.'}
                    </DialogDescription>
                </DialogHeader>
                <CategoryForm 
                    category={selectedCategory} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>View, edit, and delete your service categories. Use the arrows to reorder them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveCategory(index, 'up')} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => moveCategory(index, 'down')} disabled={index === categories.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description}</TableCell>
                  <TableCell className="text-right">
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
                            <DropdownMenuItem onClick={() => handleEdit(category)}>
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
                                This action cannot be undone. This will permanently delete the category:
                                <span className="font-semibold"> {category.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(category.id)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
