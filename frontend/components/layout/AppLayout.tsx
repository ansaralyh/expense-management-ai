'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import AuthGuard from '../auth/AuthGuard';
import CommandCenter from '../CommandCenter';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <AuthGuard>
      <div className="h-screen bg-slate-950 text-slate-100 flex font-sans overflow-hidden">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0 h-screen overflow-hidden">
          <Header setSidebarOpen={setSidebarOpen} />
          <main ref={mainRef} className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            {children}
          </main>
        </div>
        <CommandCenter />
      </div>
    </AuthGuard>
  );
}
