'use client';

import { useState } from 'react';
import { getFirestore, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

// Initialize Firestore
const db = getFirestore(firebaseApp);

export default function FirestoreTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    const testDocRef = doc(db, 'test-collection', 'test-doc');

    try {
      // 1. Write a document
      const testData = {
        message: 'Hello from Firebase!',
        timestamp: Timestamp.now(),
      };
      await setDoc(testDocRef, testData);
      setResult('Step 1: Successfully wrote a document to Firestore at /test-collection/test-doc.');

      // 2. Read the document back
      const docSnap = await getDoc(testDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setResult(
          (prev) =>
            prev +
            `\nStep 2: Successfully read the document back. Message: "${data.message}"`
        );
      } else {
        throw new Error('Document was written but could not be read back.');
      }
    } catch (e: any) {
      console.error(e);
      setError(`An error occurred: ${e.message}. Check the console for details and ensure your Firestore security rules are set up correctly in the Firebase Console.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleTest} disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Testing...' : 'Run Firestore Test'}
      </Button>

      {result && (
        <Alert variant="default">
          <AlertTitle>Test Successful</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{result}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Test Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
