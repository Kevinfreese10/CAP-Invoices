
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck, Wallet, Bot, FileInput, BarChart, Percent } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function AiAccountantPage() {

  const whyChooseUs = [
    {
      title: 'Fully Automated',
      description: 'Let our AI handle the tedious work of data entry and transaction categorization.',
      icon: Rocket,
    },
    {
      title: 'Highly Accurate',
      description: 'Our AI is trained on thousands of transactions to ensure your books are precise.',
      icon: ShieldCheck,
    },
    {
      title: 'Cost-Effective',
      description: 'Save on billable hours by automating your bookkeeping processes.',
      icon: Wallet,
    },
  ];

  const features = [
    {
      title: 'Automated Transaction Imports',
      description: 'Securely import your bank statements via CSV or our AI-powered PDF reader.',
      icon: FileInput,
    },
    {
      title: 'Intelligent Categorization',
      description: 'Our AI automatically allocates transactions to the correct accounts based on your rules.',
      icon: Bot,
    },
    {
      title: 'Real-time Financial Reports',
      description: 'Generate Trial Balances, General Ledgers, and other reports instantly.',
      icon: BarChart,
    },
    {
        title: 'VAT & Tax Compliance',
        description: 'The AI helps ensure your VAT is correctly categorized for easier submissions.',
        icon: Percent,
    }
  ];


  return (
    <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              Welcome to the Future of Accounting with <span className="text-gradient">#AIAccountant</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Automate your bookkeeping, eliminate manual data entry, and get real-time financial insights with our revolutionary AI-powered accounting module.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/reseller-signup">Sign Up Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="bg-background pt-16">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose The AI Accountant?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    Transform your bookkeeping from a chore into a strategic advantage.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {whyChooseUs.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

       <section id="features" className="container mx-auto px-4 scroll-m-20">
          <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Key Features</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                  Everything you need to put your accounting on autopilot.
              </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map(feature => (
                  <div key={feature.title} className="flex items-start gap-4 p-4 border rounded-lg">
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
    </div>
  );
}
