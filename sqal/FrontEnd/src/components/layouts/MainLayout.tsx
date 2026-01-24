// ============================================================================
// SQAL Frontend - Main Layout Component
// Main application layout with header, sidebar, and content area
// ============================================================================

import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useWebSocket } from "@hooks/useWebSocket";

export function MainLayout() {
  // Initialize WebSocket connection to real-time dashboard feed
  // The hook automatically connects and manages the WebSocket lifecycle
  console.log('🔵 MainLayout: Component mounted');
  useWebSocket();
  console.log('🔵 MainLayout: useWebSocket hook called');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
