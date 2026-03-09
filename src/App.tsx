import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SubcontractorDashboard from "./pages/SubcontractorDashboard";
import InvoiceWizard from "./pages/InvoiceWizard";
import AdminDashboard from "./pages/AdminDashboard";
import Approvals from "./pages/Approvals";
import ProjectPortal from "./pages/ProjectPortal";
import TeamManagement from "./pages/TeamManagement";
import AdminLayout from "./components/AdminLayout";
import SubcontractorLayout from "./components/SubcontractorLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<SubcontractorLayout><SubcontractorDashboard /></SubcontractorLayout>} />
          <Route path="/invoice/new" element={<SubcontractorLayout><InvoiceWizard /></SubcontractorLayout>} />
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/projects" element={<AdminLayout><ProjectPortal /></AdminLayout>} />
          <Route path="/admin/team" element={<AdminLayout><TeamManagement /></AdminLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
