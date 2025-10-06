
'use client';
import { useFieldArray, Control, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash } from 'lucide-react';

const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().max(60, "Title must be 60 characters or less."),
  description: z.string().max(160, "Description must be 160 characters or less."),
  keywords: z.array(z.object({ value: z.string() })).optional(),
});

const formSchema = z.object({
  pages: z.array(seoSchema),
});

type SeoFormValues = z.infer<typeof formSchema>;
type PageSeo = z.infer<typeof seoSchema>;

interface SeoPageFormProps {
    control: Control<SeoFormValues>;
    index: number;
    page: PageSeo;
    form: UseFormReturn<SeoFormValues>;
}


export default function SeoPageForm({ control, index, page, form }: SeoPageFormProps) {
    const { fields: keywordFields, append: appendKeyword, remove: removeKeyword } = useFieldArray({
        control,
        name: `pages.${index}.keywords`,
    });

    const titleLength = form.watch(`pages.${index}.title`)?.length || 0;
    const descLength = form.watch(`pages.${index}.description`)?.length || 0;

    return (
        <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">{page.path}</h3>
            <FormField
                control={control}
                name={`pages.${index}.title`}
                render={({ field }) => (
                <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>Meta Title</FormLabel>
                        <span className={`text-xs ${titleLength > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>{titleLength}/60</span>
                    </div>
                    <FormControl>
                        <Input {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`pages.${index}.description`}
                render={({ field }) => (
                <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>Meta Description</FormLabel>
                        <span className={`text-xs ${descLength > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>{descLength}/160</span>
                    </div>
                    <FormControl>
                        <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div>
                <FormLabel>Meta Keywords</FormLabel>
                <div className="space-y-2 mt-2">
                    {keywordFields.map((kwField, kwIndex) => (
                    <FormField
                        key={kwField.id}
                        control={control}
                        name={`pages.${index}.keywords.${kwIndex}.value`}
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                                <FormControl><Input {...field} /></FormControl>
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeKeyword(kwIndex)}><Trash className="h-4 w-4"/></Button>
                            </FormItem>
                        )}
                    />
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendKeyword({ value: '' })}>Add Keyword</Button>
            </div>
        </div>
    );
}
