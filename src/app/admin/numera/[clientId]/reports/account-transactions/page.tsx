
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function AccountTransactionsReportPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Account Transactions Report</CardTitle>
                <CardDescription>
                    Filter and view account transactions based on the criteria below.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Date Range</Label>
                        <DateRangePicker />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Account</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Select><SelectTrigger><SelectValue placeholder="(From Account)" /></SelectTrigger><SelectContent><SelectItem value="1">Account 1</SelectItem></SelectContent></Select>
                            <Select><SelectTrigger><SelectValue placeholder="(To Account)" /></SelectTrigger><SelectContent><SelectItem value="1">Account 1</SelectItem></SelectContent></Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Category</Label>
                        <div className="grid grid-cols-2 gap-4">
                             <Select><SelectTrigger><SelectValue placeholder="(From Category)" /></SelectTrigger><SelectContent><SelectItem value="1">Category 1</SelectItem></SelectContent></Select>
                            <Select><SelectTrigger><SelectValue placeholder="(To Category)" /></SelectTrigger><SelectContent><SelectItem value="1">Category 1</SelectItem></SelectContent></Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Transaction Type</Label>
                         <Select><SelectTrigger><SelectValue placeholder="(Select Transaction Type)" /></SelectTrigger><SelectContent><SelectItem value="1">Type 1</SelectItem></SelectContent></Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Sort By</Label>
                         <RadioGroup defaultValue="account" className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="account" id="sort-account" />
                                <Label htmlFor="sort-account" className="font-normal">Account</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="financial_category" id="sort-financial" />
                                <Label htmlFor="sort-financial" className="font-normal">Financial Category</Label>
                            </div>
                        </RadioGroup>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Status</Label>
                        <RadioGroup defaultValue="both" className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="both" id="status-both" />
                                <Label htmlFor="status-both" className="font-normal">Both (Active/Inactive)</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="active" id="status-active" />
                                <Label htmlFor="status-active" className="font-normal">Active</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="inactive" id="status-inactive" />
                                <Label htmlFor="status-inactive" className="font-normal">Inactive</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="flex justify-center pt-4">
                         <Button>View Report</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
