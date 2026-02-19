'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { FiSearch } from 'react-icons/fi'
import Image from 'next/image'
import AddNewCandidate from '@/components/addnewcandidate'
import { toast } from 'react-hot-toast'
import CandidateProfile from '@/components/candidateprofile'
import RescheduleModal from '@/components/reschedulemodal'
import { CalendarX, Edit, Trash, CalendarClock, MoreVertical, Mail } from 'lucide-react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

const AllCandidates = () => {
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterJob, setFilterJob] = useState('all')
  const [vendors, setVendors] = useState<any[]>([])
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [jobs, setJobs] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [userData, setUserData] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [reschedulingCandidate, setReschedulingCandidate] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for company changes
  useEffect(() => {
    const handleCompanyChange = (event) => {
      setSelectedCompany(event.detail)
    }

    const selectedCompanyStr = localStorage.getItem('selectedCompany')
    if (selectedCompanyStr) {
      try {
        setSelectedCompany(JSON.parse(selectedCompanyStr))
      } catch (e) {
        console.error('Error parsing selectedCompany:', e)
      }
    }

    window.addEventListener('companyChanged', handleCompanyChange)
    return () => window.removeEventListener('companyChanged', handleCompanyChange)
  }, [])

  // Handle data fetching when user or company changes
  useEffect(() => {
    let cancelled = false

    const fetchData = async (user) => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const token = await user.getIdToken()

        // Load user data if not already loaded
        if (!userData) {
          const profileRes = await apiFetch('/auth/me', { token })
          if (profileRes?.user && !cancelled) {
            setUserData(profileRes.user)
          }
        }

        let queryParams = ''
        if (selectedCompany?.id && selectedCompany.id !== 'all') {
          queryParams = `?company_id=${selectedCompany.id}`
        }

        const [vendorsRes, jobsRes, clientsRes, candidatesRes] = await Promise.all([
          apiFetch(`/vendors${queryParams}`, { token }),
          apiFetch(`/jobs${queryParams}`, { token }),
          apiFetch(`/clients${queryParams}`, { token }),
          apiFetch(`/candidates${queryParams}`, { token })
        ])

        if (!cancelled) {
          setVendors(vendorsRes.vendors || [])
          setJobs(jobsRes.jobs || [])
          setClients(clientsRes.clients || [])
          setCandidates(candidatesRes.candidates || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        if (!cancelled) toast.error('Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!cancelled) {
        fetchData(user)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [selectedCompany?.id])

  const fetchCandidatesData = useCallback(async () => {
    if (!auth.currentUser) return

    try {
      const token = await auth.currentUser.getIdToken()

      // Build query params
      let queryParams = ''
      if (selectedCompany?.id && selectedCompany.id !== 'all') {
        queryParams = `?company_id=${selectedCompany.id}`
      }

      const res = await apiFetch(`/candidates${queryParams}`, { token })
      setCandidates(res.candidates || [])
    } catch (error) {
      console.error('Error fetching candidates:', error)
      toast.error('Failed to load candidates')
    }
  }, [selectedCompany?.id])

  const handleAddCandidate = useCallback(() => {
    if (!selectedCompany || selectedCompany.id === 'all') {
      toast.error('Please select a specific company before adding a candidate')
      return
    }
    setIsDialogOpen(true)
  }, [selectedCompany])

  const handleMoveToTrash = useCallback(async (candidateId) => {
    try {
      if (!auth.currentUser) return

      const candidateToDelete = candidates.find(c => (c._id || c.id) === candidateId);
      const hasActiveInterview = candidateToDelete?.interview_id && [0, 1].includes(candidateToDelete.interview_id.status);

      const message = hasActiveInterview
        ? `Are you sure? ${candidateToDelete.full_name} has an active interview scheduled. Deleting this candidate will also CANCEL the interview and notify the candidate.`
        : `Are you sure you want to move ${candidateToDelete?.full_name || 'this candidate'} to trash?`;

      if (!window.confirm(message)) {
        return;
      }

      const token = await auth.currentUser.getIdToken()

      await apiFetch(`/candidates/${candidateId}`, {
        method: 'DELETE',
        token
      })

      // Wait a moment for backend to process, then refresh
      setTimeout(() => {
        fetchCandidatesData()
      }, 100)
    } catch (error) {
      console.error('Error deleting candidate:', error)
    }
  }, [candidates, fetchCandidatesData])

  const handleEdit = useCallback((candidate) => {
    const extractId = (val: any) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (val._id) return typeof val._id === 'object' ? (val._id.$oid || val._id) : val._id;
      if (val.$oid) return val.$oid;
      return val;
    };

    const cleanedCandidate = {
      id: extractId(candidate),
      full_name: candidate.full_name || '',
      email: candidate.email || '',
      location: candidate.location || '',
      primary_contact: candidate.primary_contact || '',
      secondary_contact: candidate.secondary_contact || '',
      vendor_id: extractId(candidate.vendor_id),
      client_id: extractId(candidate.client_id),
      job_id: extractId(candidate.job_id),
      experience_years: candidate.experience_years || '',
      final_status: candidate.final_status || null,
      profile_pic: candidate.profile_pic || null,
      resumes: candidate.resumes || [],
      supporting_documents: candidate.supporting_documents || [],
      interviewer_id: extractId(candidate.interview_id?.interviewer_id),
      interviewDate: candidate.interview_id?.date_time ? new Date(candidate.interview_id.date_time).toLocaleDateString() : '',
      interviewTime: candidate.interview_id?.date_time ? new Date(candidate.interview_id.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      interviewId: extractId(candidate.interview_id)
    }
    setEditingCandidate(cleanedCandidate)
    setIsEditDialogOpen(true)
  }, [])

  const handleEditSubmit = useCallback(async (updatedData) => {
    try {
      if (!auth.currentUser) return
      const token = await auth.currentUser.getIdToken()

      await apiFetch(`/candidates/${editingCandidate.id}`, {
        method: 'PUT',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })

      fetchCandidatesData()
      setIsEditDialogOpen(false)
      setEditingCandidate(null)
      toast.success('Candidate updated successfully')
    } catch (error) {
      console.error('Error updating candidate:', error)
      toast.error('Failed to update candidate')
    }
  }, [editingCandidate, fetchCandidatesData])

  const handleResendEmail = useCallback(async (candidate: any) => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const candidateId = candidate._id || candidate.id
      const schedulingLink = `${window.location.origin}/timeslots?candidateId=${candidateId}`

      await apiFetch('/emails/send-interview-slot', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type: 'invite',
          candidateEmail: candidate.email,
          candidateName: candidate.full_name,
          recruiterEmail: auth.currentUser?.email,
          vendorEmail: candidate.vendor_id?.email || '',
          jobTitle: candidate.job_id?.jobTitle || candidate.job_id?.title || '',
          clientName: candidate.client_id?.name || '',
          link: schedulingLink
        })
      })

      toast.success(`Scheduling link resent to ${candidate.full_name}`)
    } catch (error) {
      console.error('Error resending email:', error)
      toast.error('Failed to resend email')
    }
  }, [])

  const handleCancelMeeting = useCallback(async (candidate) => {
    if (!window.confirm(`Are you sure you want to cancel the interview for ${candidate?.full_name}?`)) {
      return;
    }

    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const sessionId = candidate.interview_id?.session_id;
      const meetingLink = candidate.interview_id?.meeting_link;
      const presenterId = candidate.interview_id?.presenter_id;
      const zsoid = candidate.interview_id?.zsoid;

      if (sessionId && meetingLink && presenterId) {
        try {
          await apiFetch('/meetings/cancel', {
            method: 'POST',
            token,
            body: JSON.stringify({
              sessionId,
              presenterId,
              zsoid
            })
          });
        } catch (cancelError) {
          console.error('Error cancelling meeting:', cancelError);
        }
      }

      await apiFetch(`/candidates/${candidate._id || candidate.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          final_status: null,
          interview_id: null,
          status: 5 // 5: cancelled
        })
      });

      // Send cancellation email
      try {
        await apiFetch('/emails/send-interview-slot', {
          method: 'POST',
          token,
          body: JSON.stringify({
            type: 'cancel',
            candidateEmail: candidate.email,
            candidateName: candidate.full_name,
            recruiterEmail: auth.currentUser?.email,
            vendorEmail: candidate.vendor_id?.email || candidate.vendor_id?._id || candidate.vendor_id,
            jobTitle: candidate.job_id?.jobTitle || candidate.job_id?.title || candidate.job_id,
            clientName: candidate.client_id?.name || candidate.client_id?._id || candidate.client_id
          })
        });
      } catch (emailErr) {
        console.error('Error sending cancellation email:', emailErr);
      }

      toast.success('Interview cancelled successfully');
      fetchCandidatesData();
    } catch (error) {
      console.error('Error cancelling interview:', error);
      toast.error('Failed to cancel: ' + error.message);
    } finally {
      setIsSubmittingAction(false);
    }
  }, [fetchCandidatesData, isSubmittingAction])


  const handleViewProfile = (candidateId) => {
    setSelectedCandidateId(candidateId)
    setIsProfileOpen(true)
  }

  const handleReschedule = useCallback((candidate) => {
    setReschedulingCandidate(candidate)
    setIsRescheduleOpen(true)
  }, [])

  // Derive a display status string from the candidate object
  const getCandidateDisplayStatus = (candidate: any): string => {
    // 1. Check for specific result/outcome on the candidate object
    if (candidate.final_status) return candidate.final_status.toUpperCase();
    if (candidate.result) return candidate.result.toUpperCase();

    // 2. Use candidate's own status field
    const candidateStatusMap: { [key: number]: string } = {
      0: 'WAITING',
      1: 'SCHEDULED',
      2: 'RESCHEDULED',
      3: 'IN REVIEW',
      4: 'INTERVIEWED',
      5: 'CANCELLED'
    };

    if (typeof candidate.status === 'number' && candidateStatusMap[candidate.status] !== undefined) {
      return candidateStatusMap[candidate.status];
    }

    // 3. Fallback to interview status (legacy/consistency check)
    const interviewStatus = candidate.interview_id?.status;
    const resultStatusMap: { [key: number]: string } = {
      3: 'SELECTED',
      4: 'REJECTED',
      5: 'NO SHOW',
      6: 'CANCELLED',
      7: 'PROXY',
      8: 'TECHNICAL ISSUE'
    };

    if (typeof interviewStatus === 'number' && resultStatusMap[interviewStatus]) {
      return resultStatusMap[interviewStatus];
    }

    // Ultimate fallback
    if (candidate.interview_id) return 'SCHEDULED';
    return 'WAITING';
  };

  const filteredCandidates = React.useMemo(() => {
    return candidates.filter(candidate => {
      const searchFields = [
        candidate.full_name?.toLowerCase() || '',
        candidate.email?.toLowerCase() || ''
      ]

      const matchesSearch = searchTerm === '' ||
        searchFields.some(field => field.includes(searchTerm.toLowerCase()))

      const displayStatus = getCandidateDisplayStatus(candidate);
      const matchesStatus = filterStatus === 'all' || displayStatus === filterStatus;

      const vendorId = candidate.vendor_id?._id || candidate.vendor_id
      const matchesVendor = filterVendor === 'all' || vendorId === filterVendor

      const clientId = candidate.client_id?._id || candidate.client_id
      const matchesClient = filterClient === 'all' || clientId === filterClient

      const jobId = candidate.job_id?._id || candidate.job_id
      const matchesJob = filterJob === 'all' || jobId === filterJob

      return matchesSearch && matchesStatus && matchesVendor && matchesClient && matchesJob
    })
  }, [candidates, searchTerm, filterStatus, filterVendor, filterClient, filterJob])



  const statusConfig: { [key: string]: { label: string, style: string } } = {
    "WAITING": { label: 'WAITING', style: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    "SCHEDULED": { label: 'SCHEDULED', style: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    "RESCHEDULED": { label: 'RESCHEDULED', style: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300' },
    "IN REVIEW": { label: 'IN REVIEW', style: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
    "INTERVIEWED": { label: 'INTERVIEWED', style: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300' },
    "CANCELLED": { label: 'CANCELLED', style: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-screen">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Candidates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {filteredCandidates.length} candidates found
          </p>
        </div>
        <button
          onClick={handleAddCandidate}
          className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
        >
          Add New Candidate
        </button>
      </div>

      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="all">All Status</option>
            {Object.entries(statusConfig).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            value={filterVendor}
            onChange={(e) => setFilterVendor(e.target.value)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="all">All Vendors</option>
            {(vendors || []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.vendorName}</option>
            ))}
          </select>

          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="all">All Clients</option>
            {(clients || []).map((client) => (
              <option key={client._id} value={client._id}>{client.name}</option>
            ))}
          </select>

          <select
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="all">All Jobs</option>
            {(jobs || [])
              .filter(job => String(job.status) === '0')
              .map((job) => (
                <option key={job._id || job.id} value={job._id || job.id}>{job.title || job.jobTitle}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto relative">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Candidate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Primary Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Secondary Contact</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Applied Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Job</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Exp. (Yrs)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCandidates.map((candidate) => (
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
                          alt={candidate.full_name || 'Candidate profile picture'}
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
                      <div className="font-medium text-gray-900 dark:text-gray-100">{candidate.full_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{candidate.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.primary_contact || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.secondary_contact || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {mounted && candidate.createdAt ? new Date(candidate.createdAt).toLocaleString('en-US', { hour12: true }) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.vendor_id?.name || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.client_id?.name || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.job_id?.title || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                  {candidate.experience_years || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                  {candidate.location || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const displayStatus = getCandidateDisplayStatus(candidate);
                    const config = statusConfig[displayStatus] || statusConfig['WAITING'];
                    return (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.style}`}>
                        {config.label}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Menu as="div" className="relative inline-block text-left" key={`menu-${candidate._id}`}>
                    <MenuButton
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={20} className="text-gray-500 dark:text-gray-400" />
                    </MenuButton>
                    <MenuItems
                      transition
                      anchor="bottom end"
                      className="z-50 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-gray-100 dark:divide-gray-700 transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                    >
                      <div className="py-1">
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(candidate); }}
                              className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm`}
                            >
                              <Edit className="mr-3 h-4 w-4 text-blue-500" /> Edit
                            </button>
                          )}
                        </MenuItem>
                        {getCandidateDisplayStatus(candidate) === 'WAITING' && (
                          <MenuItem>
                            {({ focus }) => (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleResendEmail(candidate); }}
                                className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm`}
                              >
                                <Mail className="mr-3 h-4 w-4 text-green-500" /> Resend
                              </button>
                            )}
                          </MenuItem>
                        )}
                      </div>
                      {(candidate.interview_id || candidate.final_status === 'REJECTED' || candidate.status === 5) && (
                        <div className="py-1">
                          {candidate.interview_id && (
                            <MenuItem>
                              {({ focus }) => (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCancelMeeting(candidate); }}
                                  className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm`}
                                >
                                  <CalendarX className="mr-3 h-4 w-4 text-red-500" /> Cancel
                                </button>
                              )}
                            </MenuItem>
                          )}
                          <MenuItem>
                            {({ focus }) => (
                              <button
                                disabled={isSubmittingAction}
                                onClick={(e) => { e.stopPropagation(); handleReschedule(candidate); }}
                                className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm ${isSubmittingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <CalendarClock className="mr-3 h-4 w-4 text-blue-500" /> Reschedule
                              </button>
                            )}
                          </MenuItem>
                        </div>
                      )}
                      <div className="py-1">
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveToTrash(candidate._id); }}
                              className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm`}
                            >
                              <Trash className="mr-3 h-4 w-4 text-gray-500" /> Delete
                            </button>
                          )}
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <FiSearch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No candidates found</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria</p>
        </div>
      )}

      <AddNewCandidate
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        selectedJob={selectedJob}
        selectedClient={selectedClient}
        showClientJobDropdowns={true}
        onCandidateAdded={fetchCandidatesData}
      />

      <AddNewCandidate
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false)
          setEditingCandidate(null)
        }}
        candidateData={editingCandidate}
        isEditing={true}
        showClientJobDropdowns={true}
        onCandidateAdded={fetchCandidatesData}
      />

      <CandidateProfile
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        candidateId={selectedCandidateId}
        onEdit={handleEdit}
        onDelete={handleMoveToTrash}
      />

      <RescheduleModal
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        candidate={reschedulingCandidate}
        onRescheduled={fetchCandidatesData}
      />
    </div>
  )
}

export default AllCandidates