

'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, addDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Task, User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import NewTaskEmail from '@/components/emails/NewTaskEmail';

const db = getFirestore(firebaseApp);

type ComplianceRequest = {
  id: string;
  companyName: string;
  registrationNumber: string;
  sarsUsername?: string;
  sarsPassword?: string;
  yourName: string;
  yourEmail: string;
  yourPhone: string;
  submittedAt: any; // Firestore Timestamp
};

export default function AdminCompliancePage() {
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingRequest, setViewingRequest] = useState<ComplianceRequest | null>(null);
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [staffCounters, setStaffCounters] = useState<{ [key: string]: number }>({});
  
  const getNextAdminStaff = (): User | undefined => {
      const adminStaff = allStaff.filter(u => u.department === 'Administration' && u.role === 'staff');
      if (adminStaff.length === 0) return undefined;

      const currentIndex = staffCounters['Administration'] || 0;
      const nextStaff = adminStaff[currentIndex];
      
      setStaffCounters(prev => ({
          ...prev,
          ['Administration']: (currentIndex + 1) % adminStaff.length
      }));
      
      return nextStaff;
  }

  useEffect(() => {
    const fetchRequestsAndStaff = async () => {
      setIsLoading(true);
      try {
        const staffQuery = collection(db, "users");
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setAllStaff(fetchedStaff);

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
    fetchRequestsAndStaff();
  }, []);

   const createTask = async (request: ComplianceRequest) => {
    if (!user) return;

    const assignedStaff = getNextAdminStaff();
    if (!assignedStaff) {
        console.error("No staff in Administration department to assign task.");
        return;
    }
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    const taskData: Omit<Task, 'id'> = {
        title: `Follow up on Compliance Assessment for ${request.companyName}`,
        description: `A new compliance assessment request has been submitted by ${request.yourName} (${request.yourEmail}). Please review and follow up.`,
        assignedTo: [assignedStaff.uid],
        status: 'To-Do',
        priority: 'Medium',
        dueDate: Timestamp.fromDate(dueDate),
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        comments: [],
    };
    await addDoc(collection(db, 'tasks'), taskData);

    //  // Send email notification - DISABLED
    // if (assignedStaff.uid !== user.uid && assignedStaff.email) {
    //   try {
    //     const emailHtml = render(<NewTaskEmail 
    //         assigneeName={assignedStaff.name.split(' ')[0]}
    //         taskTitle={taskData.title}
    //         taskDescription={taskData.description}
    //         dueDate={format(dueDate, 'dd MMMM yyyy')}
    //         assignedBy={user.name}
    //         taskUrl={`${window.location.origin}/admin/dashboard`}
    //     />);
    //     await sendEmail({
    //         to: assignedStaff.email,
    //         subject: `New Task Assigned: ${taskData.title}`,
    //         html: emailHtml,
    //     });
    //   } catch (emailError) {
    //     console.error(`Failed to send task notification email to ${assignedStaff.email}:`, emailError);
    //   }
    // }
  };


  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'dd MMM yyyy, HH:mm');
    }
    return format(new Date(timestamp), 'dd MMM yyyy, HH:mm');
  };

  return (
    <div className="space-y-8">
        <Dialog onOpenChange={(isOpen) => !isOpen && setViewingRequest(null)}>
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
                      <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell className="text-right">
                           <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" onClick={() => setViewingRequest(req)}>
                                <Eye className="h-4 w-4" />
                             </Button>
                           </DialogTrigger>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
           <DialogContent>
                <DialogHeader>
                    <DialogTitle>Compliance Request Details</DialogTitle>
                     <DialogDescription>
                        Full submission details for {viewingRequest?.companyName}.
                    </DialogDescription>
                </DialogHeader>
                 {viewingRequest && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground">Company Details</h3>
                            <p><strong>Company Name:</strong> {viewingRequest.companyName}</p>
                            <p><strong>Registration Number:</strong> {viewingRequest.registrationNumber}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground">Contact Details</h3>
                            <p><strong>Name:</strong> {viewingRequest.yourName}</p>
                            <p><strong>Email:</strong> {viewingRequest.yourEmail}</p>
                            <p><strong>Phone:</strong> {viewingRequest.yourPhone}</p>
                        </div>
                        {(viewingRequest.sarsUsername || viewingRequest.sarsPassword) && (
                             <div>
                                <h3 className="text-sm font-semibold text-muted-foreground">SARS Details</h3>
                                 <Alert variant="destructive" className="mt-2">
                                    <AlertTitle>Confidential Information</AlertTitle>
                                    <AlertDescription>
                                        <p><strong>Username:</strong> {viewingRequest.sarsUsername || 'Not provided'}</p>
                                        <p><strong>Password:</strong> {viewingRequest.sarsPassword || 'Not provided'}</p>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        <div>
                             <h3 className="text-sm font-semibold text-muted-foreground">Submission Time</h3>
                             <p>{formatDate(viewingRequest.submittedAt)}</p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
