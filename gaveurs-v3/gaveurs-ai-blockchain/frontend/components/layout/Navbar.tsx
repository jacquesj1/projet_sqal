'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Bell,
  User,
  LogOut,
  LayoutDashboard,
  Bird,
  BarChart3,
  Shield,
  Wheat,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { alerteApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID } from '@/lib/constants';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Gavage', href: '/gavage', icon: Wheat },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Blockchain', href: '/blockchain', icon: Shield },
  { label: 'Alertes', href: '/alertes', icon: Bell },
  { label: 'Canards', href: '/canards', icon: Bird },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertesCount, setAlertesCount] = useState(0);

  useEffect(() => {
    loadAlertesCount();
    const interval = setInterval(loadAlertesCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlertesCount = async () => {
    try {
      const dashboard = await alerteApi.getDashboard(DEFAULT_GAVEUR_ID) as { critiques_actives: number };
      setAlertesCount(dashboard.critiques_actives);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🦆</span>
            <span className="text-xl font-bold hidden sm:block">Système Gaveurs V2.1</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    active
                      ? 'bg-white/20 font-bold'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.href === '/alertes' && alertesCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                      {alertesCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Link href="/alertes" className="relative p-2 hover:bg-white/10 rounded-lg">
              <Bell size={22} />
              {alertesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center">
                  {alertesCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <User size={18} />
                </div>
                <ChevronDown size={16} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 py-2">
                    <Link
                      href="/profil"
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User size={18} />
                      <span>Mon Profil</span>
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={18} />
                      <span>Paramètres</span>
                    </Link>
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-gray-100 w-full"
                    >
                      <LogOut size={18} />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-blue-700 border-t border-white/20">
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                    active ? 'bg-white/20 font-bold' : 'hover:bg-white/10'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {item.href === '/alertes' && alertesCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold ml-auto">
                      {alertesCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
