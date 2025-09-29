

'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Users, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);
const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;
const roles = ['staff', 'admin'] as const;

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  password: z.string().optional(),
  department: z.enum(departments),
  role: z.enum(roles),
});

function StaffForm({ staffMember, onSubmit, onCancel }: { staffMember: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: staffMember?.id || '',
            name: staffMember?.name || '',
            email: staffMember?.email || '',
            password: '',
            department: staffMember?.department || 'Administration',
            role: staffMember?.role === 'admin' ? 'admin' : 'staff',
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
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormDescription>
                                {staffMember ? 'Leave blank to keep the current password.' : 'Set an initial password for the new staff member.'}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Department</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {departments.map(dep => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Role</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {roles.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Staff Member</Button>
                </div>
            </form>
        </Form>
    )
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const { toast } = useToast();
  
  const fetchStaff = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const querySnapshot = await getDocs(q);
        const fetchedStaff = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setStaff(fetchedStaff);
    } catch (error) {
        console.error("Error fetching staff:", error);
        toast({ title: 'Error', description: 'Could not fetch staff from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAdd = () => {
    setSelectedStaff(null);
    setIsFormOpen(true);
  };

  const handleEdit = (staffMember: User) => {
    setSelectedStaff(staffMember);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (staffId: string) => {
    try {
        await deleteDoc(doc(db, "users", staffId));
        fetchStaff();
        toast({
            title: 'Staff Member Deleted',
            description: 'The staff member has been removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting staff member:", error);
        toast({ title: 'Error', description: 'Could not delete staff member.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: Omit<User, 'id'> & { id?: string }) => {
    const { id, ...staffData } = data as any;
    
    // Don't save an empty password string
    if (!staffData.password) {
        delete staffData.password;
    }

    try {
        if (id) {
             const docRef = doc(db, "users", id);
             await setDoc(docRef, staffData, { merge: true });
             toast({ title: 'Staff Member Updated', description: 'The staff details have been saved.' });
        } else {
            if (!staffData.password) {
                toast({ title: 'Password Required', description: 'Please set an initial password for the new staff member.', variant: 'destructive' });
                return;
            }
            const newStaffData = { ...staffData, role: staffData.role || 'staff' };
            await addDoc(collection(db, "users"), newStaffData);
            toast({ title: 'Staff Member Created', description: 'The new staff member has been added.' });
        }
        fetchStaff();
        setIsFormOpen(false);
        setSelectedStaff(null);
    } catch (error) {
        console.error("Error saving staff member:", error);
        toast({ title: 'Error', description: 'Could not save the staff member.', variant: 'destructive'});
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Staff</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Staff Member
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{selectedStaff ? 'Edit Staff Member' : 'Create New Staff Member'}</DialogTitle>
                    <DialogDescription>
                        {selectedStaff ? 'Update the details of this staff member.' : 'Fill out the form to add a new staff member.'}
                    </DialogDescription>
                </DialogHeader>
                <StaffForm 
                    staffMember={selectedStaff} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Staff Members</CardTitle>
          <CardDescription>View, edit, and delete staff accounts.</CardDescription>
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(staffMember => (
                <TableRow key={staffMember.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${staffMember.email}`} alt={staffMember.name} />
                            <AvatarFallback>{staffMember.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{staffMember.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{staffMember.email}</TableCell>
                  <TableCell>{staffMember.department}</TableCell>
                  <TableCell className="capitalize">
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 text-xs rounded-full">
                        {staffMember.role}
                    </span>
                  </TableCell>
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
                            <DropdownMenuItem onClick={() => handleEdit(staffMember)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" disabled={staffMember.role === 'admin'}>
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the staff account for:
                                <span className="font-semibold"> {staffMember.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(staffMember.id)}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
