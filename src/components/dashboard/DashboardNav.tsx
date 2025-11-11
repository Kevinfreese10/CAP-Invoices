
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  Users,
  ClipboardCheck,
  Book,
  FileSpreadsheet,
  Inbox,
  FileX2,
  Banknote,
  Wrench,
  PanelLeft,
  ChevronDown,
  HandCoins,
  FileCheck,
  BookUser,
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
  const [isCapSuppliersOpen, setIsCapSuppliersOpen] = useState(pathname.startsWith('/admin/cap-suppliers'));

  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  const capSupplierItems = [
    { href: '/admin/cap-suppliers/inbox', label: 'Inbox', icon: Inbox, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/review', label: 'Review', icon: ClipboardCheck, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/control-sheet', label: '2nd Review', icon: FileText, roles: ['admin', 'staff', 'cap_staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/account-review', label: 'Account Review', icon: BookUser, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/third-review', label: '3rd Review', icon: FileCheck, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/payment-control-sheet', label: 'Payment Control Sheet', icon: FileSpreadsheet, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/payment-batches', label: 'Payment Batches', icon: Banknote, roles: ['admin', 'staff', 'cap_supervisor', 'cap_staff'] },
    { href: '/admin/cap-suppliers/rejected', label: 'Rejected', icon: FileX2, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/chart-of-accounts', label: 'Chart of Accounts', icon: Book, roles: ['admin', 'staff', 'cap_supervisor'] },
    { href: '/admin/cap-suppliers/commission', label: 'Commission', icon: HandCoins, roles: ['admin', 'staff', 'cap_supervisor'] },
  ]

  return (
    <>
      <SidebarHeader>
        <div className={cn("flex items-center gap-3 p-2", state === 'collapsed' && 'p-0')}>
            <div className={cn("flex-1 overflow-hidden", state === 'collapsed' && 'hidden')}>
                <p className="font-semibold text-sm truncate">{user.companyName || user.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user.role.replace('_', ' ')}</p>
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
        
        {(user.role === 'admin' || user.role === 'staff' || user.role === 'cap_staff' || user.role === 'cap_supervisor') && (
            <>
            {(user.role === 'admin' || user.role === 'staff' || user.role === 'cap_staff' || user.role === 'cap_supervisor') && (
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
                    {capSupplierItems.filter(item => item.roles.includes(user.role)).map(item => (
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
            
            {user.role === 'admin' && (
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/users')} tooltip="Manage Users">
                        <Link href="/admin/users">
                            <Users />
                            <span>Manage Users</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            )}
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
