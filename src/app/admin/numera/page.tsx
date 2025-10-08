
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Settings } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

export default function NumeraPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, "clients"), where("source", "==", "Numera"));
                const querySnapshot = await getDocs(q);
                const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
                setClients(fetchedClients);
            } catch (error) {
                console.error("Error fetching Numera clients:", error);
                toast({
                    title: 'Error',
                    description: 'Could not fetch Numera clients.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchClients();
    }, [toast]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
                <Button variant="outline" asChild>
                    <Link href="/admin/numera/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Numera Client Profiles</CardTitle>
                    <CardDescription>
                        The following clients have active accounting profiles in the Numera module.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : clients.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            No clients have been set up in Numera yet.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map(client => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.companyName || client.name}</TableCell>
                                        <TableCell>{client.contactPerson}</TableCell>
                                        <TableCell>{client.email}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href="#">
                                                    View Profile <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
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
