'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEye, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { auth, storage } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { format, isBefore, addHours } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CandidateProfile from '@/components/candidateprofile';
const InterviewReviewPage = () => {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
    const [selectedResult, setSelectedResult] = useState('');
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
                // Filter for candidates whose interview time has passed (+1 hour) or are in review status
                // status 0: scheduled, 1: rescheduled, 2: interview_in_review
                const inReview = res.candidates.filter((c: any) => {
                    if (!c.interview_id || ![0, 1, 2].includes(c.interview_id.status) || c.trash) return false;

                    // If status is specifically 2 (in review), always show it
                    if (c.interview_id.status === 2) return !c.final_status && !c.result;

                    // For status 0 and 1, only show if time has passed
                    const interviewTime = new Date(c.interview_id.date_time);
                    const reviewTime = addHours(interviewTime, 1);
                    return isBefore(reviewTime, now) && !c.final_status && !c.result;
                });
                setCandidates(inReview);
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

    const handleResultChange = async (candidateId: string, result: string, file: File | null = null) => {
        if (!auth.currentUser) return;
        const loadingToast = toast.loading(file ? 'Uploading document...' : 'Updating status...');
        try {
            const token = await auth.currentUser.getIdToken();
            let updates: any = {};

            if (file) {
                const storageRef = ref(storage, `results/${candidateId}/${file.name}`);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                updates.result_document_url = downloadURL;
            }

            if (result) {
                updates.result = result;
                if (result === '1') { // 1: Selected
                    updates.final_status = 'SELECTED';
                } else if (result === '2') { // 2: Rejected
                    updates.final_status = 'REJECTED';
                    updates.is_active = false;
                }
            }

            const res: any = await apiFetch(`/candidates/${candidateId}`, {
                method: 'PUT',
                token,
                body: JSON.stringify(updates)
            });

            if (res) {
                toast.success('Updated successfully', { id: loadingToast });

                // If it's a final status, remove from list
                if (['1', '2'].includes(result)) {
                    setCandidates(prev => prev.filter(c => c._id !== candidateId));
                    setIsModalOpen(false);
                } else {
                    // Update local state
                    setCandidates(prev => prev.map((c: any) => c._id === candidateId ? { ...c, ...res.candidate } : c));
                    if (selectedCandidate?._id === candidateId) {
                        setSelectedCandidate((prev: any) => ({ ...prev, ...res.candidate }));
                    }
                }
            }
        } catch (error) {
            console.error('Error updating result:', error);
            toast.error('Failed to update result', { id: loadingToast });
        }
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

        return searchTerm === '' ||
            searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    });

    const openStatusModal = (candidate: any) => {
        setSelectedCandidate(candidate);
        setSelectedResult(candidate.result || '');
        setIsModalOpen(true);
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
                    <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Interviews in Review</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Pending feedback for completed interviews</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCandidates.map((candidate) => {
                    const interview = candidate.interview_id;
                    const interviewDate = interview?.date_time ? new Date(interview.date_time) : null;

                    return (
                        <div key={candidate._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 p-5 hover:shadow-lg transition-all duration-200">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="h-12 w-12 rounded-full overflow-hidden bg-primary-50 dark:bg-primary-900/20">
                                        {candidate.profile_pic ? (
                                            <Image src={candidate.profile_pic} alt={candidate.full_name} width={48} height={48} className="object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <span className="text-xl font-bold text-primary-600">
                                                    {candidate.full_name?.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{candidate.full_name}</h3>
                                        <p className="text-sm text-gray-500">{candidate.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => {
                                    setSelectedProfileId(candidate._id);
                                    setIsProfileOpen(true);
                                }} className="p-2 text-gray-400 hover:text-primary-500 transition-colors">
                                    <FiEye className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <FiClock className="mr-2 text-primary-500" />
                                    <span>{interviewDate ? format(interviewDate, 'MMM dd, yyyy • hh:mm a') : 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span className="text-gray-400 block mb-1">Interviewer</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-200">{interview?.interviewer_name || interview?.interviewer_id?.name || 'N/A'}</span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span className="text-gray-400 block mb-1">Company</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{candidate.client_id?.name || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-6">
                                <span className="px-2 py-1 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                                    {candidate.job_id?.title || 'N/A'}
                                </span>
                                <span className="px-2 py-1 text-[10px] font-medium rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30">
                                    {candidate.vendor_id?.name || 'N/A'}
                                </span>
                            </div>

                            <button
                                onClick={() => openStatusModal(candidate)}
                                className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                            >
                                Update Status
                            </button>
                        </div>
                    );
                })}
            </div>

            {filteredCandidates.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-gray-200">
                    <FiCheckCircle className="mx-auto h-12 w-12 text-green-400 mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white">All caught up!</h3>
                    <p className="text-gray-500">No interviews currently awaiting review.</p>
                </div>
            )}

            {isModalOpen && selectedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            Update Status for {selectedCandidate.full_name}
                                        </h3>
                                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                            <FiXCircle className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Document Upload */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Result Document
                                            </label>
                                            <div className="relative group">
                                                <label
                                                    htmlFor="file-upload"
                                                    className="flex items-center justify-center px-4 py-4 rounded-lg border-2 border-dashed
                                                        border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500
                                                        bg-white dark:bg-gray-800 cursor-pointer group-hover:bg-gray-50 dark:group-hover:bg-gray-700
                                                        transition-all duration-200"
                                                >
                                                    <div className="flex flex-col items-center space-y-2">
                                                        <svg className="w-8 h-8 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                        </svg>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                Drop files here or click to upload
                                                            </span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                PDF, DOC, DOCX (Max 10MB)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        id="file-upload"
                                                        type="file"
                                                        accept=".pdf,.doc,.docx"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                handleResultChange(selectedCandidate._id, selectedResult || 'Selected', file);
                                                            }
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>

                                            {/* Document Preview */}
                                            {selectedCandidate.result_document_url && (
                                                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                Uploaded Document
                                                            </span>
                                                        </div>
                                                        <a
                                                            href={selectedCandidate.result_document_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg
                                                                text-sm font-medium text-primary-600 bg-primary-50 
                                                                hover:bg-primary-100 dark:bg-primary-900/30 
                                                                dark:text-primary-400 dark:hover:bg-primary-900/50
                                                                transition-colors duration-200"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            <span>View Document</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Selection */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Interview Result
                                            </label>
                                            <select
                                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                                                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 
                                                    focus:border-primary-500 transition-all duration-200"
                                                onChange={(e) => {
                                                    setSelectedResult(e.target.value);
                                                    handleResultChange(selectedCandidate._id, e.target.value);
                                                }}
                                                value={selectedResult}
                                            >
                                                <option value="" className="text-gray-900 dark:text-white">📋 Select Result</option>
                                                <option value="1" className="text-gray-900 dark:text-white">✅ Selected</option>
                                                <option value="2" className="text-gray-900 dark:text-white">❌ Rejected</option>
                                                <option value="3" className="text-gray-900 dark:text-white">⚠️ No Show</option>
                                                <option value="4" className="text-gray-900 dark:text-white">❌ Cancelled</option>
                                                <option value="5" className="text-gray-900 dark:text-white">🔧 Technical Issue</option>
                                                <option value="6" className="text-gray-900 dark:text-white">🚫 Proxy</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="mt-8 flex justify-end space-x-3">
                                        <button
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                                                rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 
                                                focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 
                                                dark:hover:bg-gray-600 transition-colors duration-200"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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

export default InterviewReviewPage;