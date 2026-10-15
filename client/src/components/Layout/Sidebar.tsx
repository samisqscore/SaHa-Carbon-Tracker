import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateOrganizationDialog } from "@/components/CreateOrganizationDialog";
import {
  Leaf,
  BarChart3,
  Building,
  Package,
  FileText,
  FileSpreadsheet,
  Menu,
  X,
  LogOut,
  Shield,
  Plus,
  PlayCircle,
  Database
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Projects', href: '/projects', icon: Building },
  { name: 'BOQ Normalizer', href: '/boq-normalizer', icon: FileSpreadsheet },
  { name: 'Material Catalog', href: '/materials', icon: Package },
  { name: 'Reports', href: '/reports', icon: FileText },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Shield },
  { name: 'Global Data Sets', href: '/data-sources', icon: Database },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, isAdmin } = useAuth();
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const handleReplayTour = async () => {
    try {
      await apiRequest("POST", "/api/user/tutorial-reset");
      window.location.reload();
    } catch (e) {
      console.error("Failed to reset tour", e);
    }
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || 'User';
  };

  const SidebarContent = () => (
    <>
      <CreateOrganizationDialog open={showCreateOrg} onOpenChange={setShowCreateOrg} />

      {/* Logo */}
      {/* Organization Switcher */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-emerald-700 p-2 rounded-lg">
            <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg sm:text-xl text-gray-900 truncate">DMBoD</h1>
            <p className="text-xs sm:text-sm text-gray-600 truncate">Embodied Carbon Intelligence</p>
          </div>
        </div>

        {organizations.length > 0 && currentOrganization && (
          <div className="mt-2">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Active Organization</label>
            <Select
              value={currentOrganization.id}
              onValueChange={(val) => {
                const org = organizations.find(o => o.id === val);
                if (org) setCurrentOrganization(org);
              }}
            >
              <SelectTrigger className="h-8 text-sm w-full bg-white">
                <SelectValue placeholder="Select Organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-3 sm:p-4 flex-1 overflow-y-auto">
        <ul className="space-y-1 sm:space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center p-2.5 sm:p-3 text-sm sm:text-base text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : ''
                    }`}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin Navigation */}
        {isAdmin && (
          <>
            <div className="px-3 mt-4 sm:mt-6 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Administration
              </h3>
            </div>
            <ul className="space-y-1 sm:space-y-2">
              {adminNavigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center p-2.5 sm:p-3 text-sm sm:text-base text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation ${isActive ? 'bg-purple-50 text-purple-600 font-medium' : ''
                        }`}
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0 ${isActive ? 'text-purple-600' : ''}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Organization Management Section */}
        <div className="px-3 mt-4 sm:mt-6 mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Organization
          </h3>
        </div>
        <ul className="space-y-1 sm:space-y-2">
          {/* Create Organization - Visible to everyone authorized to switch orgs (or everyone, per logic) */}
          <li>
            <button
              onClick={() => {
                setIsMobileOpen(false);
                setShowCreateOrg(true);
              }}
              className="w-full flex items-center p-2.5 sm:p-3 text-sm sm:text-base text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation cursor-pointer text-left"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0 text-gray-500" />
              <span className="truncate">New Organization</span>
            </button>
          </li>

          {/* Org Admin Only - Settings */}
          {!isAdmin && currentOrganization?.role === 'org_admin' && (
            <li>
              <Link
                href="/settings"
                className={`flex items-center p-2.5 sm:p-3 text-sm sm:text-base text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation ${location === '/settings' ? 'bg-orange-50 text-orange-600 font-medium' : ''
                  }`}
                onClick={() => setIsMobileOpen(false)}
              >
                <Building className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0 ${location === '/settings' ? 'text-orange-600' : ''}`} />
                <span className="truncate">Org Settings</span>
              </Link>
            </li>
          )}

          {/* Org Admin Only - Data Sources */}
          {!isAdmin && currentOrganization?.role === 'org_admin' && (
            <li>
              <Link
                href="/data-sources"
                className={`flex items-center p-2.5 sm:p-3 text-sm sm:text-base text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation ${location?.startsWith('/data-sources') ? 'bg-orange-50 text-orange-600 font-medium' : ''
                  }`}
                onClick={() => setIsMobileOpen(false)}
              >
                <Database className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0 ${location?.startsWith('/data-sources') ? 'text-orange-600' : ''}`} />
                <span className="truncate">Data Sources</span>
              </Link>
            </li>
          )}
        </ul>

      </nav>

      {/* User Profile & Footer Actions */}
      <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50/50">



        <div className="flex items-center p-2 sm:p-3 bg-white border border-gray-100 rounded-lg mb-3 shadow-sm">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-3 flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-blue-600 text-white text-xs sm:text-sm">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-gray-600 capitalize truncate">
              {user?.role || 'User'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full text-xs sm:text-sm touch-manipulation"
          onClick={handleLogout}
        >
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
          <span>Sign Out</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-3 left-3 z-50 bg-white shadow-md hover:bg-gray-50"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        bg-white w-64 sm:w-72 min-h-screen shadow-lg transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:relative
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed lg:static z-50 flex flex-col
      `}>
        {/* Mobile Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden absolute top-3 right-3 z-10 hover:bg-gray-100"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        <SidebarContent />
      </aside>
    </>
  );
}
