/**
 * @file App.tsx
 * @description Root Application Component.
 * Sets up global providers (QueryClient, Tooltip, Toaster) and defines client-side routing.
 * 
 * @functionality
 * - Router: Handles navigation based on authentication status and user role.
 * - Global Providers: Wraps app in necessary context providers.
 * - Auth Guarding: Redirects unauthenticated users to Landing, pending to PendingApproval, etc.
 * 
 * @dependencies
 * - wouter: Lightweight routing library.
 * - @tanstack/react-query: Data fetching and caching.
 * - useAuth: Custom hook for global authentication state.
 * 
 * @breaking-changes
 * - Route Order: Specific routes (e.g., /admin) must be defined before catch-alls if using Switch.
 * - Provider Nesting: QueryClientProvider must usually be near the top.
 */

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Materials from "@/pages/Materials";
import Reports from "@/pages/Reports";
import OrganizationSettings from "@/pages/OrganizationSettings";
import BOQNormalizerPage from "@/pages/BOQNormalizerPage";
import Admin from "@/pages/Admin";
import PendingApproval from "@/pages/PendingApproval";
import NotFound from "@/pages/not-found";
import DataSources from "@/pages/admin/DataSources";
import DatasetDetails from "@/pages/admin/DatasetDetails";

function Router() {
  const { isAuthenticated, isLoading, isAdmin, isApproved, isPending, isRejected } = useAuth();

  // Show loading state
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Show pending approval page for pending users
  if (isPending) {
    return (
      <Switch>
        <Route path="/" component={PendingApproval} />
        <Route component={PendingApproval} />
      </Switch>
    );
  }

  // Show rejection message for rejected users
  if (isRejected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">Your account access has been rejected. Please contact the administrator.</p>
        </div>
      </div>
    );
  }

  // Show main application for approved users
  if (isApproved) {
    return (
      <OrganizationGuard>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:projectId" component={ProjectDetail} />
          <Route path="/boq-normalizer" component={BOQNormalizerPage} />
          <Route path="/materials" component={Materials} />
          <Route path="/reports" component={Reports} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={OrganizationSettings} />
          <Route path="/data-sources" component={DataSources} />
          <Route path="/admin/data-sources/:id" component={DatasetDetails} />
          {isAdmin && <Route path="/admin" component={Admin} />}
          <Route component={NotFound} />
        </Switch>
      </OrganizationGuard>
    );
  }

  // Fallback for unknown status
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">Account Status Unknown</h1>
        <p className="text-gray-600">Please contact the administrator for assistance.</p>
      </div>
    </div>
  );
}

import { ErrorProvider } from "@/hooks/use-error";
import { GlobalErrorDialog } from "@/components/ui/error-dialog";

import { OrganizationProvider } from "@/context/OrganizationContext";
import OrganizationGuard from "@/components/OrganizationGuard";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <TooltipProvider>
          <OrganizationProvider>
            <Toaster />
            <GlobalErrorDialog />
            <GlobalErrorDialog />
            <Router />
          </OrganizationProvider>
        </TooltipProvider>
      </ErrorProvider>
    </QueryClientProvider>
  );
}

export default App;
