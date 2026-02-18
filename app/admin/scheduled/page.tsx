'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEye, FiClock } from 'react-icons/fi';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { format, isBefore, addHours } from 'date-fns';
import CandidateProfile from '@/components/candidateprofile';

const ScheduledPage = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  useEffect(() => {
    const handleCompanyChange = (event: any) => {
      setSelectedCompany(event.detail);
    };

    const selectedCompanyStr = localStorage.getItem('selectedCompany');
    if (selectedCompanyStr) {
      try {
        setSelectedCompany(JSON.parse(selectedCompanyStr));
      } catch (e) {
        console.error('Error parsing selectedCompany:', e);
      }
    }

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  const fetchCandidatesData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      let queryParams = '';
      if (selectedCompany?.id && selectedCompany.id !== 'all') {
        queryParams = `?company_id=${selectedCompany.id}`;
      }

      const res: any = await apiFetch(`/candidates${queryParams}`, { token });
      if (res?.candidates) {
        const now = new Date();
        // Filter for candidates with scheduled/rescheduled interviews
        // status 0: scheduled, 1: rescheduled/review
        // Only show if interview time (+1 hour) has not passed yet
        const scheduled = res.candidates.filter((c: any) => {
          if (!c.interview_id || ![0, 1].includes(c.interview_id.status) || c.trash) return false;
          const interviewTime = new Date(c.interview_id.date_time);
          const reviewTime = addHours(interviewTime, 1);
          return !isBefore(reviewTime, now);
        });
        setCandidates(scheduled);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !cancelled) {
        fetchCandidatesData();
      } else if (!user && !cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchCandidatesData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (auth.currentUser) {
        fetchCandidatesData();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [fetchCandidatesData]);

  const handleViewProfile = (candidateId: string) => {
    setSelectedProfileId(candidateId);
    setIsProfileOpen(true);
  };

  const filteredCandidates = candidates.filter((candidate: any) => {
    const searchFields = [
      candidate.full_name?.toLowerCase() || '',
      candidate.email?.toLowerCase() || '',
      candidate.primary_contact?.toLowerCase() || '',
      candidate.vendor_id?.name?.toLowerCase() || '',
      candidate.client_id?.name?.toLowerCase() || '',
      candidate.job_id?.title?.toLowerCase() || ''
    ];

    return searchTerm === '' ||
      searchFields.some(field => field.includes(searchTerm.toLowerCase()));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-screen">
      <Toaster />
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Scheduled Candidates</h1>
          <div className="flex gap-4 mt-2">
            <span className="text-sm px-3 py-1 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              Total: {filteredCandidates.length}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-surface-light dark:bg-surface-dark p-4 rounded-lg shadow-sm">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCandidates.map((candidate) => {
          const interview = candidate.interview_id;
          const interviewDate = interview?.date_time ? new Date(interview.date_time) : null;

          return (
            <div key={candidate._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-r from-primary-100 to-primary-50 dark:from-primary-900 dark:to-primary-800">
                    {candidate.profile_pic ? (
                      <Image src={candidate.profile_pic} alt={candidate.full_name} width={40} height={40} className="object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="text-lg font-bold text-primary-600 dark:text-primary-300">
                          {candidate.full_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{candidate.full_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{candidate.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleViewProfile(candidate._id)}
                  className="p-1.5 rounded-full text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  <FiEye className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <span>📅</span>
                    <span>{interviewDate ? format(interviewDate, 'MMM dd, yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <span>⏰</span>
                    <span>{interviewDate ? format(interviewDate, 'hh:mm a') : 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <span>👤</span>
                    <span>{interview?.interviewer_name || interview?.interviewer_id?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <span>📞</span>
                    <span>{candidate.primary_contact || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {candidate.vendor_id?.name || 'No Vendor'}
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {candidate.client_id?.name || 'No Client'}
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {candidate.job_id?.title || 'No Job'}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <FiClock className="w-3 h-3" />
                  <span>Added {format(new Date(candidate.createdAt), 'MMM dd')}</span>
                </div>
                {interview?.meeting_link && (
                  <a
                    href={interview.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 font-medium hover:underline"
                  >
                    Join Meeting
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <FiSearch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No candidates found</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Try adjusting your search criteria</p>
        </div>
      )}

      <CandidateProfile
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        candidateId={selectedProfileId}
        onEdit={() => { }}
        onDelete={() => { }}
      />
    </div>
  );
};

export default ScheduledPage;