
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { User, ChartOfAccount } from "@/lib/types";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from "lucide-react";
import { useParams } from 'next/navigation';

const db = getFirestore(firebaseApp);

export default function GeneralLedgerPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

    useEffect(() => {
        const fetchClientData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'clients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                    setClient(clientData);
                    setAccounts(clientData.chartOfAccounts || []);
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClientData();
    }, [clientId]);
    
    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>General Ledger Report</CardTitle>
                    <CardDescription>
                        Filter and view the general ledger for a specific period.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Date Range</Label>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="Monthly" /></SelectTrigger>
                                    <SelectContent><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                </Select>
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="Current Month" /></SelectTrigger>
                                    <SelectContent><SelectItem value="current_month">Current Month</SelectItem></SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground sm:col-span-2">01/10/2025 to 31/10/2025</p>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Account</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="(From Account)" /></SelectTrigger>
                                    <SelectContent>
                                        {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="(To Account)" /></SelectTrigger>
                                    <SelectContent>
                                          {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            <Button disabled>View Report</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
