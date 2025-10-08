
'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, FileText, LayoutDashboard, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const db = getFirestore(firebaseApp);

export default function NumeraClientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                const docRef = doc(db, 'clients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);

    const navItems = [
        { href: `/admin/numera/${clientId}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
        { href: `/admin/numera/${clientId}/bank`, label: 'Bank', icon: Banknote },
        { href: `/admin/numera/${clientId}/reports`, label: 'Reports', icon: FileText },
    ];
    
    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-48" />
                <div className="grid md:grid-cols-[200px_1fr] gap-8">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                 <Button variant="outline" size="sm" asChild className="mb-4">
                    <Link href="/admin/numera">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to All Clients
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">{client?.companyName || client?.name}</h1>
                <p className="text-muted-foreground">Numera Accounting Module</p>
            </div>
            <div className="grid md:grid-cols-[200px_1fr] gap-8">
                <aside>
                    <nav className="flex flex-col gap-2">
                        {navItems.map(item => (
                            <Link 
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 text-sm font-medium p-2 rounded-md hover:bg-muted",
                                    pathname === item.href ? 'bg-muted text-primary' : 'text-muted-foreground'
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </aside>
                <main>
                    {children}
                </main>
            </div>
        </div>
    );
}
