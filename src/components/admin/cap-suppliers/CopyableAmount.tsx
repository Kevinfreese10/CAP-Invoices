'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopyableAmountProps {
  amount: number;
  formattedAmount?: string;
  className?: string;
}

export function CopyableAmount({
  amount,
  formattedAmount,
  className
}: CopyableAmountProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const rawNumberStr = Number(amount || 0).toFixed(2);
  const displayStr = formattedAmount || new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount || 0);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(rawNumberStr);
      setCopied(true);
      toast({
        title: 'Amount Copied',
        description: `${rawNumberStr} (${displayStr}) copied for Investec.`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy amount:', err);
      const textarea = document.createElement('textarea');
      textarea.value = rawNumberStr;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn("inline-flex items-center justify-end gap-1.5 group/amt", className)}>
      <span
        className="font-mono cursor-pointer hover:underline select-all"
        title={`Click to copy: ${rawNumberStr}`}
        onClick={handleCopy}
      >
        {displayStr}
      </span>

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
              aria-label="Copy amount"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in-75 duration-200" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {copied ? "Copied!" : `Copy ${rawNumberStr}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
