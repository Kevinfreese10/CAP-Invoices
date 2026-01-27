
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { commissionList as fallbackData } from "@/lib/commission-list";

const db = getFirestore(firebaseApp);

export default function CommissionPage() {
    const [commissionText, setCommissionText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchCommissionData = async () => {
            setIsLoading(true);
            const docRef = doc(db, 'commissionData', 'list');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCommissionText(docSnap.data().content);
            } else {
                // Fallback to static data if not in Firestore
                setCommissionText(fallbackData);
            }
            setIsLoading(false);
        };
        fetchCommissionData();
    }, []);

    const handleSave = async () => {
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

    const commissions = useMemo(() => {
        return commissionText.split('\n').map(line => {
            const [number, ...nameParts] = line.split('\t');
            const name = nameParts.join(' ');
            return { number, name };
        }).filter(c => c.number && c.name); // Filter out empty lines
    }, [commissionText]);

    return (
        <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Edit Commission List</CardTitle>
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
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save List
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Commission List Preview</CardTitle>
                    <CardDescription>A list of all commission numbers and their corresponding story names.</CardDescription>
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
                                {commissions.map((commission, index) => (
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
