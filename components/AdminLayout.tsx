"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Globe,
  CreditCard,
  Sparkles,
  Image as ImageIcon,
  Receipt,
  BarChart3,
  Settings,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  userRole?: string;
  adminName?: string;
  title?: string;
}

export function AdminLayout({ children, userRole = "admin", adminName = "Admin", title }: AdminLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Websites", href: "/admin/websites", icon: Globe },
    { name: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
    { name: "AI Credits", href: "/admin/credits", icon: Sparkles },
    { name: "Media Assets", href: "/admin/media", icon: ImageIcon },
    { name: "Transactions", href: "/admin/transactions", icon: Receipt },
    { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-2xs">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                A
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">Admin Console</h2>
                <span className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider block">
                  SaaS Control Panel
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-purple-600" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-3 px-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="truncate">
              <span className="text-xs font-bold text-slate-900 block truncate">{adminName}</span>
              <span className="text-[10px] font-extrabold text-purple-700 uppercase">
                {userRole === "super_admin" ? "Super Admin" : "Administrator"}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="w-full py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Main App</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            {title && <h1 className="text-sm font-bold text-slate-900 border-r border-slate-200 pr-3">{title}</h1>}
            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <span>🧪</span> Test Billing Mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 transition-all"
            >
              Open Site Builder ↗
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
