

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, writeBatch, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, CheckCircle, MoreHorizontal, Edit, PlusCircle, FileCheck2, Save, Eye, Trash2, Brain, SortAsc, Paperclip } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExtractedInvoice, Commission } from '@/lib/types';
import { capChartOfAccounts, s38ChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EditInvoiceForm from '@/components/admin/cap-suppliers/EditInvoiceForm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { format, addDays, eachDayOfInterval, endOfMonth, isFriday, getMonth, isLastDayOfMonth, addMonths, endOfYear, startOfYear, getYear } from 'date-fns';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const ledgerExamples: { [key: string]: string } = {
    '1038-01': 'R&D - Skid Testing - Volkswagen SA - 21/05/2025 @ R4675 x 1 day',
    '1038-02': 'Investigative - Initiation Ransom Fee - Busiseka Media - 01/06/2025 @ R1500 x 1',
    '1038-03': 'Online News24 Subscription - Media24 - 04-2025 @ R104.69',
    '1038-04': 'Online News24 Subscription - Media24 - 04-2025 @ R104.69',
    '1038-05': 'Windeed Searches - Lexis Nexis - Trust Search Not Found - @ R10.76 x 3',
    '1105-05': 'IS6689 - Wanted Dead - Field Presenting - Govan Whittles - 23/03/2025 @ R6000 x 1 day',
    '1105-06': 'Studio Presenting - Erin Bates - 18/05/2025 @ R6000 x 1 episode',
    '1161-01': 'Weekly Promos & Teasers - VO - Xola Ntshinga - 03-12-18-26/05/2025 @ R2875 x 4 weeks',
    '1161-02': 'Weekly Teasers - Afrikaans VO - Lourensa Eckard - 05/05/2025 @ R2875 x 1 week',
    '1161-03': 'IS6709 - Murder n Prison - Insert VO Guest - Lourensa Eckard - 29/05/2025 @ R2875 x 1 insert',
    '1161-04': 'IS6786 - TFU K9 - VO - Macfarlane Moleli - 18/09/2025 @ R2875 x insert',
    '1166-01': 'Presenter Training - Rozanne Mckenzie Media - 18/08-01-04-05/09/2025 @ R1250 x 5 days',
    '2132-01': 'Studio Assistant Director - Jana Pienaar - 27/04/2025 @ R3700 x 1 episode',
    '2133-01': 'Studio Floor Manager - Gontse Nkoko - 25/05/2025 @ R3300 x episode',
    '2138-01': 'Studio Autocue Services - EasiQ - 01-08-15-22-29/06/2025 @ R2275 x 5 episodes',
    '2161-01': 'IS6611 - Bayanda Walaza - DOP - Craig Maarschalk - 03/04/2025 @ R5000 x 1 day',
    '2167-02': 'IS6721 - Scamsters - Drone - New Ending Unmanned - 24/05/2025 @ R13 500 x 1 day',
    '2357-01': 'Set Maintenance - Juan Marcel Consultants CC - 09/09/2025 @ R51 906.50 x 1',
    '2452-01': 'Monthly Retainer - Resident Stylist - Annamarie Bronkhost - 06/2025 @ R16 400.00 x 1 month',
    '2452-02': 'Studio Stylist - Annamarie Bronkhorst - 08/06/2025 @ R2600 x 1 episode',
    '2474-01': 'Wardrobe - Dry Cleaning - Exclusive Dry Cleaners - 04-15/04/2025 @ R3720',
    '2483-01': 'Studio Make-Up Artist - Annamarie Bronkhorst - 27/04/2025 @ R2600 x 1 episode',
    '3131-01': 'IS6775 - Alabuga Start - Location Fees - Msebeyelanga Media - 28/09/2025 @ R793.50 x 1 day',
    '3131-02': 'EDCON - Refreshments - The Catalyst - 25/06/2025 @ R40 x 1 day x 43 pax',
    '3132-01': 'Studio Rental - Stark Films - 08/2025 @ R343 137.57 x 1 month',
    '3176-01': 'IS6714 - Initiation - Location Security - Bear Tactics - 21-25/05/2025 @ R2687.50 x 2 days',
    '3202-01': 'IS6685 - Headache Clinic - Vehicle Rental - Erin Bates - 10-12/03/2025 Bluu - OR Tambo',
    '3211-02': 'Fuel & Oil: Office Generator - Akeela Holdings - Diesel - @ R20.84 x 60.96L',
    '3212-01': 'IS6760 - Border Claim - Parking - Nickolaus Bauer - @ R318.70 x 1',
    '3213-01': 'IS6772 - Under Counter - Toll Fees - Nitro Media - 25-27/08/2025 - Baobab Mainline @ R120',
    '3215-01': 'EP Shuttle - John Webb - Asendulo - 10/04/2025 - JHBHoliday InnRosebank @ R580 x 1',
    '3216-01': 'IS6688 - Refugee Roulette - Mileage - 98Mile Media - 14/04/2025 - EdenvJHBMaraba @ R3.50 x 107kms',
    '3302-01': 'IS6685 - Headache Clinic - Airport Tax - Erin Bates - 10-12/03/2025 Cpt/Jnb/Cpt',
    '3302-02': 'EDCON - Air Ticket - Tarryn Crossman - 26/06/2025 Jnb/Els',
    '3302-03': 'Studio Anchor Travel - Air Ticket - Erin Bates - 21/05/2025 Hla/Cpt',
    '3305-01': 'CB-EP - Air Ticket - John Webb - 19- 21/05/2025 - JHB to GEORGE (Return)',
    '3306-01': 'Travel Agent Management Fees - Izani Embassy JV - 06/2025 @ R10 000 X 1 month',
    '3307-01': 'IS6742 - Secured - Excess Baggage - Kobus Zietsman - DATE @ R1000 x 1 day',
    '3321-01': 'CB-EP - Accommodation - John Webb - Southern Sun Sandton - 01-02/05/2025 @ R1694.14 X 1 days',
    '3321-02': 'IS6722 - Shadow king - Accommodation - Erin Bates - 09-11/06/2025 - The Kingdom Lodge',
    '3321-03': 'EDCON - Accommodation - Anna Lubbe - 25-26/06/2025 - The Catalyst',
    '3331-01': 'Office Craft - Checkers -19/08/25 - T/Spray, T/Paper, Bags, Sugar, Tea, Coffee, Milk, @ R1495.56',
    '3331-02': 'Studio Catering - Stark Films - 15/06/2025 @ R132.00 x 20 pax',
    '3341-01': 'CB-EP - Per Diem - John Webb - @ R300 x 2 nights',
    '3341-02': 'IS6728 - Napier - Per Diem - Catherine/Erin/Greg - 16/06/2025 @ R300 x 1 day x 3 pax',
    '4022-01': 'IS6702 - Respect Dead - Archive Material - Lion Mountain Media - 08/05/2025 @ R3000 x 1 day',
    '4022-02': 'IS6707 - Rags to Ruin - Foreign Special - Delivery - Journeyman Pictures - 06/05/025 @ $150.00',
    '4103-01': 'IS6692 - CMR North - Insert Edit - Ellis & King - 1-3/5/2025 @ R4750 x 3 days',
    '4104-01': 'Edit Suite: In House Inserts - Bars & Tone - 01-31/05/2025 @ R5000 x 1 month',
    '4104-02': 'Edit Suite: Media Managing & Weekly Editing - Bars & Tone - 01-30/06/2025 @ R5000 x 1 month',
    '4105-02': 'Transcripts - Simon Says - 09/08/2025 @ R292.70',
    '4121-01': 'Weekly Teasers & Promos - VO RX - Audio Post Box - 23-30/06/2025 @ R1250 x 1 week',
    '4121-02': 'Weekly Teasers & Promos - AFM - Audio Post Box - 07-13/07/2025 @ R1875 x 1 week',
    '4121-03': 'IS6690 - Last Cast - Insert VO RX - Floris Brand - 09/05/2025 @ R1250 x 1.5 hours',
    '4121-04': 'IS6741 - Paupers Graves - Insert AFM - BKFK Studio - 20/07/2025 @ R1250 x 6 hours',
    '4121-05': 'IS6699 - TFU Impossible - AFM - Floris Brand - 11/04/2025 @ R1250 x 1 hour',
    '4151-01': 'External Hard Drives: Backups',
    '4151-02': 'External Hard Drives: Floating',
    '5003-01': 'Office Rental & Parking Bays',
    '5003-02': 'Office Security',
    '5003-03': 'Office Utilities',
    '5003-04': 'Generator Maintenance - Cummins - Fuel Seperator Spinon - EA - x 1 @ R307.23',
    '5003-05': 'Stationary - TJ Office Supplies - Black pens - @ R21.00 x 5',
    '5010-01': 'Monthly Printer Copy Charges - iTech - 25/10/25 @ R2413.15',
    '5012-01': 'VOIP Cloud Backup - iTRINITY - 09/2025 @ R70 x 26 users',
    '5012-02': 'Mobile Phone Allowances - L Janse Van Rensburg - 06/2025 @ R750.00 x 1 month',
    '5015-01': 'Data Protection: e-Purifier Enterprise - iTRINITY - @ R120 x 57 users',
    '5016-01': 'MS Office Exchange Online (Plan 1) - iTRINITY - 06/2025 @ R85 x 29 users',
    '5016-12': 'IT Support - Remote Monitoring - iTRINITY - 09/2025 @ R80 x 17 users',
};


