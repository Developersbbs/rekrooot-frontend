'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { FiSearch } from 'react-icons/fi'
import Image from 'next/image'
import AddNewCandidate from '@/components/addnewcandidate'
import { toast, Toaster } from 'react-hot-toast'
import CandidateProfile from '@/components/candidateprofile'
import RescheduleModal from '@/components/reschedulemodal'
import { CalendarX, Edit, Trash, CalendarClock, MoreVertical, Mail } from 'lucide-react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

const AllCandidates = () => {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterJob, setFilterJob] = useState('all')
  const [vendors, setVendors] = useState([])
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [userData, setUserData] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
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
      const token = await auth.currentUser.getIdToken()

      await apiFetch(`/candidates/${candidateId}`, {
        method: 'DELETE',
        token
      })

      fetchCandidatesData()
      toast.success('Candidate deleted successfully')
    } catch (error) {
      console.error('Error deleting candidate:', error)
      toast.error('Failed to delete candidate')
    }
  }, [fetchCandidatesData])

  const handleEdit = useCallback((candidate) => {
    const cleanedCandidate = {
      id: candidate._id || candidate.id,
      full_name: candidate.full_name || '',
      email: candidate.email || '',
      location: candidate.location || '',
      primary_contact: candidate.primary_contact || '',
      secondary_contact: candidate.secondary_contact || '',
      vendor_id: candidate.vendor_id?._id || candidate.vendor_id || '',
      client_id: candidate.client_id?._id || candidate.client_id || '',
      job_id: candidate.job_id?._id || candidate.job_id || '',
      status: candidate.status || 'applied',
      profile_pic: candidate.profile_pic || null,
      resumes: candidate.resumes || [],
      supporting_documents: candidate.supporting_documents || [],
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

  const handleResendEmail = useCallback(async (candidate) => {
    // TODO: Implement email resend via backend API
    toast.info('Email resend feature coming soon')
  }, [])

  const handleCancelMeeting = useCallback(async (candidate) => {
    // TODO: Implement meeting cancellation via backend API
    toast.info('Meeting cancellation feature coming soon')
  }, [])

  const handleViewProfile = (candidateId) => {
    setSelectedCandidateId(candidateId)
    setIsProfileOpen(true)
  }

  const handleReschedule = useCallback((candidate) => {
    setReschedulingCandidate(candidate)
    setIsRescheduleOpen(true)
  }, [])

  const filteredCandidates = React.useMemo(() => {
    return candidates.filter(candidate => {
      const searchFields = [
        candidate.full_name?.toLowerCase() || '',
        candidate.email?.toLowerCase() || ''
      ]

      const matchesSearch = searchTerm === '' ||
        searchFields.some(field => field.includes(searchTerm.toLowerCase()))

      const matchesStatus = filterStatus === 'all' || candidate.status === filterStatus

      const vendorId = candidate.vendor_id?._id || candidate.vendor_id
      const matchesVendor = filterVendor === 'all' || vendorId === filterVendor

      const clientId = candidate.client_id?._id || candidate.client_id
      const matchesClient = filterClient === 'all' || clientId === filterClient

      const jobId = candidate.job_id?._id || candidate.job_id
      const matchesJob = filterJob === 'all' || jobId === filterJob

      return matchesSearch && matchesStatus && matchesVendor && matchesClient && matchesJob
    })
  }, [candidates, searchTerm, filterStatus, filterVendor, filterClient, filterJob])

  const statusConfig = {
    "0": { label: 'APPLIED', style: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    "1": { label: 'WAITING', style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    "2": { label: 'SCHEDULED', style: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    "3": { label: 'SELECTED', style: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
    "4": { label: 'REJECTED', style: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    "5": { label: 'ON_HOLD', style: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
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
      <Toaster />
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
            {(jobs || []).map((job) => (
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
                          alt={candidate.name}
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
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusConfig[candidate.status]?.style || 'bg-gray-100 text-gray-800'}`}>
                    {statusConfig[candidate.status]?.label || candidate.status || 'N/A'}
                  </span>
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
                        {(candidate.status === '1') && (
                          <MenuItem>
                            {({ focus }) => (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleResendEmail(candidate); }}
                                className={`${focus ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group flex w-full items-center px-4 py-2 text-sm`}
                              >
                                <Mail className="mr-3 h-4 w-4 text-primary-500" /> Resend
                              </button>
                            )}
                          </MenuItem>
                        )}
                      </div>
                      {(candidate.status === '2' || candidate.status === '4') && (
                        <div className="py-1">
                          {candidate.status === '2' && (
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
        onSubmit={handleEditSubmit}
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