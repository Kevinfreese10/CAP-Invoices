
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
} from 'lucide-react';

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/lib/types';
import { Button } from '../ui/button';

export default function DashboardNav({ user }: { user: UserType }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/home');
  };

  const navItems = [
  ];

  const adminNavItems = [
     { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { href: '/admin/profile', label: 'My Profile', icon: User, roles: ['admin', 'staff']},
    { href: '/admin/orders', label: 'Manage Orders', icon: ShieldCheck, roles: ['admin', 'staff'] },
    { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin'] },
    { href: '/admin/tasks', label: 'Manage Tasks', icon: ClipboardCheck, roles: ['admin', 'staff'] },
    { href: '/admin/clients', label: 'Manage Clients', icon: BookUser, roles: ['admin'] },
    { href: '/admin/numera', label: 'Numera', icon: FileSpreadsheet, roles: ['admin', 'staff'], department: 'Accounting and Tax' },
    { href: '/admin/numera/chart-of-accounts', label: 'Chart of Accounts', icon: Book, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/numera/allocation-rules', label: 'Allocation Rules', icon: ListOrdered, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers', label: 'CAP Suppliers', icon: FileText, roles: ['admin', 'staff'], department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/review', label: 'Review', icon: ClipboardCheck, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/control-sheet', label: '2nd Review', icon: FileText, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/rejected', label: 'Rejected', icon: FileX2, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/chart-of-accounts', label: 'Chart of Accounts', icon: Book, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/cap-suppliers/inbox', label: 'Inbox', icon: Inbox, roles: ['admin', 'staff'], isSubItem: true, department: 'Accounting and Tax' },
    { href: '/admin/services', label: 'Manage Services', icon: Briefcase, roles: ['admin'] },
    { href: '/admin/categories', label: 'Manage Categories', icon: Shapes, roles: ['admin'] },
    { href: '/admin/blog', label: 'Manage Blog', icon: BookMarked, roles: ['admin'] },
    { href: '/admin/staff', label: 'Manage Staff', icon: Users, roles: ['admin'] },
    { href: '/admin/discounts', label: 'Manage Discounts', icon: Percent, roles: ['admin'] },
    { href: '/admin/knowledge-base', label: 'Knowledge Base & Training', icon: BrainCircuit, roles: ['admin'] },
    { href: '/admin/media', label: 'Media', icon: Images, roles: ['admin'] },
    { href: '/admin/seo', label: 'SEO Management', icon: Search, roles: ['admin'] },
    { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const resellerNavItems = [
    { href: '/reseller/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['reseller'] },
    { href: '/reseller/services', label: 'View Services', icon: Briefcase, roles: ['reseller'] },
    { href: '/reseller/orders', label: 'Client Orders', icon: ShieldCheck, roles: ['reseller'] },
    { href: '/reseller/profile', label: 'My Profile', icon: User, roles: ['reseller'] },
    { href: '/reseller/settings', label: 'API & Branding', icon: Settings, roles: ['reseller'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));
  const visibleAdminNavItems = adminNavItems.filter(item => {
    if (!item.roles.includes(user.role)) return false;
    if (item.department && user.department !== item.department) return false;
    return true;
  });
  const visibleResellerNavItems = resellerNavItems.filter(item => item.roles.includes(user.role));

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2">
            <div className="flex flex-col overflow-hidden">
                <span className="font-semibold text-sm truncate">{user.companyName || user.name}</span>
                <span className="text-xs text-muted-foreground capitalize truncate">{user.role}</span>
            </div>
        </div>
      </SidebarHeader>

      <SidebarMenu className="flex-1">
        {user.role === 'client' && visibleNavItems.map((item) => (
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
        
        {(user.role === 'admin' || user.role === 'staff') && (
            <>
                {visibleAdminNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className={item.isSubItem ? 'pl-8' : ''}>
                            <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
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
