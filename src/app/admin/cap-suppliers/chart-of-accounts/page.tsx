
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { s38ChartOfAccounts, capChartOfAccounts } from '@/lib/cap-chart-of-accounts';

export default function CapChartOfAccountsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers Chart of Accounts</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>S38 Chart of Accounts</CardTitle>
          <CardDescription>
            This is the chart of accounts for S38.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Description</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {s38ChartOfAccounts.map((account) => (
                        <TableRow key={account.accountNumber}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell>{account.description}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CAP Chart of Accounts</CardTitle>
          <CardDescription>
            This is the general chart of accounts for CAP suppliers.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Description</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {capChartOfAccounts.map((account) => (
                        <TableRow key={account.accountNumber}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell>{account.description}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
