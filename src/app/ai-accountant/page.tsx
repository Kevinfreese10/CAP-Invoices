
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck, Wallet, Bot, FileInput, BarChart, Percent, Building, Users, FileText, BadgeDollarSign, CheckCircle, Banknote, FileSearch, TrendingUp } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AIAccountantSignupForm from '@/components/auth/AIAccountantSignupForm';

export default function AiAccountantPage() {

  const coreFunctions = [
    {
      title: 'Client Receipts & Payments',
      description: 'Automatically allocate client receipts to the correct invoices and accounts.',
      icon: Users,
    },
    {
      title: 'Supplier Invoices',
      description: 'Process supplier invoices and match them against payments — just upload your invoices and let the AI handle the rest.',
      icon: Building,
    },
    {
      title: 'Bank Reconciliation',
      description: 'Upload your PDF bank statements, and the AI will extract, allocate, and reconcile transactions instantly. It detects duplicates, missing periods, and unmatched entries to ensure your books balance.',
      icon: Banknote,
    },
    {
        title: 'Statements & Reports',
        description: 'Instantly prepare accurate customer and supplier statements and track your aged analysis in real time.',
        icon: FileText,
    },
    {
        title: 'Tax & Compliance',
        description: 'Automatically prepare VAT201 returns, calculate Provisional and Annual Tax, and flag non-deductible expenses.',
        icon: ShieldCheck,
    },
    {
        title: 'AI Insights',
        description: 'Identify anomalies, suggest journal corrections, and generate performance summaries (sales, expenses, profit).',
        icon: TrendingUp,
    }
  ];
  
   const pricingTiers = [
    {
      title: "Free Plan",
      price: "R0",
      description: "Perfect for getting started and managing one company.",
      features: [
        "1 Company Profile",
        "1 User",
        "Manual Transaction Processing",
        "Basic Reporting",
      ],
      cta: "Get Started for Free",
      href: "/ai-accountant-signup"
    },
    {
      title: "AI Accountant Add-on",
      price: "R450",
      period: "/ company / month",
      description: "Unlock the power of AI for full automation.",
      features: [
        "Includes all Free Plan features",
        "Automated AI transaction allocation",
        "Bank statement PDF reading",
        "Advanced real-time reports",
      ],
      cta: "Add AI to Your Profile",
       href: "/ai-accountant-signup"
    },
  ];


  return (
    <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              AI Accountant – Your <span className="text-gradient">Smart Financial Assistant</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              The AI Accountant automates your entire accounting workflow — from receipts to reconciliations — saving you hours of manual work every month.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/ai-accountant-signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section id="features" className="container mx-auto px-4 scroll-m-20">
          <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">💼 Core Functions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coreFunctions.map(feature => (
                  <div key={feature.title} className="flex items-start gap-4 p-4">
                      <div className="flex-shrink-0">
                        <feature.icon className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                          <h3 className="font-semibold text-lg">{feature.title}</h3>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                  </div>
              ))}
          </div>
      </section>
      
       <section id="pricing" className="bg-background py-16 scroll-m-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Flexible Pricing for Every Need</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Choose the plan that's right for you. Start for free and add features as you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-3xl mx-auto">
            {pricingTiers.map((tier) => (
              <Card key={tier.title} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{tier.title}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="flex items-baseline pt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={tier.href}>{tier.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
           <div className="text-center mt-16">
                <h3 className="text-2xl font-bold">Need to Add More Users?</h3>
                <p className="text-muted-foreground mt-2">Additional users can be added to any plan for just <span className="font-bold text-primary">R50 per user, per month</span>.</p>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="mt-4">Sign Up Now</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight">AI Accountant Signup</DialogTitle>
                            <DialogDescription>Create an account to start automating your bookkeeping.</DialogDescription>
                        </DialogHeader>
                        <AIAccountantSignupForm />
                    </DialogContent>
                </Dialog>
            </div>

        </div>
      </section>
    </div>
  );
}
