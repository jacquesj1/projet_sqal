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
  BarChart3,
  TrendingUp,
  Link2,
  ChevronDown,
  Settings,
  Zap,
  Package,
  Cloud,
  Heart,
  Home,
  Shield,
  Search,
} from 'lucide-react';
import { alerteApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID } from '@/lib/constants';

// Navigation principale simplifiée (5 entrées)
const mainNavItems = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Lots', href: '/lots', icon: Package },
  { label: 'Alertes', href: '/alertes', icon: Bell },
  { label: 'Analytics', href: '/analytics', icon: TrendingUp },
];

// Menu Blockchain (dropdown)
const blockchainItems = [
  { label: 'Intégration', href: '/blockchain', icon: Shield },
  { label: 'Explorer', href: '/blockchain-explorer', icon: Search },
];

// Menu utilisateur (dropdown)
const userMenuItems = [
  { label: 'Saisie Rapide', href: '/saisie-rapide', icon: Zap },
  { label: 'Environnement', href: '/environnement', icon: Cloud },
  { label: 'Vétérinaires', href: '/veterinaires', icon: Heart },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [blockchainMenuOpen, setBlockchainMenuOpen] = useState(false);
  const [alertesCount, setAlertesCount] = useState(0);
  const [gaveurNom, setGaveurNom] = useState<string>('');
  const [gaveurEmail, setGaveurEmail] = useState<string>('');

  useEffect(() => {
    loadAlertesCount();
    loadGaveurInfo();
    const interval = setInterval(loadAlertesCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadGaveurInfo = () => {
    const nom = localStorage.getItem('gaveur_nom') || localStorage.getItem('user');
    const email = localStorage.getItem('gaveur_email');

    if (nom) {
      try {
        const userData = JSON.parse(nom);
        setGaveurNom(userData.name || userData.nom || 'Gaveur');
        setGaveurEmail(userData.email || email || '');
      } catch {
        setGaveurNom(nom);
        setGaveurEmail(email || '');
      }
    }
  };

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
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('gaveur_id');
    localStorage.removeItem('gaveur_nom');
    localStorage.removeItem('gaveur_email');
    localStorage.removeItem('gaveur_token');
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isBlockchainActive = () => {
    return pathname.startsWith('/blockchain');
  };

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <span className="text-3xl">🦆</span>
            <div className="hidden sm:block">
              <div className="text-xl font-bold">Système Gaveurs</div>
              <div className="text-xs opacity-90">V3.0 - IA + IoT + Blockchain</div>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {/* Menu principal */}
            {mainNavItems.map((item) => {
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
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold animate-pulse">
                      {alertesCount}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Menu Blockchain (dropdown) */}
            <div className="relative">
              <button
                onClick={() => setBlockchainMenuOpen(!blockchainMenuOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isBlockchainActive()
                    ? 'bg-white/20 font-bold'
                    : 'hover:bg-white/10'
                }`}
              >
                <Link2 size={18} />
                <span>Blockchain</span>
                <ChevronDown size={16} className={`transition-transform ${blockchainMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {blockchainMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setBlockchainMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 py-2">
                    {blockchainItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-blue-50 transition-colors"
                          onClick={() => setBlockchainMenuOpen(false)}
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-semibold">
                    {gaveurNom || 'Gaveur'}
                  </span>
                  {gaveurEmail && (
                    <span className="text-xs opacity-80">{gaveurEmail}</span>
                  )}
                </div>
                <ChevronDown size={16} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20 py-2">
                    {/* Info utilisateur */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-800">
                        {gaveurNom || 'Gaveur'}
                      </p>
                      {gaveurEmail && (
                        <p className="text-xs text-gray-600">{gaveurEmail}</p>
                      )}
                    </div>

                    {/* Menu utilisateur */}
                    {userMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}

                    <hr className="my-2" />

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
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-gray-100 w-full text-left"
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
            {/* Menu principal mobile */}
            {mainNavItems.map((item) => {
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

            {/* Section Blockchain mobile */}
            <div className="pt-2 border-t border-white/20">
              <div className="px-4 py-2 text-xs uppercase text-white/60 font-semibold">
                Blockchain
              </div>
              {blockchainItems.map((item) => {
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
                  </Link>
                );
              })}
            </div>

            {/* Section Utilisateur mobile */}
            <div className="pt-2 border-t border-white/20">
              <div className="px-4 py-2 text-xs uppercase text-white/60 font-semibold">
                Outils
              </div>
              {userMenuItems.map((item) => {
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
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
