
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, StoragePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const firestoreHandler = (error: FirestorePermissionError) => {
      toast({
        variant: 'destructive',
        duration: 20000,
        title: 'Firestore Permission Error',
        description: (
          <div className="space-y-2">
            <p>Your request was denied by security rules.</p>
            <Alert variant="destructive">
              <AlertTitle>Error Details:</AlertTitle>
              <AlertDescription className="font-mono text-xs">
                <p>Operation: {error.context.operation}</p>
                <p>Path: {error.context.path}</p>
                {error.context.requestResourceData && (
                  <p>Data: {JSON.stringify(error.context.requestResourceData, null, 2)}</p>
                )}
              </AlertDescription>
            </Alert>
          </div>
        ),
      });
    };
    
    const storageHandler = (error: StoragePermissionError) => {
      toast({
        variant: 'destructive',
        duration: 20000,
        title: 'Storage Permission Error',
        description: (
          <div className="space-y-2">
            <p>Your request was denied by storage security rules.</p>
            <Alert variant="destructive">
              <AlertTitle>Error Details:</AlertTitle>
              <AlertDescription className="font-mono text-xs">
                <p>Operation: {error.context.operation}</p>
                <p>Path: {error.context.path}</p>
              </AlertDescription>
            </Alert>
          </div>
        ),
      });
    };

    errorEmitter.on('permission-error', firestoreHandler);
    errorEmitter.on('storage-permission-error', storageHandler);

    return () => {
      errorEmitter.off('permission-error', firestoreHandler);
      errorEmitter.off('storage-permission-error', storageHandler);
    };
  }, [toast]);

  return null;
}
