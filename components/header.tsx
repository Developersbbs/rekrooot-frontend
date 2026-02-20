'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiUser, FiSun, FiMoon, FiChevronDown, FiClock, FiCalendar } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logout } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type HeaderProps = {
  toggleSidebar: () => void;
  darkMode: boolean;
  toggleDarkMode: (value?: boolean) => void;
};

type Company = {
  id: string;
  name: string;
};

type CompanyDto = {
  _id: string;
  name: string;
};

type HeaderUser = {
  name: string;
  email: string | null;
  avatar: string | null;
  role: string;
  company: Company | null;
  createdAt?: Date | null;
  metadata?: unknown;
};

const roleMap: Record<number, string> = {
  0: 'SuperAdmin',
  1: 'Recruiter Admin',
  2: 'Lead Recruiter',
  3: 'Recruiter'
};

const Header = ({ toggleSidebar, darkMode, toggleDarkMode }: HeaderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [companies, setCompanies] = useState<Company[]>([{ id: 'all', name: 'All' }]);
  const [selectedCompany, setSelectedCompany] = useState<Company>({ id: 'all', name: 'All' });
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Derived role from user state
  const role = user?.role || 'Guest';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Try to get userData from cookie for fast load
          const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
          };

          let userData: any = null;
          const userDataCookie = getCookie('userData');

          if (userDataCookie) {
            try {
              userData = JSON.parse(decodeURIComponent(userDataCookie));

              if (!userData.id && !userData._id && !userData.firebase_uid) {
                userData = null;
              } else if (userData.company && typeof userData.company === 'object') {
                userData.company = {
                  id: userData.company.id || '',
                  name: userData.company.name || 'Unknown Company'
                };
              }
            } catch (e) {
              console.warn("Invalid cookie data", e);
              userData = null;
            }
          }

          // 2. If no cookie or invalid, fetch from API
          if (!userData) {
            const token = await currentUser.getIdToken();
            const res = await apiFetch<{ user: any }>('/auth/me', { token });
            if (res && res.user) {
              userData = res.user;

              if (typeof userData.role === 'number') {
                userData.role = roleMap[userData.role] || 'User';
              }

              if (userData.company_id && typeof userData.company_id === 'object') {
                userData.company = {
                  id: userData.company_id._id,
                  name: userData.company_id.name
                };
              } else if (userData.company_id) {
                // Fallback if not populated (though we just updated backend to populate)
                userData.company = { id: userData.company_id, name: 'My Company' };
              }

              userData.name = userData.username || userData.display_name || userData.email?.split('@')[0];
            }
          }

          if (userData) {
            const finalUserData: HeaderUser = {
              name: userData.name || userData.username || 'User',
              email: userData.email,
              avatar: currentUser.photoURL || null,
              role: userData.role,
              company: userData.company || null,
              metadata: currentUser.metadata,
              createdAt: currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime) : null,
            };

            setUser(finalUserData);

            // Set selected company if applicable
            if (finalUserData.role !== 'SuperAdmin' && finalUserData.company) {
              setSelectedCompany(finalUserData.company);
              localStorage.setItem('selectedCompany', JSON.stringify(finalUserData.company));
            }

            // Update cookie if we fetched fresh data
            if (!userDataCookie) {
              const cookieVal = JSON.stringify({
                _id: userData._id,
                id: userData._id,
                firebase_uid: userData.firebase_uid || currentUser.uid,
                name: finalUserData.name,
                email: finalUserData.email,
                role: finalUserData.role,
                company: finalUserData.company,
                contact: userData.contact || userData.phone_number
              });
              document.cookie = `userData=${encodeURIComponent(cookieVal)}; path=/; max-age=86400`;
            }
          }
        } catch (error) {
          console.error("Error fetching user details", error);
          // Fallback to basic firebase info
          setUser({
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email,
            avatar: currentUser.photoURL || null,
            role: 'User',
            company: null
          });
        }
      } else {
        setUser(null);
        // Clear cookie
        document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync selected company from localStorage on mount
  useEffect(() => {
    if (role === 'SuperAdmin') {
      const savedCompany = localStorage.getItem('selectedCompany');
      if (savedCompany) {
        try {
          const company = JSON.parse(savedCompany);

          // Validate company ID format
          const isValidId = company.id === 'all' || /^[0-9a-fA-F]{24}$/.test(company.id);

          if (isValidId) {
            setSelectedCompany(company);
            // Notify other components after a short delay to ensure they are mounted
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('companyChanged', { detail: company }));
            }, 100);
          } else {
            // Invalid ID found, reset to All
            console.warn('Invalid company ID in localStorage, resetting to All');
            const defaultCompany = { id: 'all', name: 'All' };
            setSelectedCompany(defaultCompany);
            localStorage.setItem('selectedCompany', JSON.stringify(defaultCompany));
            // Also clear the cookie
            document.cookie = 'selectedCompany=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
          }
        } catch (e) {
          console.error("Failed to parse saved company", e);
        }
      }
    }
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanies() {
      // Only Super Admin can load all companies
      if (role !== 'SuperAdmin') return;
      if (!auth.currentUser) return;

      const token = await auth.currentUser.getIdToken();

      try {
        const res = await apiFetch<{ companies: CompanyDto[] }>('/companies', { token });
        if (cancelled) return;

        const list: Company[] = [
          { id: 'all', name: 'All' },
          ...(res.companies || []).map((c) => ({ id: c._id, name: c.name })),
        ];

        setCompanies(list);
      } catch {
        if (cancelled) return;
        setCompanies([{ id: 'all', name: 'All' }]);
      }
    }

    if (role === 'SuperAdmin') {
      void loadCompanies();
      const handleCompaniesUpdated = () => void loadCompanies();
      window.addEventListener('companiesUpdated', handleCompaniesUpdated);
      return () => {
        cancelled = true;
        window.removeEventListener('companiesUpdated', handleCompaniesUpdated);
      };
    }

    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (profileRef.current && target && !profileRef.current.contains(target)) {
        setShowProfile(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const handleProfileClick = () => {
    setShowProfile(false);
    setShowProfileModal(true);
  };

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getGreeting = () => {
    const now = new Date();
    const hours = now.getHours();

    if (hours < 12) {
      return 'Good Morning';
    } else if (hours < 18) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;

    return {
      main: `${formattedHours}:${String(minutes).padStart(2, '0')}`,
      seconds: String(seconds).padStart(2, '0'),
      ampm
    };
  };

  return (
    <header className={`${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} 
      border-b fixed w-full top-0 z-30 shadow-sm`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center flex-1">
          <button
            onClick={toggleSidebar}
            className={`p-2.5 rounded-xl transition-colors duration-200 ${darkMode
              ? 'hover:bg-gray-800 text-gray-300 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
          >
            <FiMenu className="h-5 w-5" />
          </button>

          <div className="ml-6 flex-1">
            <div className="flex items-center space-x-8">
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {getGreeting()}
                </span>
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  Welcome back, {user?.name || 'User'}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${darkMode
                  ? 'bg-gray-800/50 text-gray-200'
                  : 'bg-gray-50/80 text-gray-700'
                  }`}>
                  <div className="flex items-center">
                    <FiCalendar className={`h-3.5 w-3.5 ${darkMode ? 'text-blue-400' : 'text-blue-500'
                      }`} />
                    <span className="ml-1.5 text-sm font-medium">
                      {new Date().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

                  <div className="flex items-center">
                    <FiClock className={`h-3.5 w-3.5 ${darkMode ? 'text-purple-400' : 'text-purple-500'
                      }`} />
                    <div className="ml-2 flex items-baseline">
                      <div className="flex items-baseline text-base font-semibold tabular-nums">
                        <span>{formatTime(currentTime).main}</span>
                        <span className={
                          darkMode ? 'text-purple-400/90' : 'text-purple-500/90'
                        }>:{formatTime(currentTime).seconds}</span>
                      </div>

                      <span className={`ml-1 text-[10px] font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {formatTime(currentTime).ampm}
                      </span>
                    </div>
                  </div>

                  <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

                  <div className="flex items-center">
                    <FiUser className={`h-3.5 w-3.5 ${darkMode ? 'text-green-400' : 'text-green-500'
                      }`} />
                    <span className="ml-1.5 text-sm font-medium">
                      {user?.role || 'Guest'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {role === 'SuperAdmin' && (
          <div className="relative mx-4">
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors duration-200 ${darkMode
                ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-750'
                : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-w-[200px]`}
            >
              <span className="font-medium">{selectedCompany.name}</span>
              <FiChevronDown className={`ml-2 transform transition-transform duration-200 ${showCompanyDropdown ? 'rotate-180' : ''
                }`} />
            </button>

            {showCompanyDropdown && (
              <div className={`absolute mt-2 w-full rounded-lg shadow-lg border ${darkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
                }`}>
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowCompanyDropdown(false);

                      // Persist selection
                      localStorage.setItem('selectedCompany', JSON.stringify(company));

                      // Dispatch custom event for company change
                      const event = new CustomEvent('companyChanged', {
                        detail: company
                      });
                      window.dispatchEvent(event);
                    }}
                    className={`w-full text-left px-4 py-3 first:rounded-t-lg last:rounded-b-lg transition-colors duration-200 ${darkMode
                      ? 'hover:bg-gray-700 text-gray-200'
                      : 'hover:bg-gray-50 text-gray-700'
                      } ${selectedCompany.id === company.id ?
                        (darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900')
                        : ''
                      }`}
                  >
                    <span className="font-medium">{company.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleDarkMode()}
            className={`p-2.5 rounded-xl transition-colors duration-200 ${darkMode
              ? 'hover:bg-gray-800 text-gray-300 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
          >
            {darkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
          </button>


          <div className="relative pl-2" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center space-x-3 p-2 rounded-xl transition-colors duration-200 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
                <span className='text-white text-sm font-semibold'>
                  {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                </span>
              </div>
              <span className={`hidden md:block font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                {user?.name || 'User'}
              </span>
            </button>

            {showProfile && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-lg py-2 border ${darkMode
                ? 'bg-gray-900 border-gray-800'
                : 'bg-white border-gray-100'
                }`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'
                  }`}>
                  <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    {user?.name || 'User'}
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    {user?.email || 'No email provided'}
                  </div>
                </div>
                {/* Profile menu items */}
                <div className="py-1">
                  {['Profile'].map((item) => (
                    <a
                      key={item}
                      href="#"
                      onClick={handleProfileClick}
                      className={`block px-4 py-2 text-sm transition-colors duration-200 ${darkMode
                        ? 'text-gray-300 hover:bg-gray-800'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {item}
                    </a>
                  ))}
                  <button
                    onClick={handleLogout}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${darkMode
                      ? 'text-red-400 hover:bg-gray-800'
                      : 'text-red-600 hover:bg-gray-50'
                      }`}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Profile Information</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile Picture */}
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {user?.name || 'User'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.email || 'No email provided'}
                  </p>
                </div>
              </div>


              {/* User Details */}
              <div className="border-t dark:border-gray-700 pt-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user?.role || 'Guest'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user?.company?.name || 'No Company'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                    <p className="font-medium text-gray-900 dark:text-white">4 days ago</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      today
                    </p>
                  </div>
                </div>
              </div>


            </div>

          </div>
        </div>
      )}
    </header>
  );
};

export default Header;