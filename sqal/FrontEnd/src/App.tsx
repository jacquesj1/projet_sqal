// ============================================================================
// SQAL Frontend - Main App Component
// Application entry point with routing and providers
// ============================================================================

import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAuthStore } from "@stores/authStore";
import { MainLayout } from "@components/layouts/MainLayout";
import { ProtectedRoute } from "@components/auth";
import { Dashboard } from "@pages/Dashboard";
import { Login } from "@pages/Auth";
import { AnalysisPage } from "@pages/Analysis/AnalysisPage";
import { AnalysisHistoryPage } from "@pages/Analysis/AnalysisHistoryPage";
import { VL53L8CHPage } from "@pages/Sensors/VL53L8CHPage";
import { AS7341Page } from "@pages/Sensors/AS7341Page";
import { FusionPage } from "@pages/Sensors/FusionPage";
import { AIMonitoringPage } from "@pages/AI/AIMonitoringPage";
import { AITrainingPage } from "@pages/AI/AITrainingPage";
import { AIModelsPage } from "@pages/AI/AIModelsPage";
import Analytics from "@pages/Analytics/Analytics";
import { ReportsPage } from "@pages/Reports/ReportsPage";
import { AdminDevicesPage } from "@pages/Admin/AdminDevicesPage";
import { AdminUsersPage } from "@pages/Admin/AdminUsersPage";
import { AdminAuditPage } from "@pages/Admin/AdminAuditPage";
import { AdminFirmwarePage } from "@pages/Admin/AdminFirmwarePage";
import { AdminCalibrationPage } from "@pages/Admin/AdminCalibrationPage";
import { FoieGrasPage } from "@pages/FoieGrasPage";
import BlockchainPage from "@pages/BlockchainPage";
import { ROUTES } from "@constants/index";
import "@styles/globals.css";
import { Toaster } from "sonner";

import { AuthProvider } from '@/contexts/AuthContext';

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { initialize } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path={ROUTES.LOGIN} element={<Login />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              
              {/* Analysis Routes */}
              <Route path={ROUTES.ANALYSIS} element={<AnalysisPage />} />
              <Route path={ROUTES.ANALYSIS_HISTORY} element={<AnalysisHistoryPage />} />
              
              {/* Sensors Routes */}
              <Route path={ROUTES.SENSORS_VL53L8CH} element={<VL53L8CHPage />} />
              <Route path={ROUTES.SENSORS_AS7341} element={<AS7341Page />} />
              <Route path={ROUTES.SENSORS_FUSION} element={<FusionPage />} />
              
              {/* AI Routes */}
              <Route path={ROUTES.AI_MONITORING} element={<AIMonitoringPage />} />
              <Route path={ROUTES.AI_TRAINING} element={<AITrainingPage />} />
              <Route path={ROUTES.AI_MODELS} element={<AIModelsPage />} />

              {/* Analytics Routes */}
              <Route path={ROUTES.ANALYTICS} element={<Analytics />} />

              {/* Foie Gras Quality Control */}
              <Route path="/foiegras" element={<FoieGrasPage />} />

              {/* Blockchain Certifications */}
              <Route path="/blockchain" element={<BlockchainPage />} />

              {/* Reports Routes */}
              <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
              
              {/* Admin Routes */}
              <Route path={ROUTES.ADMIN_DEVICES} element={<AdminDevicesPage />} />
              <Route path={ROUTES.ADMIN_FIRMWARE} element={<AdminFirmwarePage />} />
              <Route path={ROUTES.ADMIN_CALIBRATION} element={<AdminCalibrationPage />} />
              <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
              <Route path={ROUTES.ADMIN_AUDIT} element={<AdminAuditPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          </Routes>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
