
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { commissionList } from "@/lib/commission-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";

export default function CommissionPage() {
    const commissions = useMemo(() => {
        return commissionList.split('\n').map(line => {
            const [number, ...nameParts] = line.split('\t');
            const name = nameParts.join(' ');
            return { number, name };
        });
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Commission List</CardTitle>
                <CardDescription>A list of all commission numbers and their corresponding story names.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Commission Number</TableHead>
                            <TableHead>Story Name</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {commissions.map((commission, index) => (
                            <TableRow key={index}>
                                <TableCell>{commission.number}</TableCell>
                                <TableCell>{commission.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
