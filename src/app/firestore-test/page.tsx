import FirestoreTest from '@/components/FirestoreTest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function FirestoreTestPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
        <Card>
            <CardHeader>
                <CardTitle>Firestore Connection Test</CardTitle>
                <CardDescription>
                    Use this page to verify that your application is correctly connected to your Firestore database.
                    Click the button to write a test document and then read it back.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FirestoreTest />
            </CardContent>
        </Card>
    </div>
  );
}
