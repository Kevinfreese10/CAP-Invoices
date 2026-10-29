'use client';

import React, { useState } from 'react';
import { Copy, Check, Pencil, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { INVESTEC_BENEFICIARIES, normalizeSupplierKey } from '@/lib/bank-beneficiaries';
import { useBankBeneficiaries } from '@/lib/use-bank-beneficiaries';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

interface BankBeneficiaryCellProps {
  supplierName: string;
  className?: string;
}

export function BankBeneficiaryCell({
  supplierName,
  className
}: BankBeneficiaryCellProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { getBeneficiary } = useBankBeneficiaries();

  const beneficiaryName = getBeneficiary(supplierName);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!beneficiaryName) return;

    try {
      await navigator.clipboard.writeText(beneficiaryName);
      setCopied(true);
      toast({
        title: 'Copied to Clipboard',
        description: `"${beneficiaryName}" copied for Investec Online.`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      const textarea = document.createElement('textarea');
      textarea.value = beneficiaryName;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomValue(beneficiaryName || supplierName);
    setSearchFilter('');
    setIsEditing(true);
  };

  const handleSaveBeneficiary = async (selectedName: string) => {
    const finalName = selectedName.trim();
    if (!finalName) return;

    setIsSaving(true);
    try {
      const docKey = normalizeSupplierKey(supplierName) || supplierName.trim();
      const docRef = doc(db, 'bankBeneficiaries', docKey);
      await setDoc(docRef, {
        supplierName: supplierName.trim(),
        beneficiaryName: finalName,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: 'Bank Beneficiary Saved',
        description: `Linked "${supplierName}" to "${finalName}".`,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving bank beneficiary:', error);
      toast({
        title: 'Error',
        description: 'Could not save beneficiary mapping to Firestore.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInvestecList = INVESTEC_BENEFICIARIES.filter((b) =>
    b.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <div className={cn("flex items-center gap-1.5 group/ben min-w-[170px]", className)}>
      {beneficiaryName ? (
        <>
          <div className="flex items-center gap-1.5 min-w-0 max-w-[240px]">
            <span
              className="font-mono text-xs font-medium text-foreground/90 truncate cursor-pointer hover:underline"
              title={`Click to copy: ${beneficiaryName}`}
              onClick={handleCopy}
            >
              {beneficiaryName}
            </span>
          </div>

          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 p-0 shrink-0 transition-colors",
                    copied
                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  onClick={handleCopy}
                  aria-label="Copy beneficiary name"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in-75 duration-200" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {copied ? "Copied!" : "1-Click Copy for Investec"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 shrink-0 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover/ben:opacity-100 transition-opacity"
                  onClick={handleOpenEdit}
                  aria-label="Edit bank beneficiary"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Edit Beneficiary Name
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground italic">Unmapped</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1 border border-dashed border-border"
            onClick={handleOpenEdit}
          >
            <Plus className="h-3 w-3" />
            Link
          </Button>
        </div>
      )}

      {/* Edit / Map Modal */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Map Bank Beneficiary</DialogTitle>
            <DialogDescription>
              Link supplier <strong className="text-foreground">{supplierName}</strong> to an Investec bank beneficiary name for 1-click copying.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Custom or Selected Beneficiary Name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Enter exact bank beneficiary name..."
                  className="text-sm font-mono h-9"
                />
                <Button
                  size="sm"
                  disabled={!customValue.trim() || isSaving}
                  onClick={() => handleSaveBeneficiary(customValue)}
                  className="shrink-0 h-9"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0 border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select from Investec Paid Beneficiaries ({INVESTEC_BENEFICIARIES.length})
                </label>
              </div>
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search Investec beneficiary list..."
                className="text-xs h-8"
              />

              <div className="flex-1 overflow-y-auto border rounded-md divide-y max-h-[220px]">
                {filteredInvestecList.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No matching Investec beneficiaries.</p>
                ) : (
                  filteredInvestecList.map((bName) => (
                    <div
                      key={bName}
                      className={cn(
                        "p-2 text-xs font-mono cursor-pointer hover:bg-accent transition-colors flex items-center justify-between",
                        customValue === bName && "bg-primary/10 font-bold text-primary"
                      )}
                      onClick={() => setCustomValue(bName)}
                    >
                      <span>{bName}</span>
                      {customValue === bName && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!customValue.trim() || isSaving}
              onClick={() => handleSaveBeneficiary(customValue)}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Beneficiary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
