// ============================================================================
// SQAL Frontend - Modern Animated Login Page
// Page de connexion avec Keycloak SSO - Style Gaming/Tech
// ============================================================================

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2, Shield, Zap, Lock } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-slate-900"></div>
        
        {/* Loading state */}
        <div className="relative z-10 text-center">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-purple-400 mx-auto mb-6" />
            <div className="absolute inset-0 h-16 w-16 mx-auto animate-ping">
              <div className="h-full w-full rounded-full bg-purple-400/20"></div>
            </div>
          </div>
          <p className="text-purple-200 text-lg font-medium animate-pulse">
            Initialisation du système...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
      
      {/* Animated gradient orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and title with animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-block mb-6">
            {/* Animated shield icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-purple-500/30">
                <Shield className="h-16 w-16 text-purple-400 animate-float" />
              </div>
            </div>
            
            {/* Orbiting particles */}
            <div className="absolute -top-2 -right-2 w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
            <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-blue-400 rounded-full animate-ping animation-delay-1000"></div>
          </div>

          <h1 className="text-6xl font-black mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
            SQAL
          </h1>
          <p className="text-purple-200/80 text-sm font-medium tracking-wider uppercase">
            Système de Qualité & Analyse
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-purple-300/60">
            <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
              📡 ToF Sensor
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              🌈 AS7341 Spectral
            </span>
          </div>
        </div>

        {/* Login card */}
        <div className="relative backdrop-blur-xl bg-slate-900/50 rounded-2xl border border-purple-500/30 shadow-2xl p-8 animate-slide-up">
          {/* Glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          
          <div className="relative space-y-6">
            {/* Features */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex flex-col items-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-105">
                <Zap className="h-6 w-6 text-purple-400 mb-2" />
                <span className="text-xs text-purple-200/80">Temps Réel</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:scale-105">
                <Lock className="h-6 w-6 text-blue-400 mb-2" />
                <span className="text-xs text-blue-200/80">Sécurisé</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 hover:scale-105">
                <Shield className="h-6 w-6 text-pink-400 mb-2" />
                <span className="text-xs text-pink-200/80">SSO</span>
              </div>
            </div>

            {/* Login button */}
            <Button
              onClick={handleLogin}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transition-all duration-300 hover:scale-105 group"
              size="lg"
            >
              <LogIn className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform duration-300" />
              <span className="relative">
                Se connecter avec Keycloak
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white group-hover:w-full transition-all duration-300"></span>
              </span>
            </Button>

            {/* Info section */}
            <div className="pt-4 border-t border-purple-500/20">
              <div className="text-center space-y-2">
                <p className="text-xs text-purple-200/60 uppercase tracking-wider font-semibold">
                  Comptes de test disponibles
                </p>
                <div className="space-y-1 text-xs text-purple-200/80">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                    <span className="font-mono">admin.sqal</span>
                    <span className="text-purple-400">Super Admin</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                    <span className="font-mono">manager.sqal</span>
                    <span className="text-blue-400">Manager</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                    <span className="font-mono">operator.sqal</span>
                    <span className="text-pink-400">Operator</span>
                  </div>
                </div>
                <p className="text-xs text-purple-200/40 pt-2">
                  Mot de passe : admin123 / manager123 / operator123
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4">
              <p className="text-xs text-purple-200/40">
                🔒 Authentification sécurisée via Keycloak SSO
              </p>
            </div>
          </div>
        </div>

        {/* Version info */}
        <div className="text-center mt-6 text-xs text-purple-200/30">
          <p>SQAL Platform v1.0.0 • Powered by Keycloak</p>
        </div>
      </div>

      {/* Custom animations CSS */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-gradient { 
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
        .animate-slide-up { animation: slide-up 0.8s ease-out 0.2s both; }
        .animation-delay-1000 { animation-delay: 1s; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
