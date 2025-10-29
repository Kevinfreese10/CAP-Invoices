
'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  exclusiveAmount: z.preprocess((val) => Number(val), z.number()),
  vatAmount: z.preprocess((val) => Number(val), z.number()),
});

const formSchema = z.object({
  supplier: z.string().min(1, "Supplier name is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  lineItems: z.array(lineItemSchema),
  invoiceTotal: z.preprocess((val) => Number(val), z.number()),
  file: z.any().refine((files) => files?.length === 1, 'File is required.'),
});

export default function ManualInvoiceForm({ onSave, onCancel }: { onSave: (data: any, file: File) => void, onCancel: () => void }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        supplier: '',
        invoiceNumber: '',
        date: '',
        lineItems: [{ description: '', exclusiveAmount: 0, vatAmount: 0 }],
        invoiceTotal: 0,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const { file, ...invoiceData } = data;
    onSave(invoiceData, file[0]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="supplier" render={({ field }) => ( <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
        <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date (YYYY-MM-DD)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />

        <h4 className="font-medium">Line Items</h4>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-2 rounded-md">
                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="col-span-5"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                <div className="col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', exclusiveAmount: 0, vatAmount: 0 })}>Add Line</Button>
        
        <FormField control={form.control} name="invoiceTotal" render={({ field }) => (<FormItem><FormLabel>Invoice Total</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="file" render={({ field }) => (<FormItem><FormLabel>Invoice File</FormLabel><FormControl><Input type="file" accept="application/pdf" onChange={e => field.onChange(e.target.files)} /></FormControl><FormMessage /></FormItem> )} />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Invoice</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
