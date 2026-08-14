import { getFirestore, collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = getFirestore(firebaseApp);
        const q = query(collection(db, 'debugLogs'), orderBy('timestamp', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        
        const logs: any[] = [];
        snapshot.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });
        
        return NextResponse.json({ logs });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
