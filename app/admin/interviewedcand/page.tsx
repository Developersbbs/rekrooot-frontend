'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEye } from 'react-icons/fi';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import CandidateProfile from '@/components/candidateprofile';

const InterviewedCand = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const resultLabels: { [key: string]: string } = {
    '1': 'Selected',
    '2': 'Rejected',
    '3': 'No Show',
    '4': 'Cancelled',
    '5': 'Technical Issue',
    '6': 'Proxy'
  };

  useEffect(() => {
    const handleCompanyChange = (event) => {
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

      const res = await apiFetch(`/candidates${queryParams}`, { token });
      if (res?.candidates) {
        // Filter for candidates who have a final status (meaning they've been interviewed and reviewed)
        // or have status 4 (INTERVIEWED) and are not trashed
        const interviewed = res.candidates.filter(c => (c.result || c.status === 4) && !c.trash);
        setCandidates(interviewed);
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

  const handleDelete = async (candidateId) => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await apiFetch(`/candidates/${candidateId}`, {
        method: 'DELETE',
        token
      });

      if (res) {
        toast.success('Candidate moved to trash');
        setCandidates(prev => prev.filter(c => c._id !== candidateId));
        setIsProfileOpen(false);
      }
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast.error('Failed to delete candidate');
    }
  };

  const handleViewProfile = (candidateId) => {
    setSelectedCandidateId(candidateId);
    setIsProfileOpen(true);
  };

  const filteredCandidates = candidates.filter(candidate => {
    const searchFields = [
      candidate.full_name?.toLowerCase() || '',
      candidate.email?.toLowerCase() || '',
      candidate.primary_contact?.toLowerCase() || '',
      candidate.vendor_id?.name?.toLowerCase() || '',
      candidate.client_id?.name?.toLowerCase() || '',
      candidate.job_id?.title?.toLowerCase() || ''
    ];
    return searchTerm === '' || searchFields.some(field => field.includes(searchTerm.toLowerCase()));
  });

  const interviewStatusMap: { [key: number]: { label: string, color: string } } = {
    0: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    1: { label: 'Rescheduled', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300' },
    2: { label: 'In Review', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
    3: { label: 'Selected', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    4: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    5: { label: 'No Show', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    6: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
    7: { label: 'Proxy', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
    8: { label: 'Technical Issue', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' }
  };

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
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Interviewed Candidates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {filteredCandidates.length} candidates found
          </p>
        </div>
      </div>

      <div className="mb-6 bg-surface-light dark:bg-surface-dark p-4 rounded-lg shadow-sm">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, contact, vendor, client or job..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Candidate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Interview Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Job</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCandidates.map((candidate) => {
              const interview = candidate.interview_id;
              const interviewDate = interview?.date_time ? new Date(interview.date_time) : null;

              const statusData = interview?.status !== undefined
                ? interviewStatusMap[interview.status]
                : { label: 'Interviewed', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300' };

              return (
                <tr
                  key={candidate._id}
                  onClick={() => handleViewProfile(candidate._id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {candidate.profile_pic ? (
                          <Image
                            src={candidate.profile_pic}
                            alt={candidate.full_name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <span className="text-lg font-bold text-primary-500">
                              {candidate.full_name?.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">{candidate.full_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{candidate.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <div>Primary: {candidate.primary_contact || 'N/A'}</div>
                      <div>Secondary: {candidate.secondary_contact || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <div>Interviewer: {interview?.interviewer_name || interview?.interviewer_id?.name || 'N/A'}</div>
                      <div className="text-xs mt-1">
                        {interviewDate ? format(interviewDate, 'MMM dd, yyyy • hh:mm a') : 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {candidate.vendor_id?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {candidate.client_id?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {candidate.job_id?.title || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusData.color}`}>
                        {statusData.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        candidateId={selectedCandidateId}
        onDelete={handleDelete}
        onEdit={() => { }}
        isFromInterviewed={true}
      />
    </div>
  );
};

export default InterviewedCand;