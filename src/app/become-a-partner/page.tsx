
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck, Wallet } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';

export default function BecomeAPartnerPage() {
  const whyChooseUs = [
    {
      title: 'Expert & Reliable',
      description: 'Our team of seasoned professionals ensures accuracy and dependability for your clients.',
      icon: ShieldCheck,
    },
    {
      title: 'Competitive Reseller Rates',
      description: 'Benefit from exclusive reseller pricing that gives you a competitive edge.',
      icon: Wallet,
    },
    {
      title: 'Fast Turnaround',
      description: 'We prioritize efficiency to meet your deadlines without compromising quality.',
      icon: Rocket,
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              Partner with <span className="text-gradient">My Accountant</span> and Grow Your Business
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Join our reseller program and offer top-tier accounting and compliance services to your clients under your own brand. We handle the work, you build the relationships.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/reseller-signup">Sign Up Today</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-20">
        <WebsiteAIWidget />
      </section>

      <section className="bg-background pt-16">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Partner With Us?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    Leverage our expertise to enhance your service offerings.
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
    </div>
  );
}
