/**
 * @file Landing.tsx
 * @description Public Landing Page.
 * Serves as the entry point for unauthenticated users, showcasing features and providing login access.
 * 
 * @functionality
 * - Hero Section: Value proposition and CTA.
 * - Feature Highlights: Cards detailing key application capabilities.
 * - Login Action: Redirects to Google Auth endpoint (/api/auth/google).
 * 
 * @dependencies
 * - UI Components: Shadcn UI cards, buttons, etc.
 * - Lucide Icons: Visual assets.
 * 
 * @breaking-changes
 * - Auth Flow: Relies on backend redirection to Google OAuth; hardcoded URL '/api/auth/google'.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Leaf,
  Building,
  BarChart3,
  Users,
  Calculator,
  Download,
  Shield,
  Zap,
  TrendingDown,
  CheckCircle,
  ArrowRight,
  Globe,
  LayoutDashboard,
  FileSpreadsheet,
  FileText
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-700 p-2 rounded-lg">
                <Leaf className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">DMBoD</h1>
                <p className="text-xs text-gray-600">Decarbonize Embodied Emissions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = '/api/auth/google'}
              >
                Sign In with Google
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden">
        {/* Background CO2 Illustration */}
        <div className="absolute inset-0 opacity-10">
          <svg
            className="w-full h-full object-cover"
            viewBox="0 0 1200 600"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Construction buildings */}
            <rect x="100" y="300" width="80" height="200" fill="#6B7280" />
            <rect x="200" y="250" width="100" height="250" fill="#4B5563" />
            <rect x="320" y="280" width="90" height="220" fill="#6B7280" />

            {/* Construction cranes */}
            <line x1="150" y1="300" x2="150" y2="150" stroke="#374151" strokeWidth="4" />
            <line x1="150" y1="150" x2="220" y2="150" stroke="#374151" strokeWidth="3" />
            <line x1="250" y1="250" x2="250" y2="100" stroke="#374151" strokeWidth="4" />
            <line x1="250" y1="100" x2="320" y2="100" stroke="#374151" strokeWidth="3" />

            {/* CO2 Emissions - Rising bubbles/clouds */}
            <circle cx="140" cy="250" r="15" fill="#EF4444" opacity="0.6" />
            <circle cx="160" cy="220" r="20" fill="#EF4444" opacity="0.5" />
            <circle cx="180" cy="180" r="25" fill="#EF4444" opacity="0.4" />
            <circle cx="200" cy="140" r="30" fill="#EF4444" opacity="0.3" />

            <circle cx="240" cy="200" r="18" fill="#EF4444" opacity="0.6" />
            <circle cx="270" cy="160" r="23" fill="#EF4444" opacity="0.5" />
            <circle cx="300" cy="120" r="28" fill="#EF4444" opacity="0.4" />

            <circle cx="340" cy="230" r="16" fill="#EF4444" opacity="0.6" />
            <circle cx="370" cy="190" r="21" fill="#EF4444" opacity="0.5" />
            <circle cx="400" cy="150" r="26" fill="#EF4444" opacity="0.4" />

            {/* Factory smokestacks */}
            <rect x="600" y="350" width="40" height="150" fill="#4B5563" />
            <rect x="660" y="330" width="40" height="170" fill="#4B5563" />
            <rect x="720" y="340" width="40" height="160" fill="#4B5563" />

            {/* Smoke from smokestacks */}
            <circle cx="620" cy="320" r="12" fill="#9CA3AF" opacity="0.7" />
            <circle cx="635" cy="290" r="18" fill="#9CA3AF" opacity="0.6" />
            <circle cx="650" cy="250" r="24" fill="#9CA3AF" opacity="0.5" />
            <circle cx="665" cy="200" r="30" fill="#9CA3AF" opacity="0.4" />

            <circle cx="680" cy="300" r="14" fill="#9CA3AF" opacity="0.7" />
            <circle cx="695" cy="270" r="20" fill="#9CA3AF" opacity="0.6" />
            <circle cx="710" cy="230" r="26" fill="#9CA3AF" opacity="0.5" />

            <circle cx="740" cy="310" r="13" fill="#9CA3AF" opacity="0.7" />
            <circle cx="755" cy="280" r="19" fill="#9CA3AF" opacity="0.6" />
            <circle cx="770" cy="240" r="25" fill="#9CA3AF" opacity="0.5" />

            {/* CO2 molecules scattered */}
            <text x="500" y="100" fontSize="24" fill="#10B981" opacity="0.3" fontWeight="bold">CO₂</text>
            <text x="800" y="150" fontSize="20" fill="#10B981" opacity="0.3" fontWeight="bold">CO₂</text>
            <text x="900" y="200" fontSize="18" fill="#10B981" opacity="0.3" fontWeight="bold">CO₂</text>
            <text x="1000" y="120" fontSize="22" fill="#10B981" opacity="0.3" fontWeight="bold">CO₂</text>
            <text x="450" y="300" fontSize="16" fill="#10B981" opacity="0.3" fontWeight="bold">CO₂</text>

            {/* Construction materials */}
            <rect x="50" y="480" width="30" height="20" fill="#92400E" />
            <rect x="90" y="470" width="35" height="30" fill="#92400E" />
            <rect x="130" y="485" width="25" height="15" fill="#92400E" />
          </svg>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-6 bg-green-100 text-green-800 border-green-200">
            🌍 Build Sustainably. Measure What Matters.
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Carbon Footprint<br />
            <span className="text-green-600">Quantification</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            DMBoD helps architects, builders, and planners measure the carbon footprint
            of construction projects using EPD-backed emission factors aligned to EN 15804 lifecycle stages.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
              onClick={() => window.location.href = '/api/auth/google'}
            >
              Start Calculating Emissions
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-3"
            >
              Explore Features
            </Button>
          </div>
        </div>
      </section>

      {/* What is SaHa Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">What is DMBoD?</h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              <strong>DMBoD (Decarbonize Embodied Emissions)</strong> is a web application designed to quantify and track the
              <strong> carbon emissions</strong> of construction projects based on material usage and project scope.
              Whether you're an architect, estimator, builder, or sustainability consultant —
              <em> DMBoD</em> helps you make <strong>climate-conscious decisions</strong> right from the design table.
            </p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Core Features</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-blue-100 p-3 rounded-lg w-fit mb-4">
                  <Calculator className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Material Catalog with Real Emission Data</h3>
                <p className="text-gray-600">
                  Preloaded with data from ICE Database, editable for custom sources and accurate calculations.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">ICE Database Integration</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-green-100 p-3 rounded-lg w-fit mb-4">
                  <Zap className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Live Emissions Calculator</h3>
                <p className="text-gray-600">
                  Get instant CO₂ estimates for your projects as you add materials and update quantities.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">Real-time Updates</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-orange-100 p-3 rounded-lg w-fit mb-4">
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Role-Based Access</h3>
                <p className="text-gray-600">
                  Admins, Estimators, and Viewers — each get a tailored view with appropriate permissions.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">Secure Collaboration</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-purple-100 p-3 rounded-lg w-fit mb-4">
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Interactive Dashboard</h3>
                <p className="text-gray-600">
                  Visualize emissions by material type, category, or project phase with detailed analytics.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">Rich Visualizations</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-red-100 p-3 rounded-lg w-fit mb-4">
                  <Download className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Downloadable Reports</h3>
                <p className="text-gray-600">
                  Export insights as PDF or CSV for client sharing, audits, and compliance reporting.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">Multiple Formats</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="bg-indigo-100 p-3 rounded-lg w-fit mb-4">
                  <Shield className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Secure & Simple Sign-In</h3>
                <p className="text-gray-600">
                  Sign in securely with Google OAuth or use organization credentials via developer access.
                </p>
                <div className="mt-4">
                  <CheckCircle className="inline h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-600">Enterprise Security</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who Can Use Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Who Can Use DMBoD?</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { icon: Globe, title: "Urban Planners", color: "bg-blue-100 text-blue-600" },
              { icon: Building, title: "Construction Firms", color: "bg-orange-100 text-orange-600" },
              { icon: Calculator, title: "Architects & Engineers", color: "bg-green-100 text-green-600" },
              { icon: Users, title: "Students & Researchers", color: "bg-purple-100 text-purple-600" },
              { icon: TrendingDown, title: "Sustainability Officers", color: "bg-red-100 text-red-600" },
            ].map((item, index) => (
              <Card key={index} className="text-center p-6 border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className={`p-4 rounded-lg w-fit mx-auto mb-4 ${item.color}`}>
                    <item.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How SaHa Works (Product Tour Migration) */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">How DMBoD Works</h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              Go from BOQ to audit-ready report in <strong>3 simple steps</strong>.
            </p>
          </div>

          <div className="relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: LayoutDashboard,
                  title: "1. Setup Project",
                  desc: "Create your project and define context.",
                  color: "bg-blue-100 text-blue-600"
                },
                {
                  icon: FileSpreadsheet,
                  title: "2. Upload BOQ",
                  desc: "Upload Excel for instant material ingestion.",
                  color: "bg-green-100 text-green-600"
                },
                {
                  icon: FileText,
                  title: "3. Instant Report",
                  desc: "Get preliminary emissions report immediately.",
                  color: "bg-orange-100 text-orange-600"
                }
              ].map((step, index) => (
                <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group hover:-translate-y-1 transition-transform">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${step.color} group-hover:scale-110 transition-transform`}>
                    <step.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Measuring?</h2>
          <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Join architects and builders worldwide who are making data-driven decisions
            for a low-carbon future.
          </p>
          <Button
            size="lg"
            className="bg-white text-green-600 hover:bg-gray-100 text-lg px-8 py-3"
            onClick={() => window.location.href = '/api/auth/google'}
          >
            Start Calculating Emissions
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-green-100 mt-4 text-sm">
            Free to get started • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-emerald-700 p-2 rounded-lg">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">DMBoD</h3>
                  <p className="text-xs text-gray-400">Decarbonize Embodied Emissions</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                Built for a low-carbon future.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Stay Updated</h4>
              <p className="text-sm text-gray-400 mb-4">
                AI-powered material suggestions launching soon!
              </p>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
                Join Beta Program
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 DMBoD — Decarbonize Embodied Emissions. Built for a low-carbon future.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
