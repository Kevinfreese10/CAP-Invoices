
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet } from 'lucide-react';

export default function NumeraPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
       <Card>
        <CardHeader>
          <CardTitle>Welcome to Numera</CardTitle>
          <CardDescription>
            This is the start of your powerful new accounting reporting system.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-lg">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Under Construction</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Exciting new features for Numera are coming soon. We can build out reporting, dashboards, and more right here.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
