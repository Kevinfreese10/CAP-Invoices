
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Trash2, ChevronsUpDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { s38ChartOfAccounts, capChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { ExtractedInvoice, Commission } from '@/lib/types';
import { format, addDays, eachDayOfInterval, endOfMonth, isFriday, getMonth, isLastDayOfMonth, addMonths, endOfYear, startOfYear, getYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';


const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  exclusiveAmount: z.preprocess((val) => Number(val), z.number()),
  vatAmount: z.preprocess((val) => Number(val), z.number()),
  accountId: z.string().optional(),
  paye: z.boolean().optional(),
  ledgerDescription: z.string().optional(),
});

const formSchema = z.object({
  supplier: z.string().min(1, "Supplier name is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  commissionNumber: z.string().optional(),
  storyName: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  lineItems: z.array(lineItemSchema),
  invoiceTotal: z.preprocess((val) => Number(val), z.number()),
  expenseType: z.enum(['CAP', 'S38', 'S39']).optional(),
  paymentBatch: z.string().optional(),
  note: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

function getUpcomingFridays(): { value: string; label: string }[] {
    const fridays = [];
    const today = new Date();
    const currentYear = getYear(today);
    
    // Determine the target year for January. If we are already past January, it's next year.
    const targetYear = getMonth(today) > 0 ? currentYear + 1 : currentYear;
    const endOfJanuaryNextYear = endOfMonth(new Date(targetYear, 0)); // January is month 0

    const days = eachDayOfInterval({
        start: today,
        end: endOfJanuaryNextYear,
    });
    
    for (const day of days) {
        const dayYear = getYear(day);
        const blackoutStart = new Date(dayYear, 11, 19); // Dec 19 of the day's year
        const blackoutEnd = new Date(dayYear + 1, 0, 16);   // Jan 16 of the next year

        if (isFriday(day)) {
             // Exclude dates within the blackout period
            if (day >= new Date(day.getFullYear(), 11, 19) && day <= new Date(day.getFullYear(), 11, 31)) {
                continue; // In December blackout
            }
             if (day >= new Date(day.getFullYear(), 0, 1) && day <= new Date(day.getFullYear(), 0, 16)) {
                continue; // In January blackout
            }

            const isMonthEndFriday = isLastDayOfMonth(day) || getMonth(addDays(day, 7)) !== getMonth(day);
            fridays.push({
                value: format(day, 'yyyy-MM-dd'),
                label: `${format(day, 'dd MMMM yyyy')}${isMonthEndFriday ? ' (Month End)' : ''}`,
            });
        }
    }

    // Ensure today is included if it's a Friday but was missed by the interval start
    if (isFriday(today) && !fridays.some(f => f.value === format(today, 'yyyy-MM-dd'))) {
        const isBlackout = (today >= new Date(today.getFullYear(), 11, 19)) || (today <= new Date(today.getFullYear(), 0, 16));
        if (!isBlackout) {
            const isMonthEndFriday = isLastDayOfMonth(today) || getMonth(addDays(today, 7)) !== getMonth(today);
            fridays.unshift({
                value: format(today, 'yyyy-MM-dd'),
                label: `${format(day, 'dd MMMM yyyy')}${isMonthEndFriday ? ' (Month End)' : ''}`,
            });
        }
    }

    return fridays;
}

interface EditInvoiceFormProps {
    invoice: ExtractedInvoice | null;
    onSave: (id: string, data: any) => void;
    onCancel: () => void;
    onSaveAndApprove?: (id: string, data: any) => void;
}

export default function EditInvoiceForm({ invoice, onSave, onCancel, onSaveAndApprove }: EditInvoiceFormProps) {
    const upcomingFridays = getUpcomingFridays();
    const [openPopover, setOpenPopover] = useState<number | null>(null);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [isCommissionsLoading, setIsCommissionsLoading] = useState(true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            supplier: invoice?.supplier || '',
            invoiceNumber: invoice?.invoiceNumber || '',
            commissionNumber: invoice?.commissionNumber || '',
            storyName: invoice?.storyName || '',
            date: invoice?.date || '',
            lineItems: invoice?.lineItems.map(item => ({ 
                ...item, 
                description: item.ledgerDescription || item.description, // Prioritize ledgerDescription
                paye: item.paye || false 
            })) || [],
            invoiceTotal: invoice?.invoiceTotal || 0,
            expenseType: invoice?.expenseType || undefined,
            paymentBatch: invoice?.paymentBatch || upcomingFridays[0]?.value,
            note: invoice?.note || '',
            isPrivate: invoice?.isPrivate || false,
        }
    });

     useEffect(() => {
        const fetchCommissions = async () => {
            setIsCommissionsLoading(true);
            try {
                const commsQuery = query(collection(db, 'commissions'), orderBy('commissionNumber', 'asc'));
                const commsSnapshot = await getDocs(commsQuery);
                const fetchedCommissions = commsSnapshot.docs.map(doc => doc.data() as Commission);
                setCommissions(fetchedCommissions);
            } catch (error) {
                console.error("Error fetching commissions:", error);
            } finally {
                setIsCommissionsLoading(false);
            }
        };
        fetchCommissions();
    }, []);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lineItems",
    });
    
    const watchedLineItems = useWatch({
        control: form.control,
        name: "lineItems",
    });

    const invoiceTotal = useWatch({
        control: form.control,
        name: "invoiceTotal"
    });
    
    const expenseType = useWatch({
        control: form.control,
        name: 'expenseType',
    });
    
    const commissionNumber = useWatch({
        control: form.control,
        name: 'commissionNumber',
    });
    
     useEffect(() => {
        if (commissionNumber && commissions.length > 0) {
            const matchingCommission = commissions.find(
                (c) => c.commissionNumber === commissionNumber
            );
            if (matchingCommission) {
                form.setValue('storyName', matchingCommission.shortName, { shouldValidate: true });
            } else {
                 form.setValue('storyName', '', { shouldValidate: true });
            }
        }
    }, [commissionNumber, commissions, form]);

    const isValidCommission = useMemo(() => {
        if (!commissionNumber) return false;
        return commissions.some(c => c.commissionNumber === commissionNumber);
    }, [commissionNumber, commissions]);

    const chartOfAccounts = expenseType === 'S38' 
        ? s38ChartOfAccounts 
        : expenseType === 'S39' 
        ? s39ChartOfAccounts 
        : capChartOfAccounts;
    
    const controlTotal = useMemo(() => {
        return (watchedLineItems || []).reduce((acc, item) => {
            const lineValue = (item.exclusiveAmount || 0) + (item.vatAmount || 0);
            return acc + lineValue;
        }, 0);
    }, [watchedLineItems]);

    const difference = useMemo(() => {
        return Number(controlTotal) - (Number(invoiceTotal) || 0);
    }, [controlTotal, invoiceTotal]);


    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (invoice) {
            // Sanitize line items to ensure no `undefined` values are sent to Firestore.
            const sanitizedLineItems = data.lineItems.map(item => ({
                description: item.description,
                exclusiveAmount: item.exclusiveAmount,
                vatAmount: item.vatAmount,
                accountId: item.accountId || null,
                paye: item.paye || false,
                ledgerDescription: item.description,
            }));

            const dataToSave = {
                ...data,
                lineItems: sanitizedLineItems,
            };
            onSave(invoice.id, dataToSave);
        }
    };
    
    const handleSaveAndApproveClick = async () => {
        const isValid = await form.trigger();
        if (isValid && invoice && onSaveAndApprove) {
            const data = form.getValues();
            const sanitizedLineItems = data.lineItems.map(item => ({
                description: item.description,
                exclusiveAmount: item.exclusiveAmount,
                vatAmount: item.vatAmount,
                accountId: item.accountId || null,
                paye: item.paye || false,
                ledgerDescription: item.description,
            }));

            const dataToSave = {
                ...data,
                lineItems: sanitizedLineItems,
            };
            onSaveAndApprove(invoice.id, dataToSave);
        }
    };


    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                 <div className="grid grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="expenseType"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Expense Type</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex items-center space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="CAP" /></FormControl>
                                    <FormLabel className="font-normal">CAP</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="S38" /></FormControl>
                                    <FormLabel className="font-normal">S38</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="S39" /></FormControl>
                                    <FormLabel className="font-normal">S39</FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                     <FormField
                        control={form.control}
                        name="paymentBatch"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Payment Batch</FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a payment date" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {upcomingFridays.map(friday => (
                                            <SelectItem key={friday.value} value={friday.value}>
                                                {friday.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                 </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="supplier" render={({ field }) => ( <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="commissionNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Commission Number</FormLabel>
                            <div className="relative">
                                <FormControl><Input {...field} /></FormControl>
                                {commissionNumber && (
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        {isCommissionsLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        ) : isValidCommission ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                    </div>
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="storyName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Story Name</FormLabel>
                            <FormControl><Input {...field} readOnly className="bg-muted" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                 <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Note</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Add an internal note for this invoice..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>Private & Confidential</FormLabel>
                                <FormDescription>
                                    Private invoices bypass the standard payment batches and are only visible to supervisors.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <h4 className="font-medium">Line Items</h4>
                <div className="space-y-2">
                    {fields.map((field, index) => {
                         const lineItem = watchedLineItems?.[index];
                         const exclusive = lineItem?.exclusiveAmount || 0;
                         const vat = lineItem?.vatAmount || 0;
                         const inclusive = exclusive + vat;
                        return (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border p-2 rounded-md">
                            <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="md:col-span-12"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`lineItems.${index}.accountId`} render={({ field }) => (
                                <FormItem className="flex flex-col md:col-span-4">
                                    <FormLabel className={index > 0 ? "hidden": ""}>Account</FormLabel>
                                    <Popover open={openPopover === index} onOpenChange={(isOpen) => setOpenPopover(isOpen ? index : null)}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} >
                                                    {field.value ? chartOfAccounts.find(acc => acc.accountNumber === field.value)?.description : "Select account"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search account..." />
                                                <CommandList>
                                                    <CommandEmpty>No account found.</CommandEmpty>
                                                    {chartOfAccounts.map((account) => (
                                                        <CommandItem value={account.description} key={account.accountNumber} onSelect={() => { form.setValue(`lineItems.${index}.accountId`, account.accountNumber); setOpenPopover(null);}}>
                                                            {account.description}
                                                        </CommandItem>
                                                    ))}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`lineItems.${index}.paye`} render={({ field }) => (
                                <FormItem className="md:col-span-2 flex flex-col items-center justify-end h-full pb-2">
                                    <div className="flex items-center space-x-2">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="text-xs font-normal">Deduct PAYE?</FormLabel>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="md:col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                    )})}
                </div>
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', exclusiveAmount: 0, vatAmount: 0, paye: false })}>Add Line</Button>
                
                <div className="grid grid-cols-3 gap-4 pt-4">
                    <FormItem>
                        <FormLabel>Control Total</FormLabel>
                        <Input type="number" value={Number(controlTotal).toFixed(2)} readOnly className="bg-muted font-semibold" />
                    </FormItem>
                    <FormField
                        control={form.control}
                        name="invoiceTotal"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Invoice Total</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormItem>
                        <FormLabel>Difference</FormLabel>
                        <Input 
                            type="number" 
                            value={difference.toFixed(2)} 
                            readOnly 
                            className={cn("font-bold", difference !== 0 ? 'text-destructive bg-destructive/10' : 'text-green-600 bg-green-50')}
                        />
                    </FormItem>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                    {onSaveAndApprove && (
                        <Button type="button" onClick={handleSaveAndApproveClick}>
                            Save and Approve
                        </Button>
                    )}
                </DialogFooter>
            </form>
        </Form>
    );
}
