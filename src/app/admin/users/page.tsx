

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const roles = ['client', 'staff', 'admin', 'reseller'] as const;

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
  role: z.enum(roles),
});

function UserForm({ user, onSubmit, onCancel }: { user: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: user?.id || '',
            name: user?.name || '',
            email: user?.email || '',
            password: '',
            role: user?.role || 'client',
        },
    });

    const isEditing = !!user;

    useEffect(() => {
        if(isEditing){
            form.reset({
                ...user,
                role: user?.role,
                password: '', // Always clear password on edit
            });
        }
    }, [user, isEditing, form]);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        if (!isEditing && !values.password) {
            form.setError('password', { message: 'Password is required for new users.' });
            return;
        }
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} disabled={isEditing} /></FormControl><FormMessage /></FormItem> )}/>
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{isEditing ? 'New Password (Optional)' : 'Password'}</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                             <FormDescription>{isEditing ? 'Leave blank to keep the current password.' : 'The user can change this later.'}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField control={form.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl><SelectContent>{roles.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save User</Button>
                </div>
            </form>
        </Form>
    )
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: adminUser, login } = useAuth();
  
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
        setUsers(fetchedUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        toast({ title: 'Error', description: 'Could not fetch users from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (userId: string) => {
    try {
        await deleteDoc(doc(db, "users", userId));
        fetchUsers();
        toast({
            title: 'User Deleted',
            description: 'The user has been removed from Firestore.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        toast({ title: 'Error', description: 'Could not delete the user.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    const { id, password, ...userData } = data;
    
    try {
        if (id) { 
             const docRef = doc(db, "users", id);
             await setDoc(docRef, userData, { merge: true });
             toast({ title: 'User Updated', description: 'The user details have been saved.' });
        } else { 
            if (!adminUser) {
                toast({ title: 'Error', description: 'Admin user not found.', variant: 'destructive'});
                return;
            }
            if (!password) {
                 toast({ title: 'Error', description: 'Password is required for new users.', variant: 'destructive'});
                 return;
            }

            const existingUserQuery = query(collection(db, "users"), where("email", "==", userData.email));
            const existingUserSnapshot = await getDocs(existingUserQuery);
            if (!existingUserSnapshot.empty) {
                toast({
                    title: 'User Exists',
                    description: 'A user with this email address already exists in the database.',
                    variant: 'destructive',
                });
                return;
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
            const newFirebaseUser = userCredential.user;

            const newUserDocRef = doc(db, "users", newFirebaseUser.uid);
            await setDoc(newUserDocRef, {
                ...userData,
                uid: newFirebaseUser.uid,
                id: newFirebaseUser.uid,
                createdAt: serverTimestamp(),
            });
            
            if (adminUser.email && adminUser.password) {
               await login(adminUser.email, adminUser.password);
            }

            toast({ title: 'User Created', description: 'The new user has been added.' });
        }
        fetchUsers();
        setIsFormOpen(false);
        setSelectedUser(null);
    } catch (error: any) {
        console.error("Error saving user:", error);
        let description = 'Could not save the user. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email address already exists in Firebase Authentication.';
        }
        toast({ title: 'Error', description, variant: 'destructive'});
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return format(timestamp.toDate(), 'dd/MM/yyyy');
    }
    return 'Invalid Date';
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create User
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{selectedUser ? 'Edit User' : 'Create New User'}</DialogTitle>
                    <DialogDescription>
                        {selectedUser ? 'Update the details of this user.' : 'Fill out the form to add a new user to the system.'}
                    </DialogDescription>
                </DialogHeader>
                <UserForm 
                    user={selectedUser} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View, edit, and delete all user accounts.</CardDescription>
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
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" disabled={user.role === 'admin'}>
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the user account for:
                                <span className="font-semibold"> {user.name}</span>. This only removes them from Firestore.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.id)}>
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
