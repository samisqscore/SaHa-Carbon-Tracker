import { Bell, Settings } from "lucide-react";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  className?: string;
}

export default function Header({ title, subtitle, action, className }: HeaderProps) {
  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 p-3 sm:p-4 lg:p-6 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className="ml-12 lg:ml-0 min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 truncate">{title}</h2>
            <p className="text-sm sm:text-base text-gray-600 truncate hidden sm:block">{subtitle}</p>
          </div>
        </div>

        <div className="hidden md:block">
          <OrganizationSwitcher />
        </div>

        {action}

        {/* Notifications - Coming Soon */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 touch-manipulation hidden sm:flex">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Notifications coming soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Global/Org Settings */}
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 touch-manipulation hidden sm:flex">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </Link>
      </div>
      {/* Mobile subtitle */}
      <div className="sm:hidden mt-1">
        <p className="text-sm text-gray-600 truncate">{subtitle}</p>
      </div>
    </header>
  );
}
