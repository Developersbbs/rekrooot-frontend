'use client'
import React, { useState, useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { apiFetch } from '@/lib/api'
import { FiSearch, FiTrash2, FiEye, FiRefreshCw } from 'react-icons/fi'
import Image from 'next/image'
import { Toaster, toast } from 'react-hot-toast'
import CandidateProfile from '@/components/candidateprofile'

const TrashPage = () => {
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const fetchCandidatesData = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res: any = await apiFetch('/candidates?trash=true', { token })
      if (res?.candidates) {
        setCandidates(res.candidates)
      }
    } catch (error) {
      console.error('Error fetching trashed candidates:', error)
      toast.error('Failed to fetch trashed candidates')
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && !cancelled) {
        await fetchCandidatesData();
      } else if (!user && !cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleRestore = async (candidateId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await apiFetch(`/candidates/${candidateId}/restore`, {
        method: 'POST',
        token
      })

      toast.success('Candidate restored successfully')
      fetchCandidatesData()
    } catch (error: any) {
      console.error('Error restoring candidate:', error)
      toast.error('Failed to restore candidate')
    }
  }

  const handlePermanentDelete = async (candidateId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this candidate? This action cannot be undone.')) {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        await apiFetch(`/candidates/${candidateId}/permanent`, {
          method: 'DELETE',
          token
        })

        toast.success('Candidate permanently deleted')
        fetchCandidatesData()
      } catch (error: any) {
        console.error('Error deleting candidate:', error)
        toast.error('Failed to delete candidate')
      }
    }
  }

  const filteredCandidates = candidates.filter((candidate: any) => {
    const searchFields = [
      candidate.full_name?.toLowerCase() || '',
      candidate.email?.toLowerCase() || ''
    ]

    return searchTerm === '' ||
      searchFields.some(field => field.includes(searchTerm.toLowerCase()))
  })

  const handleViewProfile = (candidateId: string) => {
    setSelectedCandidateId(candidateId)
    setIsProfileOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-screen">
      <Toaster />
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Trash</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          {filteredCandidates.length} deleted candidates
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Candidate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Job</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCandidates.map((candidate) => (
              <tr key={candidate._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.vendor_id?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.client_id?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {candidate.job_id?.title || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleViewProfile(candidate._id)}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200 mr-3"
                  >
                    <FiEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRestore(candidate._id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-3"
                  >
                    <FiRefreshCw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(candidate._id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <FiTrash2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Trash is empty</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">No deleted candidates found</p>
        </div>
      )}

      {/* Candidate Profile Modal */}
      <CandidateProfile
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        candidateId={selectedCandidateId}
        onEdit={() => { }}
        onDelete={handlePermanentDelete}
      />
    </div>
  )
}

export default TrashPage