
'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, DocumentUpload } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload, ClipboardCheck, MessageSquare, Send, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { notifyStaffOfDocumentUpload } from '@/app/actions';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const noteFormSchema = z.object({
  noteText: z.string().min(3, "Note must be at least 3 characters."),
});

export default function ClientOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const id = params.orderId as string;
  const { user: currentUser } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});
  const [textInputs, setTextInputs] = useState<{ [key: string]: string }>({});


   const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const fetchOrderAndServices = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const servicesQuery = query(collection(db, 'services'));
        const servicesSnapshot = await getDocs(servicesQuery);
        const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setAllServices(fetchedServices);

        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
            documentUploads: (data.documentUploads || []).map((doc: any) => ({...doc, uploadedAt: doc.uploadedAt.toDate()})),
          } as Order);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching order details: ", error);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchOrderAndServices();
  }, [id]);
  
  const handleFileUpload = (file: File, serviceId: string, requirementLabel: string) => {
    if (!currentUser || !order) return;
    
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `orders/${order.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    const uploadKey = `${serviceId}-${requirementLabel}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: 0 }));

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadingFiles(prev => ({ ...prev, [uploadKey]: progress }));
        },
        (error) => {
            console.error("Upload failed:", error);
            toast({ title: 'Upload Failed', description: 'Could not upload your file.', variant: 'destructive'});
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                delete newUploading[uploadKey];
                return newUploading;
            });
        },
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newUpload: DocumentUpload = {
                serviceId,
                requirementLabel,
                type: 'file',
                fileUrl: downloadURL,
                fileName: file.name,
                uploadedAt: Timestamp.now(),
                status: 'pending',
            };
            
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
                documentUploads: arrayUnion(newUpload)
            });

            toast({ title: 'File Uploaded', description: `${file.name} has been submitted for review.`});
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                delete newUploading[uploadKey];
                return newUploading;
            });
            fetchOrderAndServices(); // Re-fetch to update UI
        }
    );
  };
  
    const handleTextChange = (requirementLabel: string, value: string) => {
        setTextInputs(prev => ({ ...prev, [requirementLabel]: value }));
    };

    const handleTextSubmit = async (serviceId: string, requirementLabel: string) => {
        const text = textInputs[requirementLabel];
        if (!currentUser || !order || !text || !text.trim()) {
             toast({ title: "Cannot Submit", description: "The field cannot be empty.", variant: "destructive" });
             return;
        }

        const newUpload: DocumentUpload = {
            serviceId,
            requirementLabel,
            type: 'text',
            textValue: text,
            uploadedAt: Timestamp.now(),
            status: 'pending',
        };

        try {
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
                documentUploads: arrayUnion(newUpload)
            });
            toast({ title: 'Information Submitted', description: 'Your information has been securely saved.' });
            fetchOrderAndServices(); // Re-fetch to update UI
        } catch (error) {
            console.error("Error submitting text:", error);
            toast({ title: "Submission Failed", description: "Could not save the information.", variant: "destructive" });
        }
    };


  const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    const newNote: OrderNote = {
      text: values.noteText,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'note',
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        notes: arrayUnion(newNote),
      });

      toast({ title: "Note Added", description: "Your note has been saved." });
      noteForm.reset();
      await fetchOrderAndServices(); // Re-fetch to display the new note
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

  const handleDocumentSubmit = async () => {
    if (!currentUser || !order || !order.assignedTo || order.assignedTo.length === 0) {
      toast({ title: "Cannot Submit", description: "This order is not yet assigned to a consultant.", variant: "destructive" });
      return;
    }
    
    const assignedStaff = allStaff.find(s => s.id === order.assignedTo![0]);
    if (!assignedStaff || !assignedStaff.email) {
      toast({ title: "Cannot Submit", description: "The assigned consultant could not be found or does not have an email address.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    toast({ title: "Submitting...", description: "Notifying your consultant." });

    const noteText = "Client has submitted their documents for review.";
    const newNote: OrderNote = {
      text: noteText,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'note',
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { notes: arrayUnion(newNote) });
      
      await notifyStaffOfDocumentUpload({
          orderId: order.id,
          clientName: currentUser.name,
          assignedStaffName: assignedStaff.name,
          assignedStaffEmail: assignedStaff.email,
      });

      toast({ title: "Documents Submitted!", description: "Your consultant has been notified." });
      fetchOrderAndServices();
    } catch(error) {
      console.error("Error submitting documents:", error);
      toast({ title: "Submission Failed", description: "Could not notify the consultant.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Processing':
        return 'info';
      case 'Pending Payment':
        return 'warning';
      case 'Cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getAuthor = (authorId: string): User | undefined => {
    if (currentUser?.uid === authorId) return currentUser;
    return allStaff.find(u => u.uid === authorId);
  }
  
  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!order) {
    return notFound();
  }

   const orderedItemsWithServices = order.items.map(item => {
        const serviceDetails = allServices.find(s => s.id === item.id);
        return { ...item, service: serviceDetails };
    });

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id}</CardTitle>
                        <CardDescription>
                        Date: {format(new Date(order.date), 'dd MMMM yyyy')} | Status: <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {orderedItemsWithServices.map((item, index) => (
                            <div key={item.id}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-lg">{item.title}</p>
                                    </div>
                                    <p className="font-semibold text-lg">{formatPrice(item.price)}</p>
                                </div>
                                {item.service && item.service.informationToProvide && item.service.informationToProvide.length > 0 && (
                                    <div className="mt-4 pl-4 ml-4 border-l-2 space-y-4">
                                        <h4 className="font-medium text-md">Documents Required:</h4>
                                        {item.service.informationToProvide.map((info, infoIndex) => {
                                            const upload = order.documentUploads?.find(d => d.serviceId === item.service?.id && d.requirementLabel === info.label);
                                            const uploadKey = `${item.service?.id}-${info.label}`;
                                            const isUploading = uploadingFiles[uploadKey] !== undefined;
                                            
                                            return (
                                            <div key={infoIndex} className="space-y-2 p-3 rounded-md border">
                                                <div className="flex justify-between items-center">
                                                  <label className="text-sm font-medium flex items-center gap-2">
                                                      <ClipboardCheck className="h-4 w-4" />
                                                      {info.label}
                                                  </label>
                                                  {upload && (
                                                    <Badge variant={upload.status === 'approved' ? 'success' : upload.status === 'rejected' ? 'destructive' : 'warning'}>
                                                      {upload.status === 'approved' && <CheckCircle className="mr-1 h-3 w-3" />}
                                                      {upload.status === 'rejected' && <AlertTriangle className="mr-1 h-3 w-3" />}
                                                      {upload.status.charAt(0).toUpperCase() + upload.status.slice(1).replace('_', ' ')}
                                                    </Badge>
                                                  )}
                                                </div>

                                                {upload?.status === 'rejected' && (
                                                  <>
                                                    {upload.rejectionReason && <p className="text-xs text-destructive mt-1 italic">Reason: {upload.rejectionReason}</p>}
                                                    <div className="flex items-center gap-2 pt-2">
                                                        {info.type === 'pdf' ? (
                                                          <Input type="file" accept="application/pdf" className="h-9" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], item.service!.id, info.label)} />
                                                        ) : (
                                                          <div className="flex items-center gap-2 flex-grow">
                                                              <Input 
                                                                  type="text" 
                                                                  className="h-9" 
                                                                  placeholder="Enter new information..."
                                                                  value={textInputs[info.label] || ''}
                                                                  onChange={(e) => handleTextChange(info.label, e.target.value)}
                                                              />
                                                              <Button size="sm" onClick={() => handleTextSubmit(item.service!.id, info.label)}>Save</Button>
                                                          </div>
                                                        )}
                                                    </div>
                                                  </>
                                                )}
                                                
                                                {(!upload || upload.status === 'pending') && !isUploading && upload?.status !== 'rejected' && (
                                                   info.type === 'pdf' ? (
                                                      <Input type="file" accept="application/pdf" className="h-9" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], item.service!.id, info.label)} />
                                                    ) : (
                                                      <div className="flex items-center gap-2">
                                                          <Input 
                                                              type="text" 
                                                              className="h-9" 
                                                              placeholder="Enter information here..."
                                                              value={textInputs[info.label] || ''}
                                                              onChange={(e) => handleTextChange(info.label, e.target.value)}
                                                          />
                                                          <Button size="sm" onClick={() => handleTextSubmit(item.service!.id, info.label)}>Save</Button>
                                                      </div>
                                                    )
                                                )}

                                                {upload && upload.status !== 'rejected' && (
                                                   <div className="p-2 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm">
                                                      {upload.type === 'file' ? `Submitted: ${upload.fileName}` : `Submitted: "${upload.textValue}"`}
                                                   </div>
                                                )}

                                                {isUploading && (
                                                    <div className="flex items-center gap-2">
                                                      <Loader2 className="h-4 w-4 animate-spin"/>
                                                      <p className="text-sm">Uploading... {Math.round(uploadingFiles[uploadKey])}%</p>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                    </div>
                                )}
                                {index < orderedItemsWithServices.length - 1 && <Separator className="my-6" />}
                            </div>
                        ))}
                         <Separator className="my-4" />
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total</span>
                            <span>{formatPrice(order.total)}</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleDocumentSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Notify Consultant of All Submissions
                        </Button>
                    </CardFooter>
                </Card>

            </div>
             <div className="lg:col-span-1 space-y-6 sticky top-24">
                  <Card>
                    <CardHeader>
                        <CardTitle>Communication History</CardTitle>
                        <CardDescription>Internal notes and sent emails for this order.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const isEmail = note.type === 'email';
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="p-3 rounded-lg w-full bg-muted">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-xs font-semibold">{author?.name || 'System'}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd/MM/yyyy, HH:mm')}</p>
                                                </div>
                                                 {isEmail ? (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm font-semibold">{note.subject}</p>
                                                        </div>
                                                        <p className="text-sm italic text-muted-foreground">"{note.text}"</p>
                                                    </div>
                                                 ) : (
                                                    <p className="text-sm">{note.text}</p>
                                                 )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p>
                            )}
                        </div>
                         <Form {...noteForm}>
                          <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="flex items-start gap-2 pt-4">
                            <FormField
                              control={noteForm.control}
                              name="noteText"
                              render={({ field }) => (
                                <FormItem className="flex-grow">
                                  <FormControl>
                                    <Textarea placeholder="Add a new note..." {...field} rows={2} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" size="icon" className="flex-shrink-0 mt-1">
                              <Send className="h-4 w-4" />
                            </Button>
                          </form>
                        </Form>
                    </CardContent>
                </Card>
             </div>
        </div>
    </div>
  );
}
