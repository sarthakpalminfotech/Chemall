import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { AppProvider } from "@/lib/store";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderNew from "./pages/OrderNew";
import OrderManual from "./pages/OrderManual";
import OrderImport from "./pages/OrderImport";
import OrderDetails from "./pages/OrderDetails";
import Masters from "./pages/Masters";
import Inventory from "./pages/Inventory";
import InventoryHistory from "./pages/InventoryHistory";
import Notes from "./pages/Notes";
import ScanQR from "./pages/ScanQR";
import Leads from "./pages/Leads";
import LeadNew from "./pages/LeadNew";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Alerts from "./pages/Alerts";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/new" element={<OrderNew />} />
                    <Route path="/orders/new/manual" element={<OrderManual />} />
                    <Route path="/orders/new/import" element={<OrderImport />} />
                    <Route path="/orders/:id" element={<OrderDetails />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/inventory/history" element={<InventoryHistory />} />
                    <Route path="/masters" element={<Masters />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/scan-qr" element={<ScanQR />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/leads/new" element={<LeadNew />} />
                    <Route path="/leads/:id" element={<LeadNew />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/alerts" element={<Alerts />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
