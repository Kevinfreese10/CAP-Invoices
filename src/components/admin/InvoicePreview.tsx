
'use client';

import { Invoice, ClientCustomer, User } from "@/lib/types";
import { format } from 'date-fns';
import Image from "next/image";

const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

export default function InvoicePreview({ invoice, client, customer }: { invoice: Invoice, client: User | null, customer: ClientCustomer | undefined }) {
    if (!invoice || !client || !customer) return null;
    
    const getVatAmount = (lineItem: { rate: number, quantity: number, vatType: string }) => {
        if (lineItem.vatType === 'standard_rated_sales') {
            return (lineItem.rate * lineItem.quantity) * 0.15;
        }
        return 0;
    };

    return (
        <div className="p-8 bg-white text-gray-800 max-h-[80vh] overflow-y-auto">
            <header className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                    {client.logoUrl && (
                        <div className="relative h-20 w-48 mb-4">
                            <Image src={client.logoUrl} alt={`${client.companyName} Logo`} fill className="object-contain object-left"/>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-gray-900">{client.companyName || client.name}</h1>
                    <p className="text-sm text-gray-600 max-w-xs">{client.address}</p>
                    {client.isVatRegistered && client.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {client.vatNumber}</p>}
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-extrabold uppercase text-gray-400">Tax Invoice</h2>
                    <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">#</span> {invoice.id}</p>
                </div>
            </header>

            <section className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-600">Bill To:</p>
                    <p className="text-lg font-bold text-gray-800">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.address}</p>
                    {customer.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {customer.vatNumber}</p>}
                </div>
                <div className="text-right space-y-1">
                    <div className="grid grid-cols-2 gap-x-4">
                        <span className="font-semibold text-gray-600">Date:</span>
                        <span>{format(invoice.invoiceDate, 'dd/MM/yyyy')}</span>
                        <span className="font-semibold text-gray-600">Due Date:</span>
                        <span>{format(invoice.dueDate, 'dd/MM/yyyy')}</span>
                    </div>
                </div>
            </section>

            <section className="mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
                            <th className="p-3">Description</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-right">VAT</th>
                            <th className="p-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.lineItems.map((item, index) => {
                            const vatAmount = getVatAmount(item);
                            return (
                                <tr key={index} className="border-b border-gray-200">
                                    <td className="p-3">{item.description}</td>
                                    <td className="p-3 text-center">{item.quantity}</td>
                                    <td className="p-3 text-right">{formatPrice(item.rate)}</td>
                                    <td className="p-3 text-right">{formatPrice(vatAmount)}</td>
                                    <td className="p-3 text-right font-semibold">{formatPrice(item.rate * item.quantity)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>

            <section className="flex justify-end mb-10">
                <div className="w-full max-w-sm space-y-3">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatPrice(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>VAT (15%)</span>
                        <span>{formatPrice(invoice.vat)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 border-t pt-3 mt-3">
                        <span>Total Due</span>
                        <span>{formatPrice(invoice.total)}</span>
                    </div>
                </div>
            </section>

            {invoice.notes && (
                <section className="mb-10">
                    <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 italic">{invoice.notes}</p>
                </section>
            )}

            <footer className="text-center text-sm text-gray-500 border-t pt-6">
                <p className="font-semibold">Banking Details</p>
                <p>{client.bankingDetails?.bankName} | Account: {client.bankingDetails?.accountNumber} | Branch: {client.bankingDetails?.branchCode}</p>
                <p>Thank you for your business!</p>
            </footer>
        </div>
    );
}
