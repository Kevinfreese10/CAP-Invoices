
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export default function AdminResellersPage() {
  const [resellers, setResellers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchResellers = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"), where('role', '==', 'reseller'));
        const querySnapshot = await getDocs(q);
        const fetchedResellers = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setResellers(fetchedResellers);
    } catch (error) {
        console.error("Error fetching resellers:", error);
        toast({ title: 'Error', description: 'Could not fetch resellers from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResellers();
  }, []);

  const handleDelete = async (resellerId: string) => {
    try {
        await deleteDoc(doc(db, "users", resellerId));
        fetchResellers();
        toast({
            title: 'Reseller Deleted',
            description: 'The reseller has been removed from Firestore.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting reseller:", error);
        toast({ title: 'Error', description: 'Could not delete reseller.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Resellers</h1>
         <Button asChild>
            <Link href="/reseller-signup">
                Add New Reseller
            </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Resellers</CardTitle>
          <CardDescription>View and manage all approved reseller accounts.</CardDescription>
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
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resellers.map(reseller => (
                <TableRow key={reseller.uid}>
                  <TableCell className="font-medium">{reseller.companyName}</TableCell>
                  <TableCell>{reseller.contactPerson}</TableCell>
                  <TableCell>{reseller.email}</TableCell>
                  <TableCell>{reseller.contactNumber}</TableCell>
                  <TableCell>
                      <Badge variant={reseller.status === 'Active' ? 'success' : 'secondary'}>
                          {reseller.status}
                      </Badge>
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
                            <DropdownMenuItem disabled>Edit</DropdownMenuItem>
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
                                This action cannot be undone. This will permanently delete the reseller account for:
                                <span className="font-semibold"> {reseller.companyName}</span>. This only removes them from Firestore.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(reseller.uid)}>
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
