"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Snowfall from "react-snowfall";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";




export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const savedTheme = window.localStorage.getItem('theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleDarkMode = useCallback((value?: boolean) => {
    setDarkMode((prev) => (typeof value === 'boolean' ? value : !prev));
  }, []);
  const sidebarWidth = sidebarCollapsed ? '5rem' : '16rem';
  return (
    <div
      style={{
        backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Fsnowbg.webp?alt=media&token=1b3474b8-c42e-4792-a803-594d6d3ad954')`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="w-full h-screen bg-background/90">
        <Snowfall />
        <Header
          toggleSidebar={toggleSidebar}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
        <Sidebar
          isCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
        />
        <main
          className={`pt-16 transition-all duration-300 bg-white/20 dark:bg-gray-900/20`}
          style={{ marginLeft: sidebarWidth }}
        >
          <div className="p-6 pl-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
