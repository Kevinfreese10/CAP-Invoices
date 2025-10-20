
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
import { User, Task } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword, User as FirebaseUser, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';


const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const roles = ['client', 'staff', 'admin', 'reseller', 'ai_accountant'] as const;

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
                 <FormField control={form.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl><SelectContent>{roles.map(role => <SelectItem key={role} value={role} className="capitalize">{role.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save User</Button>
                </div>
            </form>
        </Form>
    )
}

function DeleteUserDialog({
  userToDelete,
  allUsers,
  onConfirmDelete,
  isDeleting,
}: {
  userToDelete: User | null;
  allUsers: User[];
  onConfirmDelete: (userIdToDelete: string, transferToUserId: string) => void;
  isDeleting: boolean;
}) {
  const [transferToUserId, setTransferToUserId] = useState<string>('');
  if (!userToDelete) return null;

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete User: {userToDelete.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This action is permanent. To prevent orphaned tasks, please select a new user to transfer all of their existing tasks to.
        </AlertDialogDescription>
      </AlertDialogHeader>
       <div className="py-4 space-y-2">
        <Label htmlFor="transfer-user-select">Transfer tasks to:</Label>
        <Select onValueChange={setTransferToUserId} value={transferToUserId}>
          <SelectTrigger id="transfer-user-select">
            <SelectValue placeholder="Select a user..." />
          </SelectTrigger>
          <SelectContent>
            {allUsers
              .filter((user) => user.id !== userToDelete.id) // Exclude the user being deleted
              .map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => onConfirmDelete(userToDelete.id, transferToUserId)}
          disabled={!transferToUserId || isDeleting}
        >
          {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Transfer & Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}


export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: adminUser, reauthenticate } = useAuth();
  
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
  
  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (userIdToDelete: string, transferToUserId: string) => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // 1. Reassign tasks
      const tasksQuery = query(collection(db, 'tasks'), where('assignedTo', 'array-contains', userIdToDelete));
      const tasksSnapshot = await getDocs(tasksQuery);
      
      tasksSnapshot.forEach((taskDoc) => {
        const taskData = taskDoc.data();
        const newAssignedTo = [...taskData.assignedTo.filter((id: string) => id !== userIdToDelete), transferToUserId];
        batch.update(taskDoc.ref, { assignedTo: Array.from(new Set(newAssignedTo)) }); // Ensure no duplicates
      });
      
      // 2. Delete the user document from Firestore
      const userRef = doc(db, 'users', userIdToDelete);
      batch.delete(userRef);

      // Note: Deleting from Firebase Auth requires admin SDK, which is not available client-side.
      // This action only removes them from the application's user database.

      await batch.commit();
      
      toast({
        title: 'User Deleted',
        description: `The user and their ${tasksSnapshot.size} tasks have been transferred and the user removed.`,
        variant: 'destructive',
      });

      fetchUsers();
    } catch (error) {
        console.error("Error deleting user:", error);
        toast({ title: 'Error', description: 'Could not delete the user.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
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
            
            let firebaseUser: FirebaseUser;
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
                firebaseUser = userCredential.user;
            } catch (authError: any) {
                if (authError.code === 'auth/email-already-in-use') {
                    // Check if user document already exists in Firestore. If not, this is an orphaned auth user.
                    const q = query(collection(db, "users"), where("email", "==", userData.email));
                    const existingDocs = await getDocs(q);
                    if (!existingDocs.empty) {
                        toast({ title: 'User Exists', description: 'A user profile with this email already exists.', variant: 'destructive'});
                        return;
                    }
                    // If no Firestore doc, it's an orphaned auth user. Log them in to get UID.
                    toast({ title: "Existing Auth User", description: "This email is already registered. Attempting to link to a new profile." });
                    const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
                    firebaseUser = userCredential.user;
                } else {
                    throw authError; // Re-throw other auth errors
                }
            }
            
            const authUid = firebaseUser.uid;
            const newUserDocRef = doc(db, "users", authUid);
            const userDocSnap = await getDoc(newUserDocRef);

            if (userDocSnap.exists()) {
                toast({ title: 'User Already Exists', description: 'A user with this email already has a profile.', variant: 'destructive'});
                if (auth.currentUser) await reauthenticate(auth.currentUser);
                return;
            }

            await setDoc(newUserDocRef, {
                ...userData,
                uid: authUid,
                id: authUid,
                createdAt: serverTimestamp(),
            });
            
            if (auth.currentUser) {
                await reauthenticate(auth.currentUser);
            }
            
            toast({ title: 'User Created', description: 'The new user has been added.' });
        }
        fetchUsers();
        setIsFormOpen(false);
        setSelectedUser(null);
    } catch (error: any) {
        console.error("Error saving user:", error);
        let description = 'Could not save the user. Please try again.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = 'An auth user exists with this email, but the password provided is incorrect.';
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
                <TableHead>UID</TableHead>
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
                   <TableCell className="font-mono text-xs">{user.uid}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => handleDeleteClick(user)}
                        >
                            Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DeleteUserDialog
          userToDelete={selectedUser}
          allUsers={users}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      </AlertDialog>

    </div>
  );
}

    