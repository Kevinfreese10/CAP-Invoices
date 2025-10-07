
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
import { User, ChartOfAccount, VatType, Supplier, ImportedTransaction, AllocationRule, AllocatedTransaction } from '@/lib/types';
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

export default function NumeraWorkspacePage() {
    const [activeClient, setActiveClient] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        const clientData = sessionStorage.getItem('numera-active-client');
        if (clientData) {
            setActiveClient(JSON.parse(clientData));
        } else {
            router.push('/admin/numera');
        }
    }, [router]);
    
    if (!activeClient) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{activeClient.name}</h1>
                    <p className="text-muted-foreground">Numera Workspace</p>
                </div>
                 <Button variant="outline" onClick={() => router.push('/admin/numera')}>Change Client</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Workspace</CardTitle>
                    <CardDescription>
                        This is where you'll import and allocate transactions for {activeClient.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="text-center py-10">
                        <p className="text-muted-foreground">The transaction workspace is under construction.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
