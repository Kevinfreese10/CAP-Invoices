
'use client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Send } from 'lucide-react';

const tools = [
  {
    title: 'PDF to CSV Converter',
    description: 'Extract transactions from a PDF bank statement into a CSV file.',
    href: '/admin/tools/pdf-to-csv',
    icon: FileSpreadsheet,
  },
  {
    title: 'PayFast Simulator',
    description: 'Send a test payment notification to an order.',
    href: '/admin/tools/payfast-simulator',
    icon: Send,
  },
];

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Developer Tools</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link href={tool.href} key={tool.title}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <tool.icon className="h-8 w-8 text-primary" />
                <CardTitle>{tool.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
