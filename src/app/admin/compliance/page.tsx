'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

type ComplianceRequest = {
  id: string;
  companyName: string;
  registrationNumber: string;
  yourName: string;
  yourEmail: string;
  yourPhone: string;
  submittedAt: any; // Firestore Timestamp
};

export default function AdminCompliancePage() {
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'complianceRequests'), orderBy('submittedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedRequests = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as ComplianceRequest));
        setRequests(fetchedRequests);
      } catch (error) {
        console.error("Error fetching compliance requests:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'dd MMM yyyy, HH:mm');
    }
    return format(new Date(timestamp), 'dd MMM yyyy, HH:mm');
  };

  return (
    <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Free Compliance Assessments</h1>
      <Card>
        <CardHeader>
          <CardTitle>Submitted Requests</CardTitle>
          <CardDescription>
            The following requests have been submitted through the Free Compliance Check form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">No Requests Yet</h2>
                <p className="mt-2 text-muted-foreground">There have been no submissions for a free compliance assessment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Submitted On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <p className="font-semibold">{req.companyName}</p>
                      <p className="text-xs text-muted-foreground">{req.registrationNumber}</p>
                    </TableCell>
                     <TableCell>
                      <p className="font-semibold">{req.yourName}</p>
                      <p className="text-xs text-muted-foreground">{req.yourEmail} | {req.yourPhone}</p>
                    </TableCell>
                    <TableCell>{formatDate(req.submittedAt)}</TableCell>
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
