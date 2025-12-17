'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiUser, FiSun, FiMoon, FiChevronDown, FiClock, FiCalendar } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logout } from '@/lib/auth';

type HeaderProps = {
  toggleSidebar: () => void;
  darkMode: boolean;
  toggleDarkMode: (value?: boolean) => void;
};

type Company = {
  id: string;
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

const Header = ({ toggleSidebar, darkMode, toggleDarkMode }: HeaderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [companies] = useState<Company[]>([{ id: 'all', name: 'All' }]);
  const [selectedCompany, setSelectedCompany] = useState<Company>({ id: 'all', name: 'All' });
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfileModal, setShowProfileModal] = useState(false);

  const role = 'Super Admin';

  // Add this useEffect at the beginning of other useEffects
  useEffect(() => {
    // Check if user prefers dark mode
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Get theme from localStorage or use system preference
    const savedTheme = localStorage.getItem('theme');
    const initialDarkMode = savedTheme ? savedTheme === 'dark' : systemPrefersDark;
    
    // Call the toggleDarkMode with the initial value
    toggleDarkMode(initialDarkMode);

    // Optional: Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        toggleDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [toggleDarkMode]);

  // Add useEffect to listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Get userData from cookie
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
        };

        const userDataCookie = getCookie('userData');
        let userData = {
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email,
          avatar: currentUser.photoURL,
          role: 'User',
          company: null
        };

        if (userDataCookie) {
          try {
            const cookieData = JSON.parse(decodeURIComponent(userDataCookie));
            userData = {
              ...userData,
              name: cookieData.name || userData.name,
              role: cookieData.role || 'User',
              company: cookieData.company || null,
            };
          } catch (error) {
            console.error('Error parsing userData cookie:', error);
          }
        }

        // Store the Firebase user with metadata
        const finalUserData: HeaderUser = {
          ...userData,
          metadata: currentUser.metadata,
          createdAt: currentUser.metadata?.creationTime ? new Date(currentUser.metadata.creationTime) : null,
        };

        setUser(finalUserData);
        
        // Set company for non-SuperAdmin users
        if (userData.role !== 'SuperAdmin' && userData.company && typeof userData.company === 'object') {
          const company = userData.company as Partial<Company>;
          if (company.id && company.name) {
            setSelectedCompany({ id: company.id, name: company.name });
          }
        }
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Add useEffect for click outside handler
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


  // Add this useEffect to fetch user data from cookie
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

  // Add this new useEffect to update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update the formatTime helper function for better formatting
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
        {/* Left side */}
        <div className="flex items-center flex-1">
          <button
            onClick={toggleSidebar}
            className={`p-2.5 rounded-xl transition-colors duration-200 ${
              darkMode 
                ? 'hover:bg-gray-800 text-gray-300 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiMenu className="h-5 w-5" />
          </button>
          
          <div className="ml-6 flex-1">
            <div className="flex items-center space-x-8">
              {/* Enhanced Greeting Section */}
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {getGreeting()}
                </span>
                <span className={`text-sm font-medium ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Welcome back, Username
                </span>
              </div>

              {/* Compact DateTime and Info Section */}
              <div className="flex items-center space-x-3">
                {/* Date & Time Group */}
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-800/50 text-gray-200' 
                    : 'bg-gray-50/80 text-gray-700'
                }`}>
                  {/* Date */}
                  <div className="flex items-center">
                    <FiCalendar className={`h-3.5 w-3.5 ${
                      darkMode ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                    <span className="ml-1.5 text-sm font-medium">
                      {new Date().toLocaleDateString('en-US', { 
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  
                  {/* Separator */}
                  <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                  
                  {/* Time */}
                  <div className="flex items-center">
                    <FiClock className={`h-3.5 w-3.5 ${
                      darkMode ? 'text-purple-400' : 'text-purple-500'
                    }`} />
                    <div className="ml-2 flex items-baseline">
                      {/* Hours, Minutes, and Seconds */}
                      <div className="flex items-baseline text-base font-semibold tabular-nums">
                        <span>{formatTime(currentTime).main}</span>
                        <span className={
                          darkMode ? 'text-purple-400/90' : 'text-purple-500/90'
                        }>:{formatTime(currentTime).seconds}</span>
                      </div>
                      
                      {/* AM/PM */}
                      <span className={`ml-1 text-[10px] font-medium uppercase tracking-wide ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {formatTime(currentTime).ampm}
                      </span>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                  
                  {/* User Role */}
                  <div className="flex items-center">
                    <FiUser className={`h-3.5 w-3.5 ${
                      darkMode ? 'text-green-400' : 'text-green-500'
                    }`} />
                    <span className="ml-1.5 text-sm font-medium">
                      Super Admin
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Company Selector (Only visible for SuperAdmin) */}
        {role === 'Super Admin' && (
          <div className="relative mx-4">
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors duration-200 ${
                darkMode
                  ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-750'
                  : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-w-[200px]`}
            >
              <span className="font-medium">{selectedCompany.name}</span>
              <FiChevronDown className={`ml-2 transform transition-transform duration-200 ${
                showCompanyDropdown ? 'rotate-180' : ''
              }`} />
            </button>

            {showCompanyDropdown && (
              <div className={`absolute mt-2 w-full rounded-lg shadow-lg border ${
                darkMode
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}>
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowCompanyDropdown(false);
                      
                      // Dispatch custom event for company change
                      const event = new CustomEvent('companyChanged', { 
                        detail: company 
                      });
                      window.dispatchEvent(event);
                    }}
                    className={`w-full text-left px-4 py-3 first:rounded-t-lg last:rounded-b-lg transition-colors duration-200 ${
                      darkMode
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
            className={`p-2.5 rounded-xl transition-colors duration-200 ${
              darkMode 
                ? 'hover:bg-gray-800 text-gray-300 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {darkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
          </button>
          
          
          <div className="relative pl-2" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center space-x-3 p-2 rounded-xl transition-colors duration-200 ${
                darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              }`}
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
                <span className='text-white text-sm font-semibold'>
                    SA
                </span>
              </div>
              <span className={`hidden md:block font-medium ${
                darkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Super Admin
              </span>
            </button>
            
            {showProfile && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-lg py-2 border ${
                darkMode 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-white border-gray-100'
              }`}>
                <div className={`px-4 py-3 border-b ${
                  darkMode ? 'border-gray-800' : 'border-gray-100'
                }`}>
                  <div className={`font-medium ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Super Admin
                  </div>
                  <div className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    superadmin@rekrooot.com
                  </div>
                </div>
                {/* Profile menu items */}
                <div className="py-1">
                  {['Profile'].map((item) => (
                    <a
                      key={item}
                      href="#"
                      onClick={handleProfileClick}
                      className={`block px-4 py-2 text-sm transition-colors duration-200 ${
                        darkMode 
                          ? 'text-gray-300 hover:bg-gray-800' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item}
                    </a>
                  ))}
                  <button 
                    onClick={handleLogout}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      darkMode 
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
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
                    SA
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    UserName
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    demouser@gmial.com
                  </p>
                </div>
              </div>


              {/* User Details */}
              <div className="border-t dark:border-gray-700 pt-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Super Admin
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Demo Company
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