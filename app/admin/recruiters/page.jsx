'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { UserCircleIcon, UsersIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { toast } from 'react-hot-toast'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-primary-600 dark:text-primary-400 font-medium">Loading...</p>
    </div>
  </div>
);

const InfoItem = ({ icon, value, className }) => {
  const getIcon = () => {
    switch (icon) {
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'phone':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'company':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center gap-3 text-gray-600 dark:text-gray-300 ${className}`}>
      <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
        {getIcon()}
      </div>
      <span className="text-sm">{value}</span>
    </div>
  );
};

const RecruiterPage = () => {
  const router = useRouter();
  const [selectedRecruiter, setSelectedRecruiter] = useState(null)
  const [activeRegion, setActiveRegion] = useState('East')
  const [recruiters, setRecruiters] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [recruiterAdmin, setRecruiterAdmin] = useState(null)
  const [leadRecruiters, setLeadRecruiters] = useState([])
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)
  const [selectedLeadRecruiter, setSelectedLeadRecruiter] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [migrationLoading, setMigrationLoading] = useState(false)
  const [currentRecruiterId, setCurrentRecruiterId] = useState(null);

  const roleMap = {
    0: 'SuperAdmin',
    1: 'Recruiter Admin',
    2: 'Lead Recruiter',
    3: 'Recruiter'
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDataCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('userData='));

          if (userDataCookie) {
            try {
              const userData = JSON.parse(decodeURIComponent(userDataCookie.split('=')[1]));

              if (!userData.id && !userData._id && !userData.firebase_uid) {
                throw new Error("Old cookie format");
              }

              const mappedRole = typeof userData.role === 'number' ? roleMap[userData.role] : userData.role;

              setCurrentUser({
                ...userData,
                role: mappedRole,
                contact: userData.contact || userData.phone_number,
                firebase_uid: userData.firebase_uid || userData.uid,
                company_name: (typeof userData.company === 'object' && userData.company?.name)
                  ? userData.company.name
                  : (userData.company_name || userData.company || 'No Company')
              });
              setLoading(false);
              return;
            } catch (e) {
              console.warn('Cookie data invalid, fetching from API');
            }
          }

          const token = await firebaseUser.getIdToken();
          const res = await apiFetch('/auth/me', { token });

          if (res?.user) {
            const userData = res.user;
            const mappedRole = typeof userData.role === 'number' ? roleMap[userData.role] : userData.role;

            const appUser = {
              ...userData,
              role: mappedRole,
              contact: userData.contact || userData.phone_number || 'N/A',
              firebase_uid: userData.firebase_uid || userData.uid,
              company_name: (userData.company_id && typeof userData.company_id === 'object')
                ? userData.company_id.name
                : (userData.company_name || userData.company || 'SuperAdmin')
            };

            setCurrentUser(appUser);

            const cookieValue = JSON.stringify(appUser);
            document.cookie = `userData=${encodeURIComponent(cookieValue)}; path=/; max-age=86400`;
          }
        } catch (error) {
          console.error("Failed to fetch user data", error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const getInitialCompany = () => {
      try {
        const savedCompany = localStorage.getItem('selectedCompany');
        if (savedCompany) {
          setSelectedCompany(JSON.parse(savedCompany));
        }
      } catch (error) {
        console.error('Error getting selected company:', error);
      }
    };
    getInitialCompany();

    const handleCompanyChange = (event) => {
      setSelectedCompany(event.detail);
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  const companyIdForFetch = selectedCompany?.id || 'all';

  const fetchRecruitersData = useCallback(async (company = null) => {
    try {
      if (!auth.currentUser || !currentUser) return;

      const isInitialFetch = leadRecruiters.length === 0 && !recruiterAdmin;
      if (isInitialFetch) {
        setLoading(true);
      }

      const token = await auth.currentUser.getIdToken();
      let companyId = '';

      if (currentUser.role === 'SuperAdmin') {
        const targetCompany = company || selectedCompany;
        const isAll = !targetCompany || targetCompany.id === 'all' || targetCompany.name === 'All';

        if (!isAll) {
          companyId = targetCompany.id;
        }
      }

      const res = await apiFetch('/users' + (companyId ? `?company_id=${companyId}` : ''), { token });

      const roleMap = {
        0: 'SuperAdmin',
        1: 'Recruiter Admin',
        2: 'Lead Recruiter',
        3: 'Recruiter'
      };

      const allUsers = (res.users || []).map(user => ({
        ...user,
        id: user._id,
        uid: user.firebase_uid,
        role: roleMap[user.role] || 'Unknown',
        name: user.username || user.display_name || 'Unknown',
        region: user.recruiter_region || 'Global',
        phone_number: user.contact || user.phone_number || 'N/A',
        company_name: (user.company_id && typeof user.company_id === 'object')
          ? user.company_id.name
          : (user.company_name || 'No Company'),
      }));

      if (currentUser.role === 'Lead Recruiter') {
        const currentUId = currentUser.firebase_uid || currentUser.uid || currentUser._id || currentUser.id;
        const leadProfileInUsers = allUsers.find(u =>
          u.uid === currentUId || u.id === currentUId || u.firebase_uid === currentUId || u._id === currentUId
        );

        const leadData = leadProfileInUsers ? {
          ...leadProfileInUsers,
          recruiters: allUsers.filter(u => u.id !== leadProfileInUsers.id && u.lead_recruiter_id?.toString() === leadProfileInUsers.id?.toString()),
          recruitersByRegion: {
            East: allUsers.filter(u => u.lead_recruiter_id?.toString() === leadProfileInUsers.id?.toString() && u.region === 'East'),
            West: allUsers.filter(u => u.lead_recruiter_id?.toString() === leadProfileInUsers.id?.toString() && u.region === 'West'),
            North: allUsers.filter(u => u.lead_recruiter_id?.toString() === leadProfileInUsers.id?.toString() && u.region === 'North'),
            South: allUsers.filter(u => u.lead_recruiter_id?.toString() === leadProfileInUsers.id?.toString() && u.region === 'South')
          }
        } : null;

        setRecruiterAdmin(null);
        setLeadRecruiters(leadData ? [leadData] : []);
        setSelectedRecruiter(leadData);
      } else {
        const admin = allUsers.find(user => user.role === 'Recruiter Admin');
        const leads = allUsers.filter(user => user.role === 'Lead Recruiter');
        const recruiters = allUsers.filter(user => user.role === 'Recruiter');

        const processedLeads = leads.map(lead => {
          const leadRecruiters = recruiters.filter(recruiter =>
            recruiter.lead_recruiter_id?.toString() === lead.id?.toString() ||
            (recruiter.region === lead.region && recruiter.company_name === lead.company_name)
          );

          return {
            ...lead,
            recruiters: leadRecruiters,
            recruitersByRegion: {
              East: leadRecruiters.filter(r => r.region === 'East'),
              West: leadRecruiters.filter(r => r.region === 'West'),
              North: leadRecruiters.filter(r => r.region === 'North'),
              South: leadRecruiters.filter(r => r.region === 'South')
            }
          };
        });

        setRecruiterAdmin(admin || null);
        setLeadRecruiters(processedLeads);
        if (processedLeads.length > 0 && !selectedRecruiter) {
          setSelectedRecruiter(processedLeads[0]);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching recruiters:', error);
      setLoading(false);
    }
  }, [currentUser, companyIdForFetch]);

  useEffect(() => {
    if (currentUser) {
      fetchRecruitersData();
    }
  }, [currentUser, companyIdForFetch, fetchRecruitersData]);

  useEffect(() => {
    if (currentUser?.role === 'Lead Recruiter' && leadRecruiters.length > 0) {
      const leadProfile = leadRecruiters.find(lead => lead.id === currentUser.uid);
      if (leadProfile) {
        setSelectedRecruiter(leadProfile);
      }
    } else if (currentUser?.role !== 'Lead Recruiter' && leadRecruiters.length > 0) {
      // For SuperAdmin and Recruiter Admin, auto-select the first lead recruiter when company changes
      setSelectedRecruiter(leadRecruiters[0]);
    } else if (leadRecruiters.length === 0) {
      // Reset selected recruiter if no lead recruiters are available
      setSelectedRecruiter(null);
    }
  }, [currentUser, leadRecruiters]);

  const processRecruitersData = useCallback((data) => {
    if (!currentUser) return [];

    if (currentUser.role === 'Recruiter') {
      return data;
    }

    if (['SuperAdmin', 'Recruiter Admin'].includes(currentUser.role)) {
      const adminData = data.find(user => user.role === 'Recruiter Admin') || null;

      if (!adminData) return [];

      const leadRecruiters = data.filter(user => user.role === 'Lead Recruiter');

      const processedLeads = leadRecruiters.map(lead => ({
        ...lead,
        team: data.filter(user =>
          user.role === 'Recruiter' &&
          (user.lead_recruiter_id?.toString() === lead.id?.toString() || user.region === lead.region) &&
          user.company_name === lead.company_name
        )
      }));

      return [{
        ...adminData,
        team: processedLeads
      }];
    }

    if (currentUser.role === 'Lead Recruiter') {
      const leadData = data.find(user =>
        user.id === currentUser.uid ||
        user.uid === currentUser.uid ||
        user.id === currentUser._id ||
        user.firebase_uid === currentUser.firebase_uid
      );
      if (!leadData) return [];

      return [{
        ...leadData,
        team: data.filter(user =>
          user.role === 'Recruiter' &&
          (user.lead_recruiter_id?.toString() === leadData.id?.toString() || user.region === leadData.region) &&
          user.company_name === leadData.company_name
        )
      }];
    }

    return data;
  }, [currentUser]);

  const getMembersByRegion = useCallback((region) => {
    return selectedRecruiter?.team?.filter(member => member.region.includes(region)) || []
  }, [selectedRecruiter])

  const handleMigrateRecruiter = async () => {
    try {
      setMigrationLoading(true);

      if (!selectedLeadRecruiter || !selectedRegion || !currentRecruiterId) {
        throw new Error('Please select both lead recruiter and region');
      }

      if (!auth.currentUser) throw new Error('Not authenticated');
      const token = await auth.currentUser.getIdToken();

      await apiFetch(`/users/${currentRecruiterId}`, {
        method: 'PUT',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_recruiter_id: selectedLeadRecruiter,
          recruiter_region: selectedRegion
        })
      });

      // Reset states
      setIsMigrationModalOpen(false);
      setSelectedLeadRecruiter('');
      setSelectedRegion('');
      setCurrentRecruiterId(null);

      // Refresh the data
      await fetchRecruitersData();
    } catch (error) {
      console.error('Error migrating recruiter:', error);
      alert(error.message);
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleDeleteRecruiter = async (recruiterId, recruiterName, recruiterRole, firebaseUid) => {
    console.log('=== Delete Recruiter Debug ===');
    console.log('Attempting to delete:', { recruiterId, recruiterName, recruiterRole });

    // Check permissions based on current user role
    if (currentUser?.role === 'Lead Recruiter' && recruiterRole === 'Recruiter Admin') {
      alert('Lead Recruiters cannot delete Recruiter Admins. Only SuperAdmins can delete Recruiter Admins.');
      return;
    }

    // Check if recruiter is a Lead Recruiter or Recruiter Admin with team members
    // We can use the existing 'recruiters' or 'leadRecruiters' state for validation

    if (recruiterRole === 'Recruiter Admin') {
      // Check if there are any other users in the company
      // Since we fetched all users for the company, we can check if there are others.
      // Excluding self.
      const hasTeam = recruiters.some(r => r.id !== recruiterId) || leadRecruiters.some(l => l.id !== recruiterId);
      if (hasTeam) {
        alert(`Cannot delete ${recruiterName}. This admin has active team members. Please remove them first.`);
        return;
      }
    }

    if (recruiterRole === 'Lead Recruiter') {
      const lead = leadRecruiters.find(l => l.id === recruiterId);
      if (lead && lead.recruiters && lead.recruiters.length > 0) {
        alert(`Cannot delete ${recruiterName}. This user has ${lead.recruiters.length} active team members. Please reassign them first.`);
        return;
      }
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete ${recruiterName}? This action cannot be undone.`)) {
      return;
    }

    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const token = await auth.currentUser.getIdToken();

      await apiFetch(`/users/${recruiterId}`, {
        method: 'DELETE',
        token
      });

      if (firebaseUid) {
        try {
          await fetch('/api/deleteUser', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: firebaseUid }),
          });
        } catch (e) {
          console.warn("Failed to delete from Firebase Auth, but deleted from DB", e);
        }
      }

      toast.success(`Recruiter ${recruiterName} deleted successfully`);

      await fetchRecruitersData();

      if (selectedRecruiter?.id === recruiterId) {
        setSelectedRecruiter(null);
      }
    } catch (error) {
      console.error('Error deleting recruiter:', error);
      toast.error(`Failed to delete recruiter: ${error.message}`);
    }
  };

  const renderUserCard = (userData) => {
    console.log('Rendering user card for:', userData);

    // Recruiter Admin should see all users assigned to their company (already filtered by backend)

    if (currentUser.role === 'Lead Recruiter') {
      const uId = userData.uid || userData.firebase_uid || userData.id || userData._id;

      const currentMongoId = currentUser._id || currentUser.id;
      const currentFirebaseUid = currentUser.firebase_uid || currentUser.uid;

      const isLeadThemself = (uId === currentMongoId || uId === currentFirebaseUid);
      const isMemberOfLead = (userData.lead_recruiter_id?.toString() === currentMongoId?.toString());

      if (!isLeadThemself && !isMemberOfLead) {
        return null;
      }
    }

    const userId = userData._id || userData.id || userData.uid || userData.firebase_uid;

    if (!userId) {
      console.warn('Incomplete user data - skipping card render:', userData);
      return null;
    }

    const handleViewDetails = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        console.log('Clicking view details for user:', userData);
        console.log('User ID:', userId);
        if (userId) {
          const path = `/admin/recruiters/${userId}`;
          console.log('Navigating to:', path);
          router.push(path);
        } else {
          console.error('No valid ID found for navigation');
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    };

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 dark:from-primary-500/10 dark:to-accent-500/10" />

        {/* Role Badge and Action Buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${userData.role === 'Lead Recruiter'
            ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
            : 'bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300'
            }`}>
            {userData.role}
          </span>

          {/* View Details Button */}
          <button
            type="button"
            onClick={handleViewDetails}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/50 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 group relative cursor-pointer"
            title="View Details"
            style={{ zIndex: 20 }}
          >
            <div className="relative flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 transform group-hover:scale-110 transition-transform duration-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                pointerEvents="none"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>

              {/* Tooltip */}
              <span className="absolute -bottom-8 right-0 min-w-max px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                View Details
              </span>
            </div>
          </button>

          {/* Delete Button */}
          {!(currentUser?.role === 'Lead Recruiter' && userData.role === 'Recruiter Admin') && (
            <button
              type="button"
              onClick={() => handleDeleteRecruiter(userData.id, userData.name, userData.role, userData.uid)}
              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 group relative cursor-pointer"
              title="Delete Recruiter"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}

          {/* Migrate Button - Only show for Recruiters */}
          {userData.role === 'Recruiter' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentRecruiterId(userData.uid || userData.id);
                setIsMigrationModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/50 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 group relative cursor-pointer ml-2"
              title="Migrate Recruiter"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span className="absolute -bottom-8 right-0 min-w-max px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                Migrate Recruiter
              </span>
            </button>
          )}
        </div>

        <div className="relative p-6">
          {/* User Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 p-0.5">
                <div className="h-full w-full rounded-[calc(0.75rem-1px)] bg-white dark:bg-gray-800 flex items-center justify-center">
                  <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary-500 to-accent-500">
                    {userData.name[0]}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {userData.name}
              </h3>
              {userData.region && userData.region !== 'Global' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {userData.region} Region
                </p>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 group/item">
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover/item:bg-primary-50 dark:group-hover/item:bg-primary-900/20 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm truncate flex-1">{userData.email}</span>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 group/item">
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover/item:bg-primary-50 dark:group-hover/item:bg-primary-900/20 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-sm truncate flex-1">{userData.phone_number}</span>
            </div>

            {/* Company */}
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 group/item">
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover/item:bg-primary-50 dark:group-hover/item:bg-primary-900/20 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-sm truncate flex-1">{userData.company_name}</span>
            </div>
          </div>

          {/* Additional Info - Only for Lead Recruiters */}
          {userData.role === 'Lead Recruiter' && userData.recruiters && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Team Size</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {userData.recruiters.length} Recruiter{userData.recruiters.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Hover Effect Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
      </div>
    );
  };

  const renderAdminCard = () => {
    if (!recruiterAdmin) return null;

    return (
      <div className="transform hover:scale-[1.01] transition-transform duration-200">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          {/* Gradient Border */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 opacity-10" />

          {/* Delete Button - Top Right */}
          {!(currentUser?.role === 'Lead Recruiter' && recruiterAdmin.role === 'Recruiter Admin') && (
            <button
              type="button"
              onClick={() => handleDeleteRecruiter(recruiterAdmin.id, recruiterAdmin.name, recruiterAdmin.role, recruiterAdmin.uid)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 z-10"
              title="Delete Recruiter Admin"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}

          {/* Content */}
          <div className="relative p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 p-1">
                  <div className="h-full w-full rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center">
                    <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary-500 to-accent-500">
                      {recruiterAdmin.name[0]}
                    </span>
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg">
                  Admin
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {recruiterAdmin.name}
                </h2>
                <p className="text-primary-600 dark:text-primary-400 font-medium">
                  Recruiter Admin
                </p>

                {/* Contact Info */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoItem
                    icon="email"
                    value={recruiterAdmin.email}
                    className="bg-gray-50 dark:bg-gray-700/50"
                  />
                  <InfoItem
                    icon="phone"
                    value={recruiterAdmin.phone_number}
                    className="bg-gray-50 dark:bg-gray-700/50"
                  />
                  <InfoItem
                    icon="company"
                    value={recruiterAdmin.company_name}
                    className="bg-gray-50 dark:bg-gray-700/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLeadsList = () => (
    <div className="lg:w-80 shrink-0">
      <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-500/10 to-accent-500/10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Lead Recruiters
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {leadRecruiters.length} Lead Recruiter{leadRecruiters.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* List */}
        <div className="p-4">
          <nav className="space-y-2">
            {leadRecruiters.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setSelectedRecruiter(lead)}
                className={`w-full p-4 rounded-xl transition-all duration-200 flex items-center gap-4 ${selectedRecruiter?.id === lead.id
                  ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                  }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 ${selectedRecruiter?.id === lead.id
                  ? 'bg-white/20'
                  : 'bg-primary-50 dark:bg-gray-700 group-hover:bg-white/80 dark:group-hover:bg-gray-600'
                  }`}>
                  <span className="text-lg font-semibold">{lead.name[0]}</span>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedRecruiter?.id === lead.id
                      ? 'bg-white/20'
                      : 'bg-primary-100 dark:bg-gray-700'
                      }`}>
                      {lead.region}
                    </span>
                    <span className={`text-xs ${selectedRecruiter?.id === lead.id
                      ? 'text-white/80'
                      : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      {lead.recruiters?.length || 0} Recruiter{lead.recruiters?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <ChevronRightIcon className={`w-5 h-5 transition-transform duration-200 ${selectedRecruiter?.id === lead.id ? 'rotate-90' : ''
                  }`} />
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );

  const renderRegionTabs = () => null; // Region tabs removed - showing all members together

  const renderSelectedLeadView = () => {
    if (!selectedRecruiter) {
      return (
        <div className="flex-1 flex items-center justify-center h-[calc(100vh-12rem)]">
          <div className="text-center">
            <UsersIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Select a Lead Recruiter
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Choose a lead recruiter from the list to view their team details
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {renderUserCard(selectedRecruiter)}

        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span>Team Members</span>
            {selectedRecruiter.recruiters && selectedRecruiter.recruiters.length > 0 && (
              <span className="px-2 py-0.5 bg-primary-100 dark:bg-gray-800 text-primary-600 dark:text-primary-400 rounded-full text-sm">
                {selectedRecruiter.recruiters.length} member{selectedRecruiter.recruiters.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {selectedRecruiter.recruiters && selectedRecruiter.recruiters.length > 0 ? (
              selectedRecruiter.recruiters.map(recruiter =>
                <div key={recruiter.id} className="h-full">
                  {renderUserCard(recruiter)}
                </div>
              )
            ) : (
              <div className="col-span-full py-12 text-center">
                <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <UserCircleIcon className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  No Team Members
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  There are no recruiters in this team yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const MigrationModal = () => (
    <Transition appear show={isMigrationModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setIsMigrationModalOpen(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Migrate Recruiter
                </Dialog.Title>

                <div className="mt-4 space-y-4">
                  {/* Lead Recruiter Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Lead Recruiter
                    </label>
                    <select
                      value={selectedLeadRecruiter}
                      onChange={(e) => setSelectedLeadRecruiter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Lead Recruiter</option>
                      {leadRecruiters
                        .filter(lead => lead.role === 'Lead Recruiter')
                        .map(lead => (
                          <option key={lead.id} value={lead.id}>
                            {lead.display_name || lead.name} ({lead.region} Region)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Region Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Region
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Region</option>
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    onClick={() => {
                      setIsMigrationModalOpen(false);
                      setSelectedLeadRecruiter('');
                      setSelectedRegion('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`inline-flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${!selectedLeadRecruiter || !selectedRegion || migrationLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700'
                      }`}
                    onClick={handleMigrateRecruiter}
                    disabled={!selectedLeadRecruiter || !selectedRegion || migrationLoading}
                  >
                    {migrationLoading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Migrating...
                      </div>
                    ) : (
                      'Migrate'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (currentUser?.role === 'Lead Recruiter' && selectedRecruiter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="p-8 pt-24">
          <div className="max-w-[1920px] mx-auto">
            {/* Page Header */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600 text-center">
                My Team Structure
              </h1>
              <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
                View and manage your recruitment team
              </p>
            </div>

            {/* Main Content */}
            <div className="space-y-8">
              {/* Lead's Profile Card */}
              {renderUserCard(selectedRecruiter)}

              {/* Team Members Grid */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span>Team Members</span>
                  {selectedRecruiter.recruiters && selectedRecruiter.recruiters.length > 0 && (
                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-gray-800 text-primary-600 dark:text-primary-400 rounded-full text-sm">
                      {selectedRecruiter.recruiters.length} member{selectedRecruiter.recruiters.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {selectedRecruiter.recruiters && selectedRecruiter.recruiters.length > 0 ? (
                    selectedRecruiter.recruiters.map(recruiter => (
                      <div key={recruiter.id} className="h-full">
                        {renderUserCard(recruiter)}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center">
                      <UserCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No recruiters found</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new recruiter or try a different search.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check for SuperAdmin with no company selected
  const isAllCompany = !selectedCompany || selectedCompany.id === 'all' || selectedCompany.name === 'All';
  if (currentUser?.role === 'SuperAdmin' && isAllCompany) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Select a Company
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please select a specific company from the dropdown menu above to view its recruitment team structure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for missing user data or unauthorized access
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access the recruitment team structure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for invalid role
  const validRoles = ['SuperAdmin', 'Recruiter Admin', 'Lead Recruiter', 'Recruiter'];
  if (!validRoles.includes(currentUser.role)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Unauthorized Access
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don&apos;t have the required permissions to view the recruitment team structure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for missing company data for non-SuperAdmin users
  if (currentUser.role !== 'SuperAdmin' && !currentUser.company_name) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Missing Company Information
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your account is not associated with any company. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for no users in the company
  if (!loading && (!recruiterAdmin && leadRecruiters.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No Users Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              There are currently no users registered for {
                currentUser.role === 'SuperAdmin'
                  ? selectedCompany?.name
                  : currentUser.company_name
              }.
              {currentUser.role === 'Recruiter Admin' && (
                <span className="block mt-2">
                  As an admin, you can add new team members to get started.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="p-8 pt-24">
        <div className="max-w-[1920px] mx-auto">
          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600 text-center">
              Recruitment Team Structure
            </h1>
            <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
              Manage and view your recruitment team hierarchy
            </p>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            {renderAdminCard()}

            <div className="flex flex-col lg:flex-row gap-8">
              {renderLeadsList()}
              <div className="flex-1 min-w-0">
                {renderSelectedLeadView()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Modal */}
      <MigrationModal />
    </div>
  );
};

export default RecruiterPage