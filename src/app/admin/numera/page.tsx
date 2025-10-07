
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download, Upload, FileCheck2, ScanLine, Sprout, Search, ArrowUpDown, Edit, Sparkles, BrainCircuit, Copy, MessageSquare, RefreshCw, ChevronDown, Trash2, ListOrdered, HardHat, Feather, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount, VatType, Supplier, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub, getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, addMonths, parse } from 'date-fns';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAISuggestions } from '@/ai/flows/get-ai-suggestions';
import { allVatTypes as allVatTypesData } from '@/lib/vat-types';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

const db = getFirestore(firebaseApp);

export default function NumeraPage() {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    
    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
            const querySnapshot = await getDocs(q);
            let fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            fetchedClients.sort((a, b) => a.name.localeCompare(b.name));
            setClients(fetchedClients);
        } catch (error) {
            console.error("Error fetching clients:", error);
            toast({ title: 'Error', description: 'Could not fetch clients from the database.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchClients();
    }, []);

    const handleAddClient = () => {
        setSelectedClient(null);
        setIsClientFormOpen(true);
    };

    const handleEditClient = (client: User) => {
        setSelectedClient(client);
        setIsClientFormOpen(true);
    };

    const handleSelectClient = (client: User) => {
        sessionStorage.setItem('numera-active-client', JSON.stringify(client));
        router.push('/admin/numera/workspace');
    }

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        if (date.toDate) {
          return format(date.toDate(), 'dd/MM/yyyy');
        }
        const d = new Date(date);
        if (d instanceof Date && !isNaN(d.getTime())) {
          return format(d, 'dd/MM/yyyy');
        }
        return 'Invalid Date';
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
                <Button onClick={handleAddClient}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Client
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                <CardTitle>Numera Clients</CardTitle>
                <CardDescription>Select a client to start working, or create a new client.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    clients.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">No clients have been added to Numera yet.</p>
                            <Button onClick={handleAddClient} className="mt-4">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Your First Client
                            </Button>
                        </div>
                    ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Financial Year End</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {clients.map(client => (
                        <TableRow key={client.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${client.name}`} alt={client.name} />
                                    <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{client.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>{client.contactPerson}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{formatDate(client.yearEnd)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" onClick={() => handleSelectClient(client)}>Select</Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                    )
                )}
                </CardContent>
            </Card>
        </div>
    )
}
