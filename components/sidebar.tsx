'use client';
import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiHome,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiBriefcase,
  FiFileText,
  FiX,
  FiUser,
  FiTrash2,
  FiBarChart,
  FiUserCheck,
  FiClock,
  FiCalendar,
  FiUserPlus,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import CreateCompany from './createCompany';
import { AnimatePresence } from 'framer-motion';
import NewUser from './newUser';
import CreateClient from './createClient';


type SidebarProps = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
};

type MenuItem =
  | {
    type: 'item';
    icon: IconType;
    label: string;
    onClick?: () => void;
    href?: string;
  }
  | { type: 'divider' };

const Sidebar = ({ isCollapsed, toggleSidebar }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<string>('Dashboard');

  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const [userRole, setUserRole] = useState<string>('Guest');

  React.useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const userDataCookie = getCookie('userData');
    if (userDataCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataCookie));
        const roleMap: Record<number | string, string> = {
          0: 'SuperAdmin',
          1: 'Recruiter Admin',
          2: 'Lead Recruiter',
          3: 'Recruiter'
        };
        const rawRole = userData.role;
        const normalizedRole = typeof rawRole === 'number' ? roleMap[rawRole] : rawRole;
        setUserRole(normalizedRole || 'Guest');
      } catch (error) {
        console.error('Error parsing userData cookie in Sidebar:', error);
      }
    }
  }, []);

  const menuItems = useMemo<MenuItem[]>(() => {
    const base: MenuItem[] = [
      { type: 'item', icon: FiHome, label: 'Dashboard', href: '/admin' },
      ...(userRole === 'SuperAdmin' ? [{ type: 'item', icon: FiPlus, label: 'Add New Company', onClick: () => setShowAddCompanyModal(true) } as const] : []),
      ...(['SuperAdmin', 'Recruiter Admin', 'Lead Recruiter'].includes(userRole) ? [{ type: 'item', icon: FiUserPlus, label: 'Add New user', onClick: () => setShowAddUserModal(true) } as const] : []),
      ...(userRole !== 'SuperAdmin' ? [{ type: 'item', icon: FiBriefcase, label: 'Create New Clients', onClick: () => setShowAddClientModal(true) } as const] : []),
      ...(userRole === 'SuperAdmin' ? [{ type: 'item', icon: FiUser, label: 'Interviewers', href: '/admin/interviewers' } as const] : []),
      { type: 'divider' },
      ...(userRole !== 'Recruiter' ? [{ type: 'item', icon: FiUsers, label: 'Recruiters', href: '/admin/recruiters' } as const] : []),
      { type: 'item', icon: FiBriefcase, label: 'Active Clients', href: '/admin/clients' },
      { type: 'item', icon: FiUsers, label: 'Active Vendors', href: '/admin/vendors' },
      { type: 'item', icon: FiFileText, label: 'All Jobs', href: '/admin/jobs' },
      { type: 'item', icon: FiUser, label: 'All Candidates', href: '/admin/allcandidates' },
      { type: 'item', icon: FiCalendar, label: 'Scheduled Candidates', href: '/admin/scheduled' },
      { type: 'item', icon: FiClock, label: 'Interview In Review', href: '/admin/interviewreview' },
      { type: 'item', icon: FiUserCheck, label: 'Interviewed Candidates', href: '/admin/interviewedcand' },
      { type: 'item', icon: FiTrash2, label: 'Trash Candidates', href: '/admin/trash' },
      { type: 'item', icon: FiBarChart, label: 'Reports', href: '/admin/reports' },
    ];

    return base;
  }, [userRole]);

  React.useEffect(() => {
    // Set active item based on current path
    const currentItem = menuItems.find(item => {
      if (item.type !== 'item' || !item.href) return false;
      if (item.href === pathname) return true;
      if (item.href !== '/admin' && pathname.startsWith(item.href)) return true;
      return false;
    });

    if (currentItem && currentItem.type === 'item') {
      setActive(currentItem.label);
    }
  }, [pathname, menuItems]);

  return (
    <>
      <aside className={`fixed left-0 top-[77px] h-[calc(100vh-4rem)] transition-all duration-300 z-40 
        bg-gray-900 border-r border-gray-800 mt-2
        flex flex-col
        ${isCollapsed ? 'w-28' : 'w-80'}`}
      >
        {/* Logo Section */}
        <div className="flex-shrink-0 h-16 flex items-center justify-between px-4 border-b border-gray-800 my-4">
          <div className="flex items-center justify-center w-full">
            {isCollapsed ? (
              <Image
                src="/assets/logo/logo-small.png"
                alt="Logo Icon"
                width={32}
                height={32}
                className="rounded-lg"
              />
            ) : (
              <div className="flex items-center space-x-3">
                <Image
                  src="/assets/logo/logo.png"
                  alt="Full Logo"
                  width={160}
                  height={32}
                  className="rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Menu Items */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
          <div className="px-3 py-6">
            <div className="space-y-1">
              {menuItems.map((item, idx) => {
                if (item.type === 'divider') {
                  return <div key={`divider-${idx}`} className="my-2 border-t border-gray-700" />;
                }

                const Icon = item.icon;
                const isActive = active === item.label;

                return (
                  <button
                    key={`${item.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (item.href) {
                        router.push(item.href);
                      }
                      item.onClick?.();
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 group
                      ${isCollapsed ? 'justify-center' : 'space-x-4'}
                      ${isActive ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800'}
                    `}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-300'}`} />
                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Collapse Button - Outside of scrollable area */}
        <div className="flex-shrink-0 relative h-16">
          <button
            onClick={toggleSidebar}
            className={`absolute bottom-4 right-0 transform translate-x-1/2 
              w-8 h-8 rounded-full flex items-center justify-center
              bg-gray-800 text-gray-300
              hover:bg-gray-700
              transition-colors duration-200 border border-gray-700`}
          >
            {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </div>
      </aside>

      {showAddCompanyModal ? (
        <AnimatePresence>
          <CreateCompany onClose={() => setShowAddCompanyModal(false)} />
        </AnimatePresence>
      ) : null}

      {showAddUserModal ? (
        <AnimatePresence>
          <NewUser onClose={() => setShowAddUserModal(false)} />
        </AnimatePresence>
      ) : null}

      {showAddClientModal ? (
        <AnimatePresence>
          <CreateClient onClose={() => setShowAddClientModal(false)} />
        </AnimatePresence>
      ) : null}


    </>
  );
};

export default Sidebar;