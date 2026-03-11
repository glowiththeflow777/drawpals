import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SubcontractorDashboard from "./pages/SubcontractorDashboard";
import SubcontractorProjects from "./pages/SubcontractorProjects";
import SubcontractorInvoices from "./pages/SubcontractorInvoices";
import InvoiceWizard from "./pages/InvoiceWizard";
import AdminDashboard from "./pages/AdminDashboard";
import Approvals from "./pages/Approvals";
import Invoices from "./pages/Invoices";
import ProjectPortal from "./pages/ProjectPortal";
import TeamManagement from "./pages/TeamManagement";
import SubcontractorDirectory from "./pages/SubcontractorDirectory";
import AdminLayout from "./components/AdminLayout";
import SubcontractorLayout from "./components/SubcontractorLayout";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Subcontractor Portal */}
          <Route path="/dashboard" element={<SubcontractorLayout><SubcontractorDashboard /></SubcontractorLayout>} />
          <Route path="/dashboard/projects" element={<SubcontractorLayout><SubcontractorProjects /></SubcontractorLayout>} />
          <Route path="/dashboard/invoices" element={<SubcontractorLayout><SubcontractorInvoices /></SubcontractorLayout>} />
          <Route path="/invoice/new" element={<SubcontractorLayout><InvoiceWizard /></SubcontractorLayout>} />
          {/* Admin Portal */}
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/projects" element={<AdminLayout><ProjectPortal /></AdminLayout>} />
          <Route path="/admin/invoices" element={<AdminLayout><Invoices /></AdminLayout>} />
          <Route path="/admin/approvals" element={<AdminLayout><Approvals /></AdminLayout>} />
          <Route path="/admin/team" element={<AdminLayout><TeamManagement /></AdminLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
