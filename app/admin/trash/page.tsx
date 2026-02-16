'use client'
import React, { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.config'
import { FiSearch, FiTrash2, FiEdit2, FiEye, FiRefreshCw } from 'react-icons/fi'
import Image from 'next/image'
import { Toaster , toast} from 'react-hot-toast'
import CandidateProfile from '@/components/candidateprofile'

const TrashPage = () => {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [vendors, setVendors] = useState({})
  const [jobs, setJobs] = useState({})
  const [clients, setClients] = useState({})
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)

  const fetchCandidatesData = async () => {
    try {
      const candidatesSnap = await getDocs(collection(db, 'candidates'))
      const candidatesData = candidatesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }))
      // Only show candidates that are in trash
      setCandidates(candidatesData.filter(candidate => candidate.trash))
    } catch (error) {
      console.error('Error fetching candidates:', error)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candidatesSnap, vendorsSnap, jobsSnap, clientsSnap] = await Promise.all([
          getDocs(collection(db, 'candidates')),
          getDocs(collection(db, 'Vendor')),
          getDocs(collection(db, 'jobs')),
          getDocs(collection(db, 'Clients'))
        ])

        const vendorsMap = {}
        vendorsSnap.docs.forEach(doc => {
          vendorsMap[doc.id] = doc.data().vendorName
        })
        setVendors(vendorsMap)

        const jobsMap = {}
        jobsSnap.docs.forEach(doc => {
          jobsMap[doc.id] = doc.data().jobTitle
        })
        setJobs(jobsMap)

        const clientsMap = {}
        clientsSnap.docs.forEach(doc => {
          clientsMap[doc.id] = doc.data().name
        })
        setClients(clientsMap)

        const candidatesData = candidatesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }))
        // Only show candidates that are in trash
        setCandidates(candidatesData.filter(candidate => candidate.trash))
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleRestore = async (candidateId) => {
    try {
      const candidateRef = doc(db, 'candidates', candidateId)
      await updateDoc(candidateRef, {
        trash: false
      })
      // Refresh candidates list
      fetchCandidatesData()
      toast.success('Candidate restored successfully')
    } catch (error) {
      console.error('Error restoring candidate:', error)
      toast.error('Failed to restore candidate')
    }
  }

  const handlePermanentDelete = async (candidateId) => {
    if (window.confirm('Are you sure you want to permanently delete this candidate? This action cannot be undone.')) {
      try {
        const candidateRef = doc(db, 'candidates', candidateId)
        await deleteDoc(candidateRef)
        // Refresh candidates list
        fetchCandidatesData()
        toast.success('Candidate permanently deleted')
      } catch (error) {
        console.error('Error deleting candidate:', error)
        toast.error('Failed to delete candidate')
      }
    }
  }

  const filteredCandidates = candidates.filter(candidate => {
    const searchFields = [
      candidate.name?.toLowerCase() || '',
      candidate.email?.toLowerCase() || ''
    ]

    return searchTerm === '' || 
      searchFields.some(field => field.includes(searchTerm.toLowerCase()))
  })

  const handleViewProfile = (candidateId) => {
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
              <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {candidate.profilePic ? (
                        <Image
                          src={candidate.profilePic}
                          alt={candidate.name}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-lg font-bold text-primary-500">
                            {candidate.name?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900 dark:text-white">{candidate.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{candidate.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <div>Primary: {candidate.primaryContact || 'N/A'}</div>
                    <div>Secondary: {candidate.secondaryContact || 'N/A'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {vendors[candidate.vendorId] || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {clients[candidate.clientId] || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {jobs[candidate.jobId] || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleViewProfile(candidate.id)}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200 mr-3"
                  >
                    <FiEye className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleRestore(candidate.id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-3"
                  >
                    <FiRefreshCw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handlePermanentDelete(candidate.id)}
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
      />
    </div>
  )
}

export default TrashPage