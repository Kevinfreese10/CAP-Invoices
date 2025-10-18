
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  ShieldCheck,
  Briefcase,
  Shapes,
  Users,
  ClipboardCheck,
  BookUser,
  Settings,
  ArrowRightLeft,
  Search,
  BookMarked,
  BrainCircuit,
  Images,
  FileSpreadsheet,
  Book,
  ListOrdered,
  Percent,
  Inbox,
  FileX2,
  Banknote,
  MessageCircleQuestion,
  Wrench,
  PanelLeft,
  ChevronDown,
  BadgeDollarSign,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/lib/types';
import { Button } from '../ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function DashboardNav({ user }: { user: UserType }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/users') || pathname.startsWith('/admin/staff'));
  const [isCapSuppliersOpen, setIsCapSuppliersOpen] = useState(pathname.startsWith('/admin/cap-suppliers'));
  const [isAiAccountantOpen, setIsAiAccountantOpen] = useState(pathname.startsWith('/admin/ai-accountant'));

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navItems = [
     { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['client'] },
     { href: '/dashboard/profile', label: 'My Profile', icon: User, roles: ['client'] },
  ];

  const adminNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { href: '/admin/orders', label: 'Manage Orders', icon: ShieldCheck, roles: ['admin', 'staff'] },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: BadgeDollarSign, roles: ['admin'] },
    { href: '/admin/resellers', label: 'Manage Resellers', icon: Users, roles: ['admin'] },
    { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin'] },
    { href: '/admin/community/questions', label: 'Community Q&A', icon: MessageCircleQuestion, roles: ['admin'] },
    { href: '/admin/clients', label: 'Manage Clients', icon: BookUser, roles: ['admin'] },
    { href: '/admin/services', label: 'Manage Products', icon: Briefcase, roles: ['admin'] },
    { href: '/admin/tools', label: 'Tools', icon: Wrench, roles: ['admin'] },
  ];
  
  const clientId = user?.role === 'client' ? user.id : pathname.split('/')[3];

  const aiAccountantItems = [
     { href: `/admin/ai-accountant/clients`, label: 'Clients', icon: Users, roles: ['admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/customers`, label: 'Customers', icon: Users, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/invoices`, label: 'Invoices', icon: FileText, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/bank/transactions`, label: 'Bank Accounts', icon: Banknote, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/chart-of-accounts`, label: 'Chart of Accounts', icon: Book, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/journals`, label: 'Journals', icon: BookMarked, roles: ['client', 'admin', 'staff'] },
     { href: `/admin/ai-accountant/${clientId}/reports`, label: 'Reports', icon: FileSpreadsheet, roles: ['client', 'admin', 'staff'] },
  ];

  const capSupplierItems = [
    { href: '/admin/cap-suppliers/review', label: 'Review', icon: ClipboardCheck, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/control-sheet', label: '2nd Review', icon: FileText, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/payment-control-sheet', label: 'Payment Control Sheet', icon: FileSpreadsheet, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/payment-batches', label: 'Payment Batches', icon: Banknote, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/rejected', label: 'Rejected', icon: FileX2, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/chart-of-accounts', label: 'Chart of Accounts', icon: Book, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/inbox', label: 'Inbox', icon: Inbox, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
  ]

  const settingsNavItems = [
    { href: '/admin/profile', label: 'My Profile', icon: User, roles: ['admin', 'staff']},
    { href: '/admin/tasks', label: 'Manage Tasks', icon: ClipboardCheck, roles: ['admin', 'staff'] },
    { href: '/admin/categories', label: 'Manage Categories', icon: Shapes, roles: ['admin'] },
    { href: '/admin/blog', label: 'Manage Blog', icon: BookMarked, roles: ['admin'] },
    { href: '/admin/staff', label: 'Manage Staff', icon: Users, roles: ['admin'] },
    { href: '/admin/users', label: 'Manage Users', icon: Users, roles: ['admin'] },
    { href: '/admin/discounts', label: 'Manage Discounts', icon: Percent, roles: ['admin'] },
    { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: BrainCircuit, roles: ['admin'] },
    { href: '/admin/ai-accountant/allocation-rules', label: 'Allocation Rules', icon: ArrowRightLeft, roles: ['admin'] },
    { href: '/admin/media', label: 'Media', icon: Images, roles: ['admin'] },
    { href: '/admin/seo', label: 'SEO Management', icon: Search, roles: ['admin'] },
  ];

  const resellerNavItems = [
    { href: '/reseller/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['reseller'] },
    { href: '/reseller/services', label: 'View Products', icon: Briefcase, roles: ['reseller'] },
    { href: '/reseller/orders', label: 'Client Orders', icon: ShieldCheck, roles: ['reseller'] },
    { href: '/reseller/profile', label: 'My Profile', icon: User, roles: ['reseller'] },
    { href: '/reseller/settings', label: 'API & Branding', icon: Settings, roles: ['reseller'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));
  const visibleAdminNavItems = adminNavItems.filter(item => item.roles.includes(user.role));
  const visibleAiAccountantItems = aiAccountantItems.filter(item => item.roles.some(r => user.role === r));
  const visibleCapSupplierItems = capSupplierItems.filter(item => item.roles.includes(user.role) && (!item.department || item.department === user.department));
  const visibleSettingsNavItems = settingsNavItems.filter(item => item.roles.includes(user.role));
  const visibleResellerNavItems = resellerNavItems.filter(item => item.roles.includes(user.role));

  const shouldShowAdminOrAI = user.role === 'admin' || user.role === 'staff' || (user.role === 'client' && user.hasAIAccountantProfile);


  return (
    <>
      <SidebarHeader>
        <div className={cn("flex items-center gap-3 p-2", state === 'collapsed' && 'p-0')}>
            <div className={cn("flex-1 overflow-hidden", state === 'collapsed' && 'hidden')}>
                <p className="font-semibold text-sm truncate">{user.companyName || user.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user.role}</p>
            </div>
             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSidebar}
            >
                <PanelLeft className={cn("transition-transform", state === 'collapsed' && 'rotate-180')} />
            </Button>
        </div>
      </SidebarHeader>

      <SidebarMenu className="flex-1">
        {user.role === 'client' && !user.hasAIAccountantProfile && visibleNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        
        {shouldShowAdminOrAI && (
            <>
                {user.role !== 'client' && visibleAdminNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                            <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}

                 <Collapsible open={isAiAccountantOpen} onOpenChange={setIsAiAccountantOpen}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton isActive={pathname.startsWith('/admin/ai-accountant')} tooltip="AI Accountant">
                                <Book />
                                <span>AI Accountant</span>
                                <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-[[data-state=open]]:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                    </SidebarMenuItem>
                     <CollapsibleContent asChild>
                        <SidebarMenu className="pl-4">
                            {visibleAiAccountantItems.map(item => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="h-8">
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </CollapsibleContent>
                 </Collapsible>

                {visibleCapSupplierItems.length > 0 && (
                    <Collapsible open={isCapSuppliersOpen} onOpenChange={setIsCapSuppliersOpen}>
                        <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                                <SidebarMenuButton isActive={pathname.startsWith('/admin/cap-suppliers')} tooltip="CAP Suppliers">
                                    <FileText />
                                    <span>CAP Suppliers</span>
                                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-[[data-state=open]]:rotate-180" />
                                </SidebarMenuButton>
                            </CollapsibleTrigger>
                        </SidebarMenuItem>
                        <CollapsibleContent asChild>
                            <SidebarMenu className="pl-4">
                                {visibleCapSupplierItems.map(item => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="h-8">
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </CollapsibleContent>
                    </Collapsible>
                )}
                 <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton isActive={pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/users') || pathname.startsWith('/admin/profile')} tooltip="Settings">
                                <Settings />
                                <span>Settings</span>
                                <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-[[data-state=open]]:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent asChild>
                        <SidebarMenu className="pl-4">
                            {visibleSettingsNavItems.map(item => (
                                 <SidebarMenuItem key={item.href}>
                                     <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="h-8">
                                         <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                         </Link>
                                     </SidebarMenuButton>
                                 </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </CollapsibleContent>
                 </Collapsible>
            </>
        )}

        {user.role === 'reseller' && (
            <>
                {visibleResellerNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                            <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </>
        )}
      </SidebarMenu>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log Out">
              <LogOut />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
