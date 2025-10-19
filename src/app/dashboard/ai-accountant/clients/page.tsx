
'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, ArrowRight, Banknote } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Task, Order } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import ClientForm from '@/components/admin/ClientForm';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { getNextOrderId } from '@/lib/sequence';
import { generatePayFastSignature } from '@/app/actions/payfast';


const db = getFirestore(firebaseApp);

export default function AIAccountantClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [payfastFormData, setPayfastFormData] = useState<{ [key: string]: string } | null>(null);
  
  const fetchClients = async () => {
    if (!currentUser?.uid) return;
    setIsLoading(true);
    try {
        let clientsQuery;
        if (currentUser?.role === 'admin') {
            clientsQuery = query(collection(db, "aiAccountantClients"), orderBy("name"));
        } else {
            clientsQuery = query(
                collection(db, "aiAccountantClients"), 
                where("createdBy", "==", currentUser.uid),
                orderBy("name")
            );
        }
        const clientsSnapshot = await getDocs(clientsQuery);
        const fetchedClients = clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setClients(fetchedClients);
    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'Could not fetch AI Accountant clients.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if(currentUser) {
        fetchClients();
    }
  }, [currentUser]);

  useEffect(() => {
    if (payfastFormData) {
        const formElement = document.getElementById('payfast-redirect-form');
        if (formElement) {
            (formElement as HTMLFormElement).submit();
        }
    }
  }, [payfastFormData]);


  const handleAddClick = () => {
    if (clients.length > 0 && currentUser?.role !== 'admin') {
      setIsSubscriptionModalOpen(true);
    } else {
      setSelectedClient(null);
      setIsFormOpen(true);
    }
  };
  
  const handleCreateSubscriptionOrder = async () => {
    if (!currentUser) return;
    setIsProcessingPayment(true);
    toast({ title: "Creating renewal order...", description: "Please wait while we redirect you to payment." });

    const subscriptionPrice = 140;

    try {
        const orderId = await getNextOrderId();
        const renewalOrderData: Order = {
            id: orderId,
            userId: currentUser.uid,
            customerName: currentUser.name,
            customerEmail: currentUser.email,
            items: [{
                id: 'additional_company_profile',
                title: `AI Accountant - Additional Company Profile`,
                price: subscriptionPrice,
                quantity: 1,
            }],
            total: subscriptionPrice,
            discountCode: null,
            discountAmount: null,
            status: 'Pending Payment',
            date: Timestamp.now(),
            source: 'AI Accountant Signup',
            renewalForClientId: currentUser.uid,
        };
        
        await setDoc(doc(db, 'orders', orderId), renewalOrderData);
        
        const dataForSignature = {
            merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
            merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${orderId}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ai-accountant/clients`,
            notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
            email_address: currentUser.email,
            m_payment_id: orderId,
            amount: subscriptionPrice.toFixed(2),
            item_name: `AI Accountant - Additional Company Profile`,
        };

        const signature = await generatePayFastSignature(dataForSignature);
        setPayfastFormData({ ...dataForSignature, signature });
        
    } catch(e) {
        console.error(e);
        toast({ title: 'Error', description: 'Could not create renewal order.', variant: 'destructive'});
        setIsProcessingPayment(false);
    }
  };


  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    try {
        await deleteDoc(doc(db, "aiAccountantClients", clientId));
        fetchClients();
        toast({
            title: 'Client Deleted',
            description: `The AI Accountant profile has been removed.`,
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client profile.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const clientData: Partial<User> = {
        ...data,
        yearEnd: data.yearEnd || null,
        role: 'client',
        source: 'AI Accountant',
        hasNumeraProfile: true, // Legacy field, keeping for compatibility
        chartOfAccounts: initialChartOfAccounts,
        allocationRules: initialAllocationRules,
    };
    
    try {
        if (selectedClient?.id) {
            await setDoc(doc(db, "aiAccountantClients", selectedClient.id), clientData, { merge: true });
            toast({ title: 'Client Updated'});
        } else {
            const newDocRef = doc(collection(db, 'aiAccountantClients'));
            await setDoc(newDocRef, {
              ...clientData,
              id: newDocRef.id,
              uid: newDocRef.id,
              createdAt: Timestamp.now(),
              createdBy: currentUser.uid,
            });
            toast({ title: 'Client Created' });
        }

        fetchClients();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Accountant Clients</h1>
        {currentUser && (
            <>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                     <DialogTrigger asChild>
                        <Button onClick={handleAddClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Client
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                                <DialogDescription>
                                    {selectedClient ? 'Update the details for this client.' : 'Fill out the form to add a new client to the AI Accountant module.'}
                                </DialogDescription>
                            </DialogHeader>
                            <ClientForm 
                                client={selectedClient} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isAIClient={true}
                            />
                    </DialogContent>
                </Dialog>
                <Dialog open={isSubscriptionModalOpen} onOpenChange={setIsSubscriptionModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Another Company</DialogTitle>
                            <DialogDescription>
                                Your first company profile is free. Each additional company requires a subscription of <strong>R140 per month</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <p>To activate a new company profile, please proceed with the payment below.</p>
                             <Button onClick={handleCreateSubscriptionOrder} disabled={isProcessingPayment} className="w-full">
                                {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Proceed to Payment (R140.00)
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All AI Accountant Clients</CardTitle>
          <CardDescription>Select a client to manage their AI Accountant profile.</CardDescription>
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
                <TableHead>Client</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cell Number</TableHead>
                <TableHead>Year End</TableHead>
                <TableHead>VAT Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => {
                const basePath = currentUser?.role === 'admin' ? '/admin' : '/dashboard';
                return (
                    <TableRow key={client.id}>
                    <TableCell className="font-medium">
                        <div>
                            <span>{client.name}</span>
                            {client.contactPerson && <p className="text-xs text-muted-foreground">{client.contactPerson}</p>}
                        </div>
                    </TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.contactNumber}</TableCell>
                    <TableCell>{client.yearEnd}</TableCell>
                        <TableCell>
                        {client.isVatRegistered ? (
                            <Badge variant="success">Yes</Badge>
                        ) : (
                            <Badge variant="secondary">No</Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button asChild size="sm">
                            <Link href={`${basePath}/ai-accountant/${client.id}/dashboard`}>
                                Manage Client <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </TableCell>
                    </TableRow>
                )
            })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      {payfastFormData && (
        <form id="payfast-redirect-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" style={{ display: 'none' }}>
            {Object.entries(payfastFormData).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value as string} />
            ))}
        </form>
      )}
    </div>
  );
}
