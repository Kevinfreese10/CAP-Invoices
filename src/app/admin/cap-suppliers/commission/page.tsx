
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle } from "lucide-react";
import { commissionList as fallbackData } from "@/lib/commission-list";
import { Commission } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

const db = getFirestore(firebaseApp);

const commissionFormSchema = z.object({
    commissionNumber: z.string().min(1, 'Commission number is required.'),
    shortName: z.string().min(1, 'Short name is required.'),
    storyName: z.string().min(1, 'Story name is required.'),
    commissionedDuration: z.preprocess((val) => Number(val), z.number().min(1, 'Duration must be at least 1 minute.')),
    producer: z.string().min(1, 'Producer name is required.'),
});


function AddCommissionDialog({ onCommissionAdded }: { onCommissionAdded: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const form = useForm<z.infer<typeof commissionFormSchema>>({
        resolver: zodResolver(commissionFormSchema),
        defaultValues: {
            commissionNumber: '',
            shortName: '',
            storyName: '',
            commissionedDuration: 0,
            producer: '',
        }
    });

    const handleSave = async (values: z.infer<typeof commissionFormSchema>) => {
        setIsSaving(true);
        try {
            const commissionId = values.commissionNumber.trim();
            const docRef = doc(db, 'commissions', commissionId);
            
            const newCommission = {
                ...values,
                id: commissionId,
                createdAt: serverTimestamp(),
            };

            await setDoc(docRef, newCommission);

            toast({ title: 'Commission Added', description: `Commission ${commissionId} has been saved.` });
            onCommissionAdded();
            setIsOpen(false);
            form.reset();
        } catch (error) {
            console.error("Error saving commission:", error);
            toast({ title: 'Error', description: 'Could not save the new commission.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Commission
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add New Commission</DialogTitle>
                    <DialogDescription>Fill in the details for the new commission.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="commissionNumber" render={({ field }) => ( <FormItem><FormLabel>Commission Number (COMM)</FormLabel><FormControl><Input placeholder="e.g. 6757" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                             <FormField control={form.control} name="shortName" render={({ field }) => ( <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input placeholder="e.g. Pick Pocket" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField control={form.control} name="storyName" render={({ field }) => ( <FormItem><FormLabel>Story Name</FormLabel><FormControl><Input placeholder="Full story name" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="commissionedDuration" render={({ field }) => ( <FormItem><FormLabel>Commissioned Duration (minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="producer" render={({ field }) => ( <FormItem><FormLabel>Producer</FormLabel><FormControl><Input placeholder="Producer's name" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Commission
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}


export default function CommissionPage() {
    const [commissionText, setCommissionText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [isCommissionsLoading, setIsCommissionsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchCommissionData = async () => {
            setIsLoading(true);
            const docRef = doc(db, 'commissionData', 'list');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCommissionText(docSnap.data().content);
            } else {
                setCommissionText(fallbackData);
            }
            setIsLoading(false);
        };
        fetchCommissionData();
        
        const q = query(collection(db, 'commissions'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedCommissions = querySnapshot.docs.map(doc => doc.data() as Commission);
            setCommissions(fetchedCommissions);
            setIsCommissionsLoading(false);
        });
        
        return () => unsubscribe();

    }, []);

    const handleSaveText = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'commissionData', 'list');
            await setDoc(docRef, { content: commissionText });
            toast({
                title: 'Commission List Saved',
                description: 'The commission list has been updated successfully.',
            });
        } catch (error) {
            console.error("Error saving commission list:", error);
            toast({
                title: 'Error',
                description: 'Could not save the commission list.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const commissionListFromText = useMemo(() => {
        return commissionText.split('\n').map(line => {
            const [number, ...nameParts] = line.split('\t');
            const name = nameParts.join(' ');
            return { number, name };
        }).filter(c => c.number && c.name);
    }, [commissionText]);

    return (
        <div className="grid gap-8">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Commissions</CardTitle>
                        <CardDescription>A structured list of all commissions.</CardDescription>
                    </div>
                    <AddCommissionDialog onCommissionAdded={() => {}} />
                </CardHeader>
                <CardContent>
                     {isCommissionsLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Comm #</TableHead>
                                    <TableHead>Short Name</TableHead>
                                    <TableHead>Story Name</TableHead>
                                    <TableHead>Duration (mins)</TableHead>
                                    <TableHead>Producer</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {commissions.map((commission) => (
                                    <TableRow key={commission.id}>
                                        <TableCell className="font-mono">{commission.commissionNumber}</TableCell>
                                        <TableCell>{commission.shortName}</TableCell>
                                        <TableCell>{commission.storyName}</TableCell>
                                        <TableCell>{commission.commissionedDuration}</TableCell>
                                        <TableCell>{commission.producer}</TableCell>
                                        <TableCell>{commission.createdAt ? format(commission.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Edit Commission List (Legacy)</CardTitle>
                    <CardDescription>Copy the data from your Excel sheet (two columns: Commission Number and Story Name) and paste it below. The list will update automatically.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={commissionText}
                        onChange={(e) => setCommissionText(e.target.value)}
                        rows={15}
                        placeholder="Paste your two-column data here (e.g., CM-123\tMy Story Name)"
                        disabled={isLoading}
                    />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveText} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save List
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Commission List Preview (Legacy)</CardTitle>
                    <CardDescription>A list of all commission numbers and their corresponding story names from the text list.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Commission Number</TableHead>
                                    <TableHead>Story Name</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {commissionListFromText.map((commission, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{commission.number}</TableCell>
                                        <TableCell>{commission.name}</TableCell>
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
