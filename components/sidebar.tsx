'use client';
import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import CreateCompany from './createCompany';
import { AnimatePresence } from 'framer-motion';
import NewUser from './newUser';



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
  const [active, setActive] = useState<string>('Dashboard');
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  // Sample role and menu for UI preview
  const userRole = 'SuperAdmin';

  const menuItems = useMemo<MenuItem[]>(() => {
    const base: MenuItem[] = [
      { type: 'item', icon: FiHome, label: 'Dashboard', href: '/admin' },
      ...(userRole === 'SuperAdmin'? [{ type: 'item', icon: FiPlus, label: 'Add New Company', onClick: () => setShowAddCompanyModal(true) } as const]: []),
      ...(userRole === 'SuperAdmin'? [{ type: 'item', icon: FiUser, label: 'Add New user', onClick: () => setShowAddUserModal(true) } as const]: []),
      ...(userRole !== 'SuperAdmin'? [{ type: 'item', icon: FiBriefcase, label: 'Create New Clients', onClick: () => setShowAddClientModal(true) } as const]: []),
      { type: 'item', icon: FiUser, label: 'Interviewers', href: '/admin/interviewers' },
      { type: 'divider' },
      { type: 'item', icon: FiUsers, label: 'Recruiters' },
      { type: 'item', icon: FiBriefcase, label: 'Clients' },
      { type: 'item', icon: FiFileText, label: 'Jobs' },
    ];

    return base;
  }, [userRole]);

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
                src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo-small.png?alt=media&token=7384e676-91ae-4097-b684-285bf631d666"
                alt="Logo Icon"
                width={32}
                height={32}
                className="rounded-lg"
              />
            ) : (
              <div className="flex items-center space-x-3">
                <Image
                  src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo.png?alt=media&token=0e681b04-04b6-4ebc-855e-dfcc3f9acabe"
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
                      setActive(item.label);
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
          <NewUser onClose={ () => setShowAddUserModal(false)} />
        </AnimatePresence>
      ) : null}

      {showAddClientModal ? (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddClientModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="text-base font-semibold text-gray-900 dark:text-white">Create Client (Sample)</div>
              <button type="button" onClick={() => setShowAddClientModal(false)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 text-sm text-gray-600 dark:text-gray-300">
              This is a UI preview modal. Hook it to your DB/API later.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Sidebar;