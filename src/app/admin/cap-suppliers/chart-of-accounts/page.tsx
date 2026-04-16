
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { s38ChartOfAccounts, capChartOfAccounts, s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts';

export default function CapChartOfAccountsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredS38Accounts = useMemo(() => {
    if (!searchTerm) return s38ChartOfAccounts;
    return s38ChartOfAccounts.filter(
      (account) =>
        account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const filteredS39Accounts = useMemo(() => {
    if (!searchTerm) return s39ChartOfAccounts;
    return s39ChartOfAccounts.filter(
      (account) =>
        account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const filteredCapAccounts = useMemo(() => {
    if (!searchTerm) return capChartOfAccounts;
    return capChartOfAccounts.filter(
      (account) =>
        account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers Chart of Accounts</h1>
        <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
        />
      </div>
      
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
                    {filteredS38Accounts.map((account) => (
                        <TableRow key={account.accountNumber}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell>{account.description}</TableCell>
                        </TableRow>
                    ))}
                     {filteredS38Accounts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No accounts found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>S39 Chart of Accounts</CardTitle>
          <CardDescription>
            This is the chart of accounts for S39.
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
                    {filteredS39Accounts.map((account) => (
                        <TableRow key={account.accountNumber}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell>{account.description}</TableCell>
                        </TableRow>
                    ))}
                     {filteredS39Accounts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No accounts found.
                            </TableCell>
                        </TableRow>
                    )}
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
                    {filteredCapAccounts.map((account) => (
                        <TableRow key={account.accountNumber}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell>{account.description}</TableCell>
                        </TableRow>
                    ))}
                     {filteredCapAccounts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No accounts found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
