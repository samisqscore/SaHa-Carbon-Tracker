/**
 * @file PendingApproval.tsx
 * @description Account Status Page.
 * Informed users that their account has been created but awaits administrator approval.
 * 
 * @functionality
 * - Information Display: Explains security review process.
 * - Logout Action: Allows user to sign out while waiting.
 * 
 * @dependencies
 * - API: Calls /api/logout for sign out.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, Shield, LogOut, Leaf } from "lucide-react";

export default function PendingApproval() {
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* Application Branding */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">SaHa</span>
          </div>

          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <CardTitle className="text-xl font-semibold">Account Pending Approval</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Your account has been created successfully and is currently awaiting admin approval.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Security Review</span>
            </div>
            <p className="text-sm text-blue-700">
              All new accounts require administrator approval to ensure platform security and compliance.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <Mail className="w-4 h-4" />
              <span className="text-sm">You'll receive an email notification once approved</span>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <p className="text-xs text-gray-500">
              Questions? Contact your system administrator for assistance.
            </p>

            {/* Logout Button */}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}