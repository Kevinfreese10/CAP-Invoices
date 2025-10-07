
'use client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

const settingsNav = [
    { title: 'My Profile', href: '/admin/profile' },
    { title: 'Manage Tasks', href: '/admin/tasks' },
    { title: 'Manage Categories', href: '/admin/categories' },
    { title: 'Manage Blog', href: '/admin/blog' },
    { title: 'Manage Staff', href: '/admin/staff' },
    { title: 'Manage Discounts', href: '/admin/discounts' },
    { title: 'Knowledge Base & Training', href: '/admin/knowledge-base' },
    { title: 'Media', href: '/admin/media' },
    { title: 'SEO Management', href: '/admin/seo' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    return (
        <div className="grid md:grid-cols-[200px_1fr] gap-8">
            <aside>
                <h2 className="text-xl font-semibold mb-4">Settings</h2>
                <nav className="flex flex-col gap-2">
                    {settingsNav.map(item => (
                        <Link 
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "text-sm font-medium p-2 rounded-md hover:bg-muted",
                                pathname === item.href ? 'bg-muted text-primary' : 'text-muted-foreground'
                            )}
                        >
                            {item.title}
                        </Link>
                    ))}
                </nav>
            </aside>
            <main>
                {children}
            </main>
        </div>
    );
}
