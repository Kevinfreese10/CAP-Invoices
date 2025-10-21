

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Upload, AlertTriangle, Mail } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob, ClientCustomer, Invoice } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { extractStatementPeriod } from '@/ai/flows/extract-statement-period';
import { suggestIncomeAllocation } from '@/ai/flows/suggest-income-allocation';
import { Progress } from '@/components/ui/progress';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth, parseISO, addMonths } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { requestMissingStatements } from '@/app/actions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';


const PAGE_SIZE = 50;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Upload Statement Dialog
type ExtractedTransaction = {
    date: string;
    description: string;
    amount: number;
};

type PeriodAnalysisResult = {
    fileName: string;
    startDate: string;
    endDate: string;
};

function UploadStatementDialog({ client, bankAccountId, onImportComplete }: { client: User | null, bankAccountId: string, onImportComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [periodAnalysis, setPeriodAnalysis] = useState<PeriodAnalysisResult[]>([]);
    const [missingMonths, setMissingMonths] = useState<string[]>([]);
    const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransaction[]>([]);
    const { toast } = useToast();

    const resetState = () => {
        setFiles([]);
        setPeriodAnalysis([]);
        setMissingMonths([]);
        setExtractedTransactions([]);
        setIsAnalyzing(false);
        setIsExtracting(false);
        setIsUploading(false);
        const fileInput = document.getElementById('ai-statement-file') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            setFiles(Array.from(selectedFiles));
            // Reset states for a new upload batch
            setPeriodAnalysis([]);
            setMissingMonths([]);
            setExtractedTransactions([]);
        }
    };
    
    useEffect(() => {
        if (files.length > 0 && periodAnalysis.length === 0) { // Only run if analysis hasn't been done
            handlePeriodAnalysis();
        }
    }, [files]);

    const groupConsecutiveMonths = (monthDates: Date[]): string[] => {
        if (monthDates.length === 0) return [];
    
        monthDates.sort((a,b) => a.getTime() - b.getTime());
    
        const ranges: string[] = [];
        let startRange: Date = monthDates[0];
    
        for (let i = 0; i < monthDates.length; i++) {
            const currentMonth = monthDates[i];
            const nextMonth = monthDates[i + 1];
    
            if (!nextMonth || nextMonth.getTime() !== addMonths(currentMonth, 1).getTime()) {
                if (startRange.getTime() === currentMonth.getTime()) {
                    ranges.push(format(startRange, 'dd MMMM yyyy'));
                } else {
                    const rangeEnd = endOfMonth(currentMonth);
                    ranges.push(`${format(startRange, 'dd MMMM yyyy')} to ${format(rangeEnd, 'dd MMMM yyyy')}`);
                }
                if(nextMonth) {
                    startRange = nextMonth;
                }
            }
        }
        return ranges;
    };
    
    
    const handlePeriodAnalysis = async () => {
        setIsAnalyzing(true);
        toast({ title: `Analyzing ${files.length} file(s)...`, description: "The AI is checking the statement periods." });

        const analysisResults = await Promise.all(files.map(async (file) => {
            const reader = new FileReader();
            return new Promise<PeriodAnalysisResult | null>((resolve) => {
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const dataUrl = reader.result as string;
                    try {
                        const result = await extractStatementPeriod({ statementPdf: dataUrl });
                        if (result && result.startDate && result.endDate) {
                            resolve({ fileName: file.name, ...result });
                        } else {
                            toast({ title: `Analysis Error`, description: `Could not determine date range for ${file.name}.`, variant: 'destructive'});
                            resolve(null);
                        }
                    } catch (error) {
                        toast({ title: `Analysis Error`, description: `Failed to analyze ${file.name}.`, variant: 'destructive'});
                        console.error(`Statement analysis error for ${file.name}:`, error);
                        resolve(null);
                    }
                };
                reader.onerror = () => {
                    toast({ title: `File Error`, description: `Could not read ${file.name}.`, variant: 'destructive'});
                    resolve(null);
                };
            });
        }));
        
        const validResults = analysisResults.filter((r): r is PeriodAnalysisResult => r !== null);
        
        if (validResults.length > 0) {
            validResults.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            setPeriodAnalysis(validResults);

            const allDates = validResults.flatMap(r => [parseISO(r.startDate), parseISO(r.endDate)]);
            if (allDates.length > 1) {
                const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
                
                const interval = { start: startOfMonth(minDate), end: endOfMonth(maxDate) };
                const allMonthsInInterval = eachMonthOfInterval(interval);
                
                const presentMonths = new Set<string>();
                validResults.forEach(r => {
                    const start = parseISO(r.startDate);
                    const end = parseISO(r.endDate);
                    const monthsInFile = eachMonthOfInterval({ start, end });
                    monthsInFile.forEach(monthStart => {
                        presentMonths.add(`${getYear(monthStart)}-${getMonth(monthStart)}`);
                    });
                });
                
                const foundMissingMonthDates = allMonthsInInterval
                    .filter(monthStart => !presentMonths.has(`${getYear(monthStart)}-${getMonth(monthStart)}`));
                
                setMissingMonths(groupConsecutiveMonths(foundMissingMonthDates));
            }
        }
        setIsAnalyzing(false);
    };

    const handleExtractTransactions = async () => {
        setIsExtracting(true);
        toast({ title: 'Extracting Transactions...', description: `The AI is now reading all transaction data from ${files.length} file(s).` });
        
        const allTransactions: ExtractedTransaction[] = [];
        await Promise.all(files.map(file => new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                try {
                    const result = await extractStatementData({ statementPdf: dataUrl });
                    if (result && result.transactions && result.transactions.length > 0) {
                        allTransactions.push(...result.transactions);
                    }
                } catch (error) {
                    console.error(`Transaction extraction error for ${file.name}:`, error);
                } finally {
                    resolve();
                }
            };
             reader.onerror = () => {
                 toast({ title: `File Error for ${file.name}`, description: 'Could not read the selected file.', variant: 'destructive' });
                 resolve();
            };
        })));
        
        if (allTransactions.length > 0) {
            allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExtractedTransactions(allTransactions);
        } else {
             toast({ title: 'Extraction Failed', description: 'No transactions could be found in any of the provided files.', variant: 'destructive' });
        }
        
        setIsExtracting(false);
    };
    
    const handleImport = async () => {
        if (!client || !client.uid || !bankAccountId || extractedTransactions.length === 0) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Saving extracted transactions."});

        try {
            const batch = writeBatch(db);
            const dailyCounters: { [key: string]: number } = {};

            extractedTransactions.forEach((row) => {
                 const parsedDate = new Date(row.date);
                 if (isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row with invalid date:`, row);
                    return;
                }
                
                const dateString = parsedDate.toISOString().split('T')[0].replace(/-/g, '');
                dailyCounters[dateString] = (dailyCounters[dateString] || 0) + 1;
                const dailyIndex = String(dailyCounters[dateString]).padStart(2, '0');
                const reference = `${dateString}${dailyIndex}`;
                
                const newTransactionRef = doc(collection(db, 'aiAccountantClients', client.uid, 'transactions'));
                
                const transaction: Omit<ImportedTransaction, 'id'> = {
                    clientId: client.uid,
                    date: parsedDate.toISOString(),
                    reference: reference,
                    description: row.description,
                    amount: row.amount,
                    bankAccountId: bankAccountId,
                    status: 'new'
                };
                
                batch.set(newTransactionRef, transaction);
            });
            
            await batch.commit();

            toast({ title: "Import Successful", description: `${extractedTransactions.length} transactions have been imported.`});
            onImportComplete();
            setIsOpen(false);
            resetState();
        } catch (error) {
            console.error("Error importing extracted transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleRequestStatements = async () => {
        if (!client || !client.email || missingMonths.length === 0) {
            toast({ title: "Cannot Send Request", description: "Client email or missing months are not defined.", variant: "destructive"});
            return;
        }
        toast({ title: "Sending Request...", description: `Emailing ${client.name} for missing statements.` });
        try {
            await requestMissingStatements({
                clientName: client.name,
                clientEmail: client.email,
                missingPeriods: missingMonths,
            });
            toast({ title: "Request Sent!", description: "An email has been sent to the client."});
        } catch (error) {
            console.error("Error sending missing statement request:", error);
            toast({ title: "Request Failed", description: "Could not send the email.", variant: "destructive"});
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
            <DialogTrigger asChild>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Upload Statement(s)</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Upload Bank Statement (AI Extraction)</DialogTitle>
                    <DialogDescription>
                       Select one or more PDF or image files of a bank statement. The AI will extract the transactions for you to review and import.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <Input id="ai-statement-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleFileChange} disabled={isAnalyzing || isExtracting} multiple />
                     
                     {(isAnalyzing || isExtracting) && 
                        <div className="flex items-center gap-2 text-primary">
                            <Loader2 className="animate-spin"/>
                            <span>{isAnalyzing ? "Analyzing periods..." : "Extracting transactions..."}</span>
                        </div>
                     }
                     
                     {periodAnalysis.length > 0 && extractedTransactions.length === 0 && !isExtracting && (
                        <div className="pt-4 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Period Analysis</CardTitle>
                                    <CardDescription>Review the detected statement periods before proceeding.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {missingMonths.length > 0 && (
                                        <Alert variant="destructive" className="mb-4">
                                            <AlertTriangle className="h-4 w-4" />
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <AlertTitle>Missing Statement Periods Detected</AlertTitle>
                                                    <AlertDescription>
                                                        The following months appear to be missing between your uploaded files: {missingMonths.join(', ')}
                                                    </AlertDescription>
                                                </div>
                                                 <Button variant="outline" size="sm" onClick={handleRequestStatements}><Mail className="mr-2 h-4 w-4"/> Request from Client</Button>
                                            </div>
                                        </Alert>
                                    )}
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Start Date</TableHead>
                                                <TableHead>End Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {periodAnalysis.map((p, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{p.fileName}</TableCell>
                                                    <TableCell>{format(parseISO(p.startDate), 'dd MMMM yyyy')}</TableCell>
                                                    <TableCell>{format(parseISO(p.endDate), 'dd MMMM yyyy')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                     )}

                     {extractedTransactions.length > 0 && 
                        <div className="pt-4 space-y-4">
                            <p className="text-sm font-semibold text-green-600">Extracted {extractedTransactions.length} transactions:</p>
                             <ScrollArea className="h-64 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {extractedTransactions.map((tx, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </div>
                     }
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                     {periodAnalysis.length > 0 && extractedTransactions.length === 0 && (
                        <Button type="button" onClick={handleExtractTransactions} disabled={isExtracting || isAnalyzing}>
                            {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Extract {files.length} Statement(s)
                        </Button>
                    )}
                    {extractedTransactions.length > 0 && (
                        <Button type="button" onClick={handleImport} disabled={isUploading}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save {extractedTransactions.length} Transactions
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
// #endregion

// #region Import Dialog
const importFormSchema = z.object({
  file: z.any().refine(file => file instanceof File, "A CSV or Excel file is required."),
});

type ParsedTransaction = {
    Date: string;
    Description: string;
    Amount: number;
}

function ImportDialog({ client, bankAccountId, onImportComplete, globalRules }: { client: User | null, bankAccountId: string, onImportComplete: () => void, globalRules: AllocationRule[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const [potentialAllocations, setPotentialAllocations] = useState(0);
    const [potentialAiAllocations, setPotentialAiAllocations] = useState(0);

    const resetState = useCallback(() => {
        setFile(null);
        setParsedTransactions([]);
        setPotentialAllocations(0);
        setPotentialAiAllocations(0);
        setIsParsing(false);
        setIsUploading(false);
        const fileInput = document.getElementById('statement-file') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setIsParsing(true);
            setFile(selectedFile);
            setParsedTransactions([]);
            setPotentialAllocations(0);
            setPotentialAiAllocations(0);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const fileContent = event.target?.result;
                if (!fileContent) {
                    setIsParsing(false);
                    return;
                }

                Papa.parse(fileContent as string, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const data = results.data as any[];
                        const transactions: ParsedTransaction[] = data.map(row => ({
                            Date: row.Date,
                            Description: row.Description,
                            Amount: parseFloat(row.Amount)
                        })).filter(tx => tx.Date && tx.Description && !isNaN(tx.Amount));
                        
                        setParsedTransactions(transactions);

                        let ruleAllocationCount = 0;
                        let aiAllocationCount = 0;
                        
                        const allRules = [...(client?.allocationRules || []), ...globalRules];

                        if (allRules.length > 0) {
                            for (const tx of transactions) {
                                const txDescriptionLower = tx.Description.toLowerCase();
                                const matchedRule = allRules.find(rule => 
                                    rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                                );
                                if (matchedRule) {
                                    ruleAllocationCount++;
                                }
                                else if (tx.Amount < 0) {
                                    aiAllocationCount++;
                                }
                            }
                        } else {
                            aiAllocationCount = transactions.filter(tx => tx.Amount < 0).length;
                        }
                        
                        setPotentialAllocations(ruleAllocationCount);
                        setPotentialAiAllocations(aiAllocationCount);
                        setIsParsing(false);
                    }
                });
            };
            reader.readAsText(selectedFile);
        }
    };
    
    const handleImport = async () => {
        if (!file || !client || !client.uid || !bankAccountId || parsedTransactions.length === 0) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Processing your file and applying rules."});

        try {
            const batch = writeBatch(db);
            let importedCount = 0;
            const dailyCounters: { [key: string]: number } = {};
            const allRules = [...(client.allocationRules || []), ...globalRules];

            parsedTransactions.forEach((row, index) => {
                const parsedDate = new Date(row.Date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));

                if (isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row ${index + 2}: Invalid date format.`);
                    return;
                }
                
                const dateString = parsedDate.toISOString().split('T')[0].replace(/-/g, '');
                dailyCounters[dateString] = (dailyCounters[dateString] || 0) + 1;
                const dailyIndex = String(dailyCounters[dateString]).padStart(2, '0');
                const reference = `${dateString}${dailyIndex}`;
                
                const newTransactionRef = doc(collection(db, 'aiAccountantClients', client.uid!, 'transactions'));
                
                let transaction: Omit<ImportedTransaction, 'id'> = {
                    clientId: client.uid!,
                    date: parsedDate.toISOString(),
                    reference: reference,
                    description: row.Description,
                    amount: row.Amount,
                    bankAccountId: bankAccountId,
                    status: 'new'
                };
                
                const txDescriptionLower = row.Description.toLowerCase();
                const matchedRule = allRules.find(rule => 
                    rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                );

                if (matchedRule) {
                    transaction.status = 'review';
                    transaction.allocatedTo = { value: matchedRule.accountId, type: 'account' };
                    transaction.vatType = matchedRule.vatType;
                }

                batch.set(newTransactionRef, transaction);
                importedCount++;
            });
            
            await batch.commit();

            toast({ title: "Import Successful", description: `${importedCount} transactions have been imported. ${potentialAllocations} transactions were automatically allocated for review.`});
            onImportComplete();
            setIsOpen(false);
            resetState();
        } catch (error) {
            console.error("Error importing transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        resetState();
    }, [resetState]);
    
    const handleDownloadExample = () => {
        const csvContent = "Date,Description,Amount\nDD/MM/YYYY,Example Payment,-150.00\nDD/MM/YYYY,Example Income,1000.50";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'example-statement.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const importTotal = useMemo(() => {
        return parsedTransactions.reduce((sum, tx) => sum + tx.Amount, 0);
    }, [parsedTransactions]);

    const totalAutomated = potentialAllocations + potentialAiAllocations;
    const timeSavedMinutes = totalAutomated * 0.5; // Example: 30 seconds per auto-allocation
    const timeSavedHours = Math.ceil(timeSavedMinutes / 60);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
            <DialogTrigger asChild>
                <Button><FileUp className="mr-2 h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Bank Statement</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import transactions. The system will automatically allocate transactions based on your rules.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="flex items-center justify-between">
                         <Label htmlFor="statement-file">Statement File</Label>
                         <Button variant="outline" size="sm" onClick={handleDownloadExample}><Download className="mr-2 h-4 w-4"/> Download Example</Button>
                     </div>
                     <Input id="statement-file" type="file" accept=".csv" onChange={handleFileChange} />
                     {isParsing && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 animate-spin"/> Parsing file...</p>}
                     {parsedTransactions.length > 0 && 
                        <div className="pt-4 space-y-4">
                             <div className="space-y-1">
                                <p className="text-sm text-green-600 font-semibold">{parsedTransactions.length} transactions found in file.</p>
                                {totalAutomated > 0 && (
                                     <p className="text-sm text-purple-600">
                                       {totalAutomated} transaction(s) can be automatically processed (by rules or AI), saving you an estimated {timeSavedHours} hour(s).
                                    </p>
                                )}
                            </div>
                        </div>
                     }
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
                    <Button type="button" onClick={handleImport} disabled={isUploading || isParsing || parsedTransactions.length === 0}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save {parsedTransactions.length > 0 ? parsedTransactions.length : ''} Transactions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
// #endregion

// #region Bank Account Management Dialogs

const editAccountSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Bank account name is required."),
});

