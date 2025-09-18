import FirestoreTest from '@/components/FirestoreTest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { firebaseConfig } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FirestoreTestPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
        <Card>
            <CardHeader>
                <CardTitle>Firebase Configuration</CardTitle>
                <CardDescription>
                    This page displays the Firebase configuration your app is currently using.
                    Please ensure the `projectId` below matches the project where you are editing
                    your Firestore security rules in the Firebase Console.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert>
                  <AlertTitle>Current Firebase Config</AlertTitle>
                  <AlertDescription>
                    <pre className="mt-2 w-full overflow-x-auto rounded-md bg-muted p-4 text-sm">
                      {JSON.stringify(firebaseConfig, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
                <div>
                  <h3 className="font-semibold mb-2">Why am I seeing a permissions error?</h3>
                  <p className="text-sm text-muted-foreground">
                    The "Missing or insufficient permissions" error means that while the app is correctly configured to talk to your Firebase project, the Firestore security rules for project <code className="bg-muted px-1 py-0.5 rounded-sm">{firebaseConfig.projectId}</code> are blocking it. Please go to the Firebase Console, select this project, and set your Firestore rules to allow writes for testing.
                  </p>
                </div>
            </CardContent>
        </Card>
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Firestore Connection Test</CardTitle>
                <CardDescription>
                    Once you have configured your security rules in the Firebase Console, click the button below to test the connection.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FirestoreTest />
            </CardContent>
        </Card>
    </div>
  );
}
