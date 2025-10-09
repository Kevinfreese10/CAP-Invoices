
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts } from "@/lib/chart-of-accounts";
import { allocationRules } from "@/lib/allocation-rules";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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

    const getAccountDescription = (accountId: string) => {
        const account = chartOfAccounts.find(acc => acc.id === accountId);
        return account ? `${account.accountNumber} - ${account.description}` : accountId;
    }

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

             <Card>
                <CardHeader>
                    <CardTitle>Global Allocation Rules</CardTitle>
                    <CardDescription>
                        These are the default rules applied to all Numera clients for automatic transaction allocation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Keywords</TableHead>
                                <TableHead>Allocated Account</TableHead>
                                <TableHead>VAT Type</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allocationRules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell className="font-medium">{rule.description}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {rule.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getAccountDescription(rule.accountId)}</TableCell>
                                    <TableCell>{rule.vatType}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
