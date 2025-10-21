
'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";


const db = getFirestore(firebaseApp);

export default function AIAccountantClientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                const docRef = doc(db, 'aiAccountantClients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);


    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-48" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
             <div>
                 <Button variant="outline" size="sm" asChild className="mb-4">
                    <Link href="/dashboard/ai-accountant/clients">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to All Clients
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{client?.companyName || client?.name}</h1>
                <p className="text-muted-foreground">AI Accountant Module</p>
            </div>

            <Menubar className="w-full bg-card">
                 <MenubarMenu>
                    <MenubarTrigger>Quick View <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>Customers</MenubarItem>
                        <MenubarItem>Suppliers</MenubarItem>
                        <MenubarItem>Items</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Customers <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/customers`}>Customer List</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/invoices`}>Invoices</Link></MenubarItem>
                         <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/quotes`}>Quotes</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/credit-notes`}>Credit Notes</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Suppliers <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
                     <MenubarContent>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/suppliers`}>Supplier List</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu><MenubarTrigger>Items</MenubarTrigger></MenubarMenu>
                <MenubarMenu>
                     <MenubarTrigger>Banking <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
                     <MenubarContent>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/bank/transactions`}>Bank & Credit Cards</Link></MenubarItem>
                     </MenubarContent>
                </MenubarMenu>
                 <MenubarMenu>
                    <MenubarTrigger>Reports <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/reports/trial-balance`}>Trial Balance</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/reports/general-ledger`}>General Ledger</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/reports/customer-ledger`}>Customer Ledger</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/reports/age-analysis`}>Age Analysis</Link></MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem asChild><Link href={`/dashboard/ai-accountant/${clientId}/reports/account-transactions`}>Account Transactions</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>
            
            <main>
                {children}
            </main>
        </div>
    );
}
