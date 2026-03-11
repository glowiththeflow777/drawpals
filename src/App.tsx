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
import ProjectInvoices from "./pages/ProjectInvoices";
import TeamManagement from "./pages/TeamManagement";
import SubcontractorDirectory from "./pages/SubcontractorDirectory";
import AdminLayout from "./components/AdminLayout";
import SubcontractorLayout from "./components/SubcontractorLayout";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import RoleProvider from "./components/RoleProvider";
import ProtectedRoute from "./components/ProtectedRoute";

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
          
          {/* Protected routes wrapped in RoleProvider */}
          {/* Subcontractor Portal */}
          <Route path="/dashboard" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['subcontractor']}>
                <SubcontractorLayout><SubcontractorDashboard /></SubcontractorLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/dashboard/projects" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['subcontractor']}>
                <SubcontractorLayout><SubcontractorProjects /></SubcontractorLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/dashboard/invoices" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['subcontractor']}>
                <SubcontractorLayout><SubcontractorInvoices /></SubcontractorLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/invoice/new" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['subcontractor']}>
                <SubcontractorLayout><InvoiceWizard /></SubcontractorLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          
          {/* Admin / PM Portal */}
          <Route path="/admin" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin', 'project-manager']}>
                <AdminLayout><AdminDashboard /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/projects" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin', 'project-manager']}>
                <AdminLayout><ProjectPortal /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/invoices" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin', 'project-manager']}>
                <AdminLayout><Invoices /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/invoices/:projectId" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin', 'project-manager']}>
                <AdminLayout><ProjectInvoices /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/approvals" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin', 'project-manager']}>
                <AdminLayout><Approvals /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/team" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout><TeamManagement /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="/admin/directory" element={
            <RoleProvider>
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout><SubcontractorDirectory /></AdminLayout>
              </ProtectedRoute>
            </RoleProvider>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
