
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts } from "@/lib/chart-of-accounts";
import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from 'react';

export default function NumeraSettingsPage() {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) {
            return chartOfAccounts;
        }
        return chartOfAccounts.filter(account =>
            account.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.accountNumber.includes(searchTerm)
        );
    }, [searchTerm]);

    return (
        <div className="space-y-8">
             <div className="flex items-center justify-between">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight">Numera Settings</h1>
                     <p className="text-muted-foreground">Manage the master data for the Numera module.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/admin/numera">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Numera
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Master Chart of Accounts</CardTitle>
                    <CardDescription>
                        This is the default chart of accounts used for all new Numera client profiles.
                    </CardDescription>
                    <Input
                        placeholder="Search by account name or number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm mt-4"
                    />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account Number</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Section</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAccounts.map((account) => (
                                <TableRow key={account.id}>
                                    <TableCell className="font-mono">{account.accountNumber}</TableCell>
                                    <TableCell>{account.description}</TableCell>
                                    <TableCell>{account.section}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