function AnalyzeStoryDialog({ open, onOpenChange, invoices, onAnalyzeComplete }: { open: boolean; onOpenChange: (open: boolean) => void; invoices: ExtractedInvoice[]; onAnalyzeComplete: () => void; }) {
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        if (open) {
            const fetchCommissions = async () => {
                setIsDataLoading(true);
                try {
                    const commsQuery = query(collection(db, 'commissions'), orderBy('commissionNumber', 'asc'));
                    const commsSnapshot = await getDocs(commsQuery);
                    const fetchedCommissions = commsSnapshot.docs.map(doc => doc.data() as Commission);
                    setCommissions(fetchedCommissions);
                } catch (error) {
                    console.error("Error fetching commissions:", error);
                    toast({ title: 'Error', description: 'Could not load the commission list.', variant: 'destructive' });
                } finally {
                    setIsDataLoading(false);
                }
            };
            fetchCommissions();
        }
    }, [open, toast]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        toast({ title: `Analyzing ${invoices.length} invoice(s)...` });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            for (const invoice of invoices) {
                if (invoice.commissionNumber) {
                    const matchingCommission = commissions.find(
                        (c) => c.commissionNumber === invoice.commissionNumber
                    );

                    if (matchingCommission && matchingCommission.shortName) {
                        const invoiceRef = doc(db, 'extractedInvoices', invoice.id);
                        // Update storyName field with the shortName
                        batch.update(invoiceRef, { storyName: matchingCommission.shortName });
                        updatedCount++;
                    }
                }
            }
            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Analysis Complete', description: `${updatedCount} invoice(s) were updated with a story name.` });
                onAnalyzeComplete();
            } else {
                 toast({ title: 'No Matches Found', description: 'No story names could be found for the selected invoices.', variant: 'default' });
            }
            onOpenChange(false);
        } catch (error) {
            console.error("Error analyzing story names:", error);
            toast({ title: 'Error', description: 'An error occurred during analysis.', variant: 'destructive' });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Analyze Story Names</DialogTitle>
                    <DialogDescription>
                        This will automatically find the "Short Name" from your commissions list and update the "Story Name" for the {invoices.length} selected invoice(s).
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || isDataLoading}>
                         {isAnalyzing || isDataLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                        Analyze and Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function ThirdReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierFilter, setSupplierFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('all');
    const [sortBy, setSortBy] = useState('account');
    const { toast } = useToast();
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [localInvoiceData, setLocalInvoiceData] = useState<ExtractedInvoice[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const { user } = useAuth();
    const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);


    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'pending_third_review'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
            setLocalInvoiceData(fetchedInvoices); // Initialize local state
        } catch (error) {
            console.error("Error fetching invoices for 3rd review:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleFinalApproval = async (invoiceId: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', invoiceId);
            await updateDoc(docRef, { status: 'approved_for_payment' });
            toast({
                title: 'Invoice Approved for Payment',
                description: 'The invoice has been moved to the Payment Control Sheet.',
            });
            fetchInvoices(); // Re-fetch to update the list
        } catch (error) {
            console.error("Error approving invoice:", error);
            toast({
                title: 'Error',
                description: 'Could not move the invoice to the payment control sheet.',
                variant: 'destructive',
            });
        }
    };
    
    const handleBatchApproval = async () => {
        if (selectedInvoices.length === 0) {
            toast({ title: 'No Invoices Selected', variant: 'destructive' });
            return;
        }

        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'approved_for_payment' });
            });
            await batch.commit();

            toast({
                title: selectedInvoices.length + ' Invoice(s) Approved',
                description: 'The selected invoices have been moved to the payment control sheet.',
            });
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            console.error("Error batch approving invoices:", error);
            toast({ title: 'Batch Approval Failed', variant: 'destructive' });
        }
    };

    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            const dataToSave = {
                ...data,
                commissionNumber: data.commissionNumber || null,
                paymentBatch: data.paymentBatch || null,
                expenseType: data.expenseType || null,
                note: data.note || null,
            };
            await updateDoc(docRef, dataToSave);
            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };
    
    const handleLedgerDescriptionChange = (invoiceId: string, lineItemIndex: number, value: string) => {
        setLocalInvoiceData(prevData =>
            prevData.map(invoice => {
                if (invoice.id === invoiceId) {
                    const updatedLineItems = [...invoice.lineItems];
                    updatedLineItems[lineItemIndex] = { ...updatedLineItems[lineItemIndex], ledgerDescription: value };
                    return { ...invoice, lineItems: updatedLineItems };
                }
                return invoice;
            })
        );
    };

    const handleSaveAllLedgerDescriptions = async () => {
        toast({ title: 'Saving...', description: 'Saving all modified ledger descriptions.'});
        try {
            const batch = writeBatch(db);
            let changesFound = 0;
            localInvoiceData.forEach(localInvoice => {
                const originalInvoice = invoices.find(inv => inv.id === localInvoice.id);
                if (originalInvoice && JSON.stringify(localInvoice.lineItems) !== JSON.stringify(originalInvoice.lineItems)) {
                    const docRef = doc(db, 'extractedInvoices', localInvoice.id);
                    batch.update(docRef, { lineItems: localInvoice.lineItems });
                    changesFound++;
                }
            });
            if (changesFound > 0) {
                await batch.commit();
                toast({ title: 'Saved!', description: `${changesFound} invoice(s) have been updated.`});
                fetchInvoices(); 
            } else {
                toast({ title: 'No Changes', description: 'There were no new ledger descriptions to save.'});
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Could not save ledger descriptions.', variant: 'destructive'});
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
         try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'archived', deletedBy: user.uid, deletedAt: serverTimestamp() });
            toast({ title: 'Invoice Deleted', description: 'The invoice has been moved to the deleted list.'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedInvoices.length === 0 || !user) return;
        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'archived', deletedBy: user.uid, deletedAt: serverTimestamp() });
            });
            await batch.commit();
            toast({ title: 'Invoices Deleted', description: selectedInvoices.length + ' invoices have been moved to the deleted list.', variant: 'default'});
            setSelectedInvoices([]);
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete selected invoices.', variant: 'destructive'});
        }
    };


    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    const getAccountDescription = (accountId?: string, expenseType?: 'CAP' | 'S38' | 'S39') => {
        if (!accountId) return { description: 'N/A', number: '' };
    
        let chart;
        switch(expenseType) {
            case 'S38': chart = s38ChartOfAccounts; break;
            case 'S39': chart = s39ChartOfAccounts; break;
            case 'CAP': chart = capChartOfAccounts; break;
            default: chart = [...capChartOfAccounts, ...s38ChartOfAccounts, ...s39ChartOfAccounts];
        }
        const account = chart.find(acc => acc.accountNumber === accountId);
        return account ? { description: account.description, number: account.accountNumber } : { description: accountId, number: accountId };
    }
    
    const uniqueAccounts = useMemo(() => {
        const accountSet = new Set<string>();
        invoices.forEach(invoice => {
            invoice.lineItems.forEach(item => {
                if (item.accountId) {
                    accountSet.add(item.accountId);
                }
            });
        });
        return Array.from(accountSet).map(id => getAccountDescription(id, 'S38')).sort((a,b) => a.number.localeCompare(b.number));
    }, [invoices]);

    const filteredInvoices = useMemo(() => {
        const sorted = [...localInvoiceData].sort((a, b) => {
            if (sortBy === 'account') {
                const accountA = a.lineItems[0]?.accountId || 'zzzz';
                const accountB = b.lineItems[0]?.accountId || 'zzzz';
                return accountA.localeCompare(accountB);
            }
            if (sortBy === 'supplier') {
                return a.supplier.localeCompare(b.supplier);
            }
             if (sortBy === 'date') {
                 // Assuming date is in 'DD/MM/YYYY' format
                const dateA = new Date(a.date.split('/').reverse().join('-'));
                const dateB = new Date(b.date.split('/').reverse().join('-'));
                return dateB.getTime() - dateA.getTime();
            }
            return 0;
        });

        return sorted.filter(invoice => {
            const supplierMatch = invoice.supplier.toLowerCase().includes(supplierFilter.toLowerCase());
            const accountMatch = accountFilter === 'all' || invoice.lineItems.some(item => item.accountId === accountFilter);
            return supplierMatch && accountMatch;
        });
    }, [localInvoiceData, supplierFilter, accountFilter, sortBy]);
    
    const handleToggleSelect = (id: string) => {
        setSelectedInvoices(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }
    
    const handleSelectAll = (checked: boolean) => {
        if(checked) {
            setSelectedInvoices(filteredInvoices.map(i => i.id));
        } else {
            setSelectedInvoices([]);
        }
    }


    return (
        <div className="space-y-8">
             <AnalyzeStoryDialog
                open={isAnalyzeDialogOpen}
                onOpenChange={setIsAnalyzeDialogOpen}
                invoices={invoices.filter(i => selectedInvoices.includes(i.id))}
                onAnalyzeComplete={fetchInvoices}
            />
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">3rd Review</h1>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Invoices Pending Final Approval</CardTitle>
                            <CardDescription>
                                These invoices have passed the second review and are ready for final approval before payment.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <Input
                                placeholder="Filter by supplier..."
                                value={supplierFilter}
                                onChange={(e) => setSupplierFilter(e.target.value)}
                                className="max-w-sm"
                            />
                            <Select value={accountFilter} onValueChange={setAccountFilter}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Filter by Allocated Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Accounts</SelectItem>
                                    {uniqueAccounts.map(acc => (
                                        acc.number &&
                                        <SelectItem key={acc.number} value={acc.number}>
                                            {acc.description} ({acc.number})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="flex justify-between items-center gap-2 pt-4 border-t mt-4">
                        <div className="flex items-center gap-2">
                            <SortAsc className="h-4 w-4 text-muted-foreground"/>
                             <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="account">Allocated Account</SelectItem>
                                    <SelectItem value="supplier">Supplier</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={selectedInvoices.length === 0}>
                                        <Trash2 className="mr-2 h-4 w-4"/>
                                        Delete ({selectedInvoices.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will delete {selectedInvoices.length} invoice(s). You can view them later in the Deleted page.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteSelected}>
                                            Yes, Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button onClick={() => setIsAnalyzeDialogOpen(true)} variant="outline" disabled={selectedInvoices.length === 0}>
                                <Brain className="mr-2 h-4 w-4"/>
                                Analyze ({selectedInvoices.length})
                            </Button>
                             <Button onClick={handleSaveAllLedgerDescriptions} variant="outline">
                                <Save className="mr-2 h-4 w-4" /> Save All Descriptions
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={selectedInvoices.length === 0}>
                                        <FileCheck2 className="mr-2 h-4 w-4" />
                                        Approve Selected ({selectedInvoices.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Batch Approval</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will approve {selectedInvoices.length} invoice(s) and move them to the payment control sheet. Are you sure?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBatchApproval}>Yes, Approve</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">
                            {invoices.length > 0 ? 'No invoices match the current filter.' : 'No invoices are currently pending 3rd review.'}
                        </p>
                    ) : (
                         <div className="space-y-6">
                             <div className="p-2 border rounded-md">
                                 <Checkbox
                                    id="select-all"
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                                    className="mr-2"
                                />
                                <label htmlFor="select-all" className="text-sm font-medium">Select All ({selectedInvoices.length} selected)</label>
                            </div>
                            {filteredInvoices.map((invoice) => (
                                <Card key={invoice.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/50">
                                        <div className="flex flex-wrap justify-between items-center gap-2">
                                            <div className="flex items-center gap-4">
                                                <Checkbox
                                                    checked={selectedInvoices.includes(invoice.id)}
                                                    onCheckedChange={() => handleToggleSelect(invoice.id)}
                                                    aria-label={`Select invoice ${invoice.id}`}
                                                />
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {invoice.supplier}
                                                        {invoice.expenseType && <Badge variant="outline">{invoice.expenseType}</Badge>}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {invoice.commissionNumber && <span>Commission #: {invoice.commissionNumber}</span>}
                                                        {invoice.paymentBatch && 
                                                            <span className="ml-2 pl-2 border-l">
                                                                Batch: {!isNaN(new Date(invoice.paymentBatch).getTime()) ? format(new Date(invoice.paymentBatch), 'dd MMMM yyyy') : invoice.paymentBatch.replace(/_/g, ' ')}
                                                            </span>
                                                        }
                                                        {invoice.storyName && <span className="text-xs italic text-muted-foreground block mt-1">Story: {invoice.storyName}</span>}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button asChild variant="outline" size="icon">
                                                    <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="icon">
                                                                <Paperclip className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuLabel>Supporting Docs</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {invoice.supportingDocuments.map((doc, i) => (
                                                                <DropdownMenuItem key={i} asChild>
                                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">{doc.fileName}</a>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                         <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                    <FileCheck2 className="mr-2 h-4 w-4" /> Approve for Payment
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Confirm Final Approval</AlertDialogTitle>
                                                                    <AlertDialogDescription>This will move the invoice for "{invoice.supplier}" to the payment control sheet. Are you sure?</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleFinalApproval(invoice.id)}>Yes, Approve</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                                                        </DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will move the invoice for {invoice.supplier} to the deleted folder.</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(invoice.id)}>Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                       <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[60%]">Description</TableHead>
                                                    <TableHead className="text-right">Allocated Account</TableHead>
                                                    <TableHead className="text-right">Exclusive Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoice.lineItems.map((item, index) => {
                                                    const account = getAccountDescription(item.accountId, invoice.expenseType);
                                                    const example = item.accountId ? ledgerExamples[item.accountId] : '';
                                                    return (
                                                        <TableRow key={'' + invoice.id + '-' + index}>
                                                            <TableCell className="align-top">
                                                                <p className="font-semibold whitespace-normal">{item.description}</p>
                                                                <Input
                                                                    value={item.ledgerDescription || ''}
                                                                    onChange={(e) => handleLedgerDescriptionChange(invoice.id, index, e.target.value)}
                                                                    placeholder="Enter ledger description..."
                                                                    className="mt-1"
                                                                />
                                                                 {example && (
                                                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                                                        e.g., {example}
                                                                    </p>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="align-top text-right">
                                                                <p>{account.description}</p>
                                                                <p className="text-xs text-muted-foreground">{account.number}</p>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono align-top">{formatPrice(item.exclusiveAmount)}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <Dialog open={!!editingInvoice} onOpenChange={(isOpen) => !isOpen && setEditingInvoice(null)}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Edit Invoice: {editingInvoice?.supplier}</DialogTitle>
                        <DialogDescription>Review and correct the extracted data.</DialogDescription>
                    </DialogHeader>
                    <EditInvoiceForm 
                        invoice={editingInvoice} 
                        onSave={handleSave} 
                        onCancel={() => setEditingInvoice(null)} 
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
