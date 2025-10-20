
'use client';

import Link from 'next/link';
import { ShoppingCart, LogIn, Menu } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const navLinks = [
  { href: '/products', label: 'Products' },
  { href: '/ai-accountant', label: 'AI Accountant' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/become-a-partner', label: 'Become a Partner' },
  { href: '/contact', label: 'Contact' },
];

const Header = () => {
  const { itemCount } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const handleLogout = () => {
    logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold text-gradient">
            My Accountant
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="text-foreground/80 transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-xs">
                  {itemCount}
                </Badge>
              )}
              <span className="sr-only">Shopping Cart</span>
            </Link>
          </Button>

          <div className="hidden md:block">
            {isAuthenticated && user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Button asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Portal Login
                </Link>
              </Button>
            )}
          </div>
          
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <div className="flex flex-col gap-6 pt-8">
                  <Link href="/" className="text-2xl font-bold text-primary" onClick={() => setMobileMenuOpen(false)}>
                    My Accountant
                  </Link>
                   {navLinks.map(link => (
                    <Link key={link.href} href={link.href} className="text-lg font-medium text-foreground/80 transition-colors hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                  <div className="mt-auto">
                  {isAuthenticated && user ? (
                      <div className="space-y-4">
                          <Link href={user.role === 'reseller' ? '/reseller/dashboard' : '/admin/dashboard'} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                          <Button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full">Logout</Button>
                      </div>
                    ) : (
                      <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/login">
                          <LogIn className="mr-2 h-4 w-4" /> Login
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

const UserMenu = ({ user, onLogout }: { user: any; onLogout: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="relative h-9 w-9 rounded-full">
        {user.name && <span>{user.name.charAt(0)}</span>}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56" align="end" forceMount>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
       <DropdownMenuItem asChild>
        <Link href={user.role === 'reseller' ? '/reseller/dashboard' : '/admin/dashboard'}>Dashboard</Link>
      </DropdownMenuItem>
       <DropdownMenuItem asChild>
        <Link href={user.role === 'reseller' ? '/reseller/profile' : '/admin/staff'}>Profile</Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout}>
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export default Header;