function EditAccountDialog({ account, client, onAccountUpdated, onOpenChange, open }: { account: ChartOfAccount, client: User | null, onAccountUpdated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof editAccountSchema>>({
        resolver: zodResolver(editAccountSchema),
        defaultValues: { id: account.id, name: account.description },
    });

    const handleEditAccount = async (values: z.infer<typeof editAccountSchema>) => {
        if (!client || !client.uid) return;
        setIsSaving(true);
        try {
            const updatedAccounts = client.chartOfAccounts?.map(acc =>
                acc.id === values.id ? { ...acc, description: values.name } : acc
            ) || [];

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });

            toast({ title: 'Bank Account Updated', description: `The account name has been changed to ${values.name}.` });
            onAccountUpdated();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating bank account:", error);
            toast({ title: 'Error', description: 'Could not update the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Bank Account</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleEditAccount)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const createAccountSchema = z.object({
  name: z.string().min(3, "Bank account name is required."),
});

function CreateAccountDialog({ client, onAccountCreated, onOpenChange, open }: { client: User | null, onAccountCreated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof createAccountSchema>>({
        resolver: zodResolver(createAccountSchema),
        defaultValues: { name: '' },
    });

    const handleCreateAccount = async (values: z.infer<typeof createAccountSchema>) => {
        if (!client || !client.uid) return;
        setIsSaving(true);
        try {
            const existingBankAccounts = client.chartOfAccounts?.filter(
                acc => acc.accountNumber.startsWith('8400-')
            ) || [];

            const existingNumbers = existingBankAccounts.map(acc => {
                const parts = acc.accountNumber.split('-');
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            });

            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            const newAccountNumber = `8400-${String(nextNumber).padStart(3, '0')}`;

            const newAccount: ChartOfAccount = {
                id: newAccountNumber,
                accountNumber: newAccountNumber,
                description: values.name,
                section: 'Balance Sheet',
            };

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, {
                chartOfAccounts: arrayUnion(newAccount)
            });

            toast({ title: 'Bank Account Created', description: `Account ${newAccount.description} (${newAccount.accountNumber}) has been added.` });
            onAccountCreated();
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating bank account:", error);
            toast({ title: 'Error', description: 'Could not create the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Bank Account</DialogTitle>
                    <DialogDescription>
                        This will add a new cashbook account to this client's chart of accounts.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input placeholder="e.g., FNB Cheque Account" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// #endregion

// #region Rule Creation Dialog

const ruleFormSchema = z.object({
  description: z.string().min(3, "Rule description is required."),
  keywords: z.string().min(2, "At least one keyword is required."),
  accountId: z.string().min(1, "Account is required."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
  scope: z.enum(['client', 'global']).default('client'),
});

function CreateRuleDialog({ client, onRuleCreated, open, onOpenChange, defaultValues }: { client: User | null; onRuleCreated: () => void; open: boolean; onOpenChange: (open: boolean) => void; defaultValues?: Partial<z.infer<typeof ruleFormSchema>> }) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof ruleFormSchema>>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: defaultValues,
  });
  
  useEffect(() => {
    form.reset(defaultValues || {
      description: "",
      keywords: "",
      accountId: "",
      vatType: "standard_rated_purchases",
      scope: "client",
    });
  }, [open, defaultValues, form]);

  const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
    setIsSaving(true);
    
    const newRule: Partial<AllocationRule> = {
      description: values.description,
      keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
      accountId: values.accountId,
      vatType: values.vatType,
      type: 'hard', // All user-created rules are 'hard' rules
    };

    try {
        if (values.scope === 'global') {
            await addDoc(collection(db, 'allocationRules'), newRule);
            toast({ title: "Global Rule Created", description: `The rule "${values.description}" has been added globally.`});
        } else {
            if (!client || !client.uid) {
                toast({ title: 'Error', description: 'No client selected for client-specific rule.', variant: 'destructive'});
                setIsSaving(false);
                return;
            }
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, {
                allocationRules: arrayUnion(newRule),
            });
            toast({ title: "Client Rule Created", description: `The rule "${values.description}" has been added to this client.`});
        }

      form.reset();
      onOpenChange(false);
      onRuleCreated(); // Callback to refetch client/global data
    } catch (error) {
      console.error("Error creating rule:", error);
      toast({ title: 'Error', description: 'Could not create the allocation rule.', variant: 'destructive'});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Allocation Rule</DialogTitle>
          <DialogDescription>
            This rule will be applied to transactions to automatically categorize them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveRule)} className="space-y-4">
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Rule Scope</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex items-center space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="client" /></FormControl>
                        <FormLabel className="font-normal">Client Specific</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="global" /></FormControl>
                        <FormLabel className="font-normal">Global (All Clients)</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input placeholder="e.g., Monthly bank charges" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., monthly account fee, service fee" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate To Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// #endregion

const NewTransactionsTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[]; invoices: Invoice[]; fetchClientData: () => void; globalRules: AllocationRule[] }
>(({ client, bankAccountId, customers, invoices, fetchClientData, globalRules }, ref) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [allocations, setAllocations] = useState<{ [txId: string]: { value: string, type: 'account' | 'customer' | 'supplier', vatType?: VatType } }>({});
    const [searchAccountTerm, setSearchAccountTerm] = useState('');
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<Partial<z.infer<typeof ruleFormSchema>>>({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases', scope: 'client' });
    const [isAiAllocating, setIsAiAllocating] = useState(false);
    const [isRuleAllocating, setIsRuleAllocating] = useState(false);

    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const newTransactionsQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
            constraints.push(where('amount', '>=', 0));
        }
        
        constraints.push(orderBy(sortField, sortDirection));
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection]);

    const {
        documents: transactions,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: newTransactionsQuery, pageSize: PAGE_SIZE });
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));

    useEffect(() => {
        refetch();
    }, [activeSubTab, refetch]);
    
    const handleAllocateByRules = useCallback(async () => {
        if (!client || !client.uid || transactions.length === 0) return;
        setIsRuleAllocating(true);
        toast({ title: "Applying Rules...", description: "Allocating transactions based on client and global rules." });
    
        const batch = writeBatch(db);
        let allocatedCount = 0;
        const allRules = [...(client.allocationRules || []), ...globalRules];
    
        transactions.forEach(tx => {
            const txDescriptionLower = tx.description.toLowerCase();
            
            const matchedRule = allRules.find(rule => 
                rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
            );
    
            if (matchedRule) {
                const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                batch.update(transactionRef, {
                    status: 'review',
                    allocatedTo: { value: matchedRule.accountId, type: 'account' },
                    vatType: matchedRule.vatType,
                    allocatedAt: new Date(),
                });
                allocatedCount++;
            }
        });
        
        if (allocatedCount > 0) {
            await batch.commit();
            toast({ title: 'Rules Applied', description: `${allocatedCount} transaction(s) have been allocated for review.` });
            refetch();
        } else {
            toast({ title: 'No Matches Found', description: 'No transactions matched your existing rules.' });
        }
        
        setIsRuleAllocating(false);
    }, [client, transactions, globalRules, toast, refetch]);

    const handleRuleCreated = useCallback(() => {
        fetchClientData();
        // Use a timeout to ensure the client data (with new rule) is likely fetched before allocating
        setTimeout(() => {
            handleAllocateByRules();
        }, 1000);
    }, [fetchClientData, handleAllocateByRules]);


    const handleAiExpenseAllocate = async () => {
        if (!client || !client.uid || !client.chartOfAccounts || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));
        const totalToProcess = transactionsToAllocate.length;
        const chartOfAccountsJson = JSON.stringify(client.chartOfAccounts.map(c => ({ id: c.id, accountNumber: c.accountNumber, description: c.description })));
        
        let successCount = 0;
        let processedCount = 0;

        for (const tx of transactionsToAllocate) {
            processedCount++;
            try {
                const result = await suggestTransactionAllocation({
                    description: tx.description,
                    chartOfAccounts: chartOfAccountsJson,
                });

                if (result.accountId && result.confidence > 70) {
                    const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
                    await updateDoc(transactionRef, {
                        status: 'review',
                        allocatedTo: { value: result.accountId, type: 'account' },
                        vatType: result.vatType,
                        allocatedAt: new Date(),
                    });
                    successCount++;
                    
                    const accountName = client.chartOfAccounts.find(a => a.id === result.accountId)?.description || 'Unknown';
                    
                    toast({
                        title: `Allocated ${processedCount} of ${totalToProcess}`,
                        description: (
                            <div>
                                <p>Transaction: <span className="font-semibold">{tx.description}</span></p>
                                <p>Account: <span className="font-semibold">{accountName}</span></p>
                                <p>VAT Type: <span className="font-semibold">{result.vatType}</span></p>
                                <p>AI Confidence: <span className="font-semibold">{result.confidence}%</span></p>
                            </div>
                        ),
                        duration: 5000,
                    });
                }
            } catch (error) {
                console.error(`AI allocation failed for tx ${tx.id}:`, error);
                 toast({
                    title: `Processing Failed for Tx ${processedCount}`,
                    description: 'The AI could not allocate this transaction.',
                    variant: 'destructive',
                 });
            }
        }
        
        toast({
            title: "AI Allocation Complete",
            description: `${successCount} out of ${totalToProcess} transactions were confidently allocated for review.`
        });
        
        setSelectedTransactions([]);
        refetch();
        setIsAiAllocating(false);
    };

    const handleAiIncomeAllocate = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "AI is allocating...", description: `Processing ${selectedTransactions.length} income transactions.` });
        
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));
        const customersWithInvoices = customers.map(c => ({
            id: c.id,
            name: c.name,
            invoiceNumbers: invoices.filter(inv => inv.customerId === c.id).map(inv => inv.id),
        }));

        const batch = writeBatch(db);
        let successCount = 0;

        for (const tx of transactionsToAllocate) {
            try {
                const result = await suggestIncomeAllocation({
                    description: tx.description,
                    customers: JSON.stringify(customersWithInvoices)
                });

                if (result.customerId && result.confidence > 70) {
                    const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
                    batch.update(transactionRef, {
                        status: 'review', // Move to review instead of allocated
                        allocatedTo: { value: result.customerId, type: 'customer' },
                        vatType: 'no_vat',
                        allocatedAt: new Date(),
                    });
                    successCount++;
                }
            } catch (error) {
                console.error(`AI allocation failed for tx ${tx.id}:`, error);
            }
        }
        
        try {
            await batch.commit();
            if(successCount > 0) {
              toast({ title: "AI Allocation Complete", description: `${successCount} out of ${selectedTransactions.length} transactions were confidently allocated for review.` });
            } else {
               toast({ title: "AI Allocation", description: `The AI could not confidently allocate any of the selected transactions.`, variant: 'destructive'});
            }
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            console.error("Error committing AI allocations:", error);
            toast({ title: "AI Allocation Failed", description: "An error occurred while saving the allocations.", variant: "destructive" });
        } finally {
            setIsAiAllocating(false);
        }
    };


    const handleBulkDelete = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        const batch = writeBatch(db);
        selectedTransactions.forEach(txId => {
            const docRef = doc(db, 'aiAccountantClients', client!.uid, 'transactions', txId);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.`, variant: 'destructive' });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            toast({ title: 'Deletion Failed', variant: 'destructive' });
            console.error(error);
        }
    };

    const handleBulkAllocate = async (allocation: { value: string, type: 'account' | 'customer' | 'supplier' }, vatType: VatType) => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        toast({ title: "Allocating...", description: `Allocating ${selectedTransactions.length} transactions.` });

        const batch = writeBatch(db);
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));

        for (const tx of transactionsToAllocate) {
            const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
            batch.update(transactionRef, {
                status: 'review',
                allocatedTo: allocation,
                vatType: vatType,
                allocatedAt: new Date(),
            });
        }

        try {
            await batch.commit();
            toast({ title: "Allocation Successful", description: `${selectedTransactions.length} transactions have been sent for review.` });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            console.error("Error during bulk allocation:", error);
            toast({ title: "Allocation Failed", variant: "destructive" });
        }
    };
    
    const allocationOptions = useMemo(() => {
        const accounts = client?.chartOfAccounts?.map(acc => ({
            value: acc.id,
            label: acc.description,
            group: 'Accounts',
        })) || [];
        const customerOptions = customers.map(cust => ({
            value: cust.id,
            label: cust.name,
            group: 'Customers',
        }));
        // Add suppliers here when available
        return [...accounts, ...customerOptions];
    }, [client?.chartOfAccounts, customers]);
    
    return (
        <Card>
            <CreateRuleDialog
                client={client}
                onRuleCreated={handleRuleCreated}
                open={isCreateRuleOpen}
                onOpenChange={(isOpen) => {
                    setIsCreateRuleOpen(isOpen);
                    if (!isOpen) {
                        setRuleDefaultValues({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases', scope: 'client' });
                    }
                }}
                defaultValues={ruleDefaultValues}
            />
            <CardHeader className="p-0">
                <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 border-b flex items-center gap-2 flex-wrap">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Actions <MoreHorizontal className="ml-2 h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger disabled={selectedTransactions.length === 0}>Allocate Selected</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="p-0">
                                    <Command>
                                        <CommandInput placeholder="Search..." value={searchAccountTerm} onValueChange={setSearchAccountTerm} />
                                        <CommandList>
                                            <ScrollArea className="h-72">
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup heading="Accounts">
                                                {client?.chartOfAccounts?.filter(acc => acc.description.toLowerCase().includes(searchAccountTerm.toLowerCase())).map(acc => (
                                                    <DropdownMenuSub key={acc.id}>
                                                        <DropdownMenuSubTrigger>{acc.description}</DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {allVatTypes.map(vat => (
                                                                <DropdownMenuItem key={vat.name} onSelect={() => handleBulkAllocate({value: acc.id, type: 'account'}, vat.name)}>
                                                                    {vat.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup heading="Customers">
                                                 {customers.filter(c => c.name.toLowerCase().includes(searchAccountTerm.toLowerCase())).map(c => (
                                                     <DropdownMenuItem key={c.id} onSelect={() => handleBulkAllocate({value: c.id, type: 'customer'}, 'no_vat')}>
                                                        {c.name}
                                                    </DropdownMenuItem>
                                                 ))}
                                            </CommandGroup>
                                            </ScrollArea>
                                        </CommandList>
                                    </Command>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={selectedTransactions.length === 0}>
                                        Delete Selected
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBulkDelete}>Yes, Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                     </DropdownMenu>

                     {activeSubTab === 'expenses' ? (
                        <>
                        <Button variant="outline" onClick={handleAllocateByRules} disabled={isRuleAllocating || transactions.length === 0}>
                            {isRuleAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookOpen className="mr-2 h-4 w-4"/>}
                            Allocate All by Rules
                        </Button>
                        <Button variant="outline" onClick={handleAiExpenseAllocate} disabled={isAiAllocating || selectedTransactions.length === 0}>
                           {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                           AI Allocate Selected
                        </Button>
                        </>
                     ) : (
                        <Button variant="outline" onClick={handleAiIncomeAllocate} disabled={isAiAllocating || selectedTransactions.length === 0}>
                           {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                           AI Allocate Selected
                        </Button>
                     )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={transactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead className="w-[250px]">Allocate To</TableHead>
                                {client?.isVatRegistered && <TableHead className="w-[180px]">VAT Type</TableHead>}
                                <TableHead className="text-right">
                                     <Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No new transactions found.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell className="font-mono">{tx.reference}</TableCell>
                                        <TableCell>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                        {allocations[tx.id] ? allocationOptions.find(o => o.value === allocations[tx.id].value)?.label : "Select..."}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search..." />
                                                        <CommandList>
                                                            <CommandEmpty>No results found.</CommandEmpty>
                                                            <CommandGroup heading="Customers">
                                                                {customers.map(c => <CommandItem key={c.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: c.id, type: 'customer' }}))}>{c.name}</CommandItem>)}
                                                            </CommandGroup>
                                                            <CommandGroup heading="Accounts">
                                                                {client?.chartOfAccounts?.map(acc => <CommandItem key={acc.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: acc.id, type: 'account' }}))}>{acc.description}</CommandItem>)}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        {client?.isVatRegistered && (
                                            <TableCell>
                                                <Select
                                                   value={allocations[tx.id]?.vatType}
                                                   onValueChange={(value) => setAllocations(prev => ({...prev, [tx.id]: {...prev[tx.id], vatType: value as VatType}}))}
                                                   disabled={allocations[tx.id]?.type === 'customer'}
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allVatTypes.map(vat => (
                                                            <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                     <DropdownMenuItem onSelect={() => {
                                                        const firstKeyword = tx.description.split(/\s+/)[0];
                                                        setIsCreateRuleOpen(true);
                                                        setRuleDefaultValues({ 
                                                            description: '', 
                                                            keywords: firstKeyword, 
                                                            accountId: '', 
                                                            vatType: 'standard_rated_purchases',
                                                            scope: 'client',
                                                        });
                                                     }}>
                                                        Create Rule from Transaction
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={!canGoPrev || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {currentPage}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={!canGoNext || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
});
NewTransactionsTab.displayName = 'NewTransactionsTab';


const ForReviewTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; fetchClientData: () => void; customers: ClientCustomer[] }
>(({ client, bankAccountId, fetchClientData, customers }, ref) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewTransactionsQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'review'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
            constraints.push(where('amount', '>=', 0));
        }
        
        constraints.push(orderBy(sortField, sortDirection));
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection]);

    const {
        documents: transactions,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: reviewTransactionsQuery, pageSize: PAGE_SIZE });
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
    useEffect(() => {
        refetch();
    }, [activeSubTab, refetch]);
    
    const handleBulkAction = async (action: 'approve' | 'reject') => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        toast({ title: "Processing...", description: `Updating ${selectedTransactions.length} transactions.` });

        const batch = writeBatch(db);
        const transactionsToUpdate = transactions.filter(t => selectedTransactions.includes(t.id));
        
        for(const tx of transactionsToUpdate) {
            const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
            if (action === 'approve') {
                batch.update(transactionRef, { status: 'allocated', allocatedAt: new Date() });
                
                // Create a rule for this approved transaction if one doesn't already exist for the core keyword
                const description = tx.description.toLowerCase();
                const coreKeyword = description.split(/\s+/)[0];
                
                const ruleExists = client.allocationRules?.some(rule => rule.keywords.includes(coreKeyword));
                
                if (!ruleExists && tx.allocatedTo?.type === 'account') {
                    const newRule: Partial<AllocationRule> = {
                        description: `Auto-generated for: ${tx.description}`,
                        keywords: [coreKeyword],
                        accountId: tx.allocatedTo.value,
                        vatType: tx.vatType || 'no_vat',
                        type: 'soft', // Mark as AI-generated,
                    };
                    const clientRef = doc(db, 'aiAccountantClients', client.uid);
                    batch.update(clientRef, { allocationRules: arrayUnion(newRule) });
                }

            } else { // reject
                batch.update(transactionRef, { status: 'new', allocatedTo: null, vatType: null, allocatedAt: null });
            }
        }
        
        try {
            await batch.commit();
            toast({ title: `Transactions ${action === 'approve' ? 'Approved' : 'Rejected'}`, description: `${selectedTransactions.length} transactions have been updated.` });
            setSelectedTransactions([]);
            refetch();
            fetchClientData(); // Refetch client to get new rules
        } catch (error) {
            console.error(`Error during bulk ${action}:`, error);
            toast({ title: "Action Failed", variant: "destructive" });
        }
    }

    const getAllocationDescription = (tx: ImportedTransaction) => {
        if (!tx.allocatedTo) return 'N/A';
        if (tx.allocatedTo.type === 'customer') {
            return customers.find(c => c.id === tx.allocatedTo?.value)?.name || 'Unknown Customer';
        }
        return client?.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo?.value)?.description || 'Unknown Account';
    }


    return (
        <Card>
             <CardHeader className="p-0 border-b">
                 <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Review Expenses</TabsTrigger>
                        <TabsTrigger value="income">Review Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 flex items-center gap-2">
                     <Button onClick={() => handleBulkAction('approve')} disabled={selectedTransactions.length === 0}>
                        <CheckCircle className="mr-2 h-4 w-4" />Approve Selected
                     </Button>
                     <Button variant="destructive" onClick={() => handleBulkAction('reject')} disabled={selectedTransactions.length === 0}>
                        <RotateCcw className="mr-2 h-4 w-4" />Reject Selected
                     </Button>
                 </div>
            </CardHeader>
            <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={transactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead>Suggested Allocation</TableHead>
                                <TableHead>Suggested VAT</TableHead>
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No transactions are pending review.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell>{getAllocationDescription(tx)}</TableCell>
                                        <TableCell>{allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={!canGoPrev || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {currentPage}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={!canGoNext || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
});
ForReviewTab.displayName = 'ForReviewTab';

const ReviewedTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[]; }
>(({ client, bankAccountId, customers }, ref) => {
    
    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewedTransactionsQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        
        return query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'allocated'),
            orderBy(sortField, sortDirection)
        );
    }, [client?.uid, bankAccountId, sortField, sortDirection]);

    const {
        documents: transactions,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: reviewedTransactionsQuery, pageSize: PAGE_SIZE });
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
    const getAllocationDescription = (tx: ImportedTransaction) => {
        if (!tx.allocatedTo) return 'N/A';
        if (tx.allocatedTo.type === 'customer') {
            return customers.find(c => c.id === tx.allocatedTo?.value)?.name || 'Unknown Customer';
        }
        return client?.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo?.value)?.description || 'Unknown Account';
    }


    return (
        <Card>
            <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead>Allocated To</TableHead>
                                <TableHead>VAT Type</TableHead>
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No reviewed transactions found.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell>{getAllocationDescription(tx)}</TableCell>
                                        <TableCell>{allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={!canGoPrev || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {currentPage}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={!canGoNext || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
});
ReviewedTab.displayName = 'ReviewedTab';


export default function BankTransactionsPage() {
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'review' | 'reviewed'>('new');
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
    const newTransactionsTabRef = useRef<{ refetch: () => void }>(null);
    const forReviewTabRef = useRef<{ refetch: () => void }>(null);
    const reviewedTabRef = useRef<{ refetch: () => void }>(null);
    const [allTransactions, setAllTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    
    const fetchClientAndRelatedData = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data(), uid: clientSnap.id } as User;
                setClient(clientData);

                const cashbookAccounts = clientData.chartOfAccounts?.filter(
                    acc => acc.accountNumber.startsWith('8400-')
                ).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)) || [];

                setBankAccounts(cashbookAccounts);

                if (cashbookAccounts.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(cashbookAccounts[0].id);
                } else if (cashbookAccounts.length === 0) {
                    setSelectedAccountId(null);
                }
            } else {
                toast({ title: 'Error', description: 'Client not found.', variant: 'destructive' });
            }

            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as ClientCustomer)));

            const invoicesQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            setInvoices(invoicesSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Invoice)));

            const globalRulesQuery = query(collection(db, 'allocationRules'));
            const globalRulesSnapshot = await getDocs(globalRulesQuery);
            setGlobalRules(globalRulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule)));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [clientId, toast, selectedAccountId]);

    useEffect(() => {
        fetchClientAndRelatedData();
    }, [fetchClientAndRelatedData]);
    
    useEffect(() => {
        if (!clientId) return;
        const q = query(collection(db, "aiAccountantClients", clientId, "transactions"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setAllTransactions(transactions);
        });
        return () => unsubscribe();
    }, [clientId]);


    const unallocatedCount = useMemo(() => {
        if (!selectedAccountId) return 0;
        return allTransactions.filter(tx => tx.bankAccountId === selectedAccountId && tx.status === 'new').length;
    }, [allTransactions, selectedAccountId]);
    
    const selectedAccount = useMemo(() => {
        return bankAccounts.find(acc => acc.id === selectedAccountId);
    }, [bankAccounts, selectedAccountId]);
    
    const handleDeleteBankAccount = async () => {
        if (!client || !client.uid || !selectedAccountId) return;
        
        setIsLoading(true);
        toast({ title: "Deleting Account...", description: "Removing the bank account and all its transactions."});

        try {
            const batch = writeBatch(db);

            const updatedAccounts = client.chartOfAccounts?.filter(acc => acc.id !== selectedAccountId) || [];
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            batch.update(clientRef, { chartOfAccounts: updatedAccounts });

            const transactionsQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), where('bankAccountId', '==', selectedAccountId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();

            toast({ title: "Bank Account Deleted", description: `Account and its ${transactionsSnapshot.size} transactions have been permanently removed.`});
            
            setSelectedAccountId(null);
            fetchClientAndRelatedData();

        } catch (error) {
            console.error("Error deleting bank account:", error);
            toast({ title: "Deletion Failed", variant: 'destructive'});
            setIsLoading(false);
        }
    };
    
    const handleClearBankTransactions = async () => {
        if (!client || !client.uid || !selectedAccountId) return;

        toast({ title: "Clearing Transactions...", description: "This may take a moment."});
        
        try {
            const batch = writeBatch(db);
            const transactionsQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), where('bankAccountId', '==', selectedAccountId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            
            if (transactionsSnapshot.empty) {
                toast({ title: "No Transactions Found", description: "There are no transactions to clear for this account."});
                return;
            }

            transactionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            toast({ title: "Transactions Cleared", description: `Successfully deleted ${transactionsSnapshot.size} transaction(s).` });
            
            // Refetch all data to update UI correctly
            handleImportComplete();

        } catch(error) {
            console.error("Error clearing transactions:", error);
            toast({ title: "Error", description: "Could not clear transactions.", variant: "destructive"});
        }
    }


    const handleImportComplete = () => {
        if (newTransactionsTabRef.current) newTransactionsTabRef.current.refetch();
        if (forReviewTabRef.current) forReviewTabRef.current.refetch();
        if (reviewedTabRef.current) reviewedTabRef.current.refetch();
    }
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-card border rounded-lg">
                <div className="flex w-full items-center justify-between md:w-auto md:justify-start md:gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bank-account-selector">Bank Account</Label>
                        <div className="flex gap-2">
                            <Select
                                value={selectedAccountId || ''}
                                onValueChange={setSelectedAccountId}
                                disabled={bankAccounts.length === 0}
                            >
                                <SelectTrigger id="bank-account-selector" className="w-[200px] sm:w-[250px]">
                                    <SelectValue placeholder={bankAccounts.length > 0 ? "Select a bank account" : "No bank accounts found"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {bankAccounts.map(account => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => setIsCreateAccountOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Create New Account</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => setIsEditAccountOpen(true)} disabled={!selectedAccount}><Edit className="mr-2 h-4 w-4"/>Edit Selected Account</DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={!selectedAccount}>
                                                <Trash2 className="mr-2 h-4 w-4"/>Delete Selected Account
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the account "{selectedAccount?.description}" and ALL of its associated transactions. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteBankAccount}>Yes, Delete Everything</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={!selectedAccount}>
                                                <Ban className="mr-2 h-4 w-4" />Clear Bank Transactions
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Clear All Transactions?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete ALL transactions associated with the account "{selectedAccount?.description}". The account itself will not be deleted. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearBankTransactions}>Yes, Clear All Transactions</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                     <div className="text-center">
                        <p className="text-xs text-muted-foreground">Unallocated</p>
                        <p className="text-lg font-semibold flex items-center gap-2 justify-center">
                            {unallocatedCount > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            {unallocatedCount}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-end">
                    {client && selectedAccountId && <UploadStatementDialog client={client} bankAccountId={selectedAccountId} onImportComplete={handleImportComplete} />}
                    {client && selectedAccountId && <ImportDialog client={client} bankAccountId={selectedAccountId} onImportComplete={handleImportComplete} globalRules={globalRules} />}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New Transactions</TabsTrigger>
                    <TabsTrigger value="review">Pending Review</TabsTrigger>
                    <TabsTrigger value="reviewed">Reviewed Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-0">
                   <NewTransactionsTab 
                        ref={newTransactionsTabRef}
                        client={client} 
                        customers={customers}
                        invoices={invoices}
                        bankAccountId={selectedAccountId} 
                        fetchClientData={fetchClientAndRelatedData}
                        globalRules={globalRules}
                    />
                </TabsContent>
                 <TabsContent value="review" className="mt-0">
                   <ForReviewTab 
                        ref={forReviewTabRef}
                        client={client} 
                        bankAccountId={selectedAccountId} 
                        customers={customers}
                        fetchClientData={fetchClientAndRelatedData}
                    />
                </TabsContent>
                <TabsContent value="reviewed" className="mt-0">
                    <ReviewedTab 
                        ref={reviewedTabRef}
                        client={client} 
                        bankAccountId={selectedAccountId} 
                        customers={customers}
                    />
                </TabsContent>
            </Tabs>
            {client && <CreateAccountDialog client={client} onAccountCreated={fetchClientAndRelatedData} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}/>}
            {client && selectedAccount && <EditAccountDialog client={client} account={selectedAccount} onAccountUpdated={fetchClientAndRelatedData} open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}/>}
        </div>
    );
}



    