'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

const roleMap = {
  0: 'SuperAdmin',
  1: 'Recruiter Admin',
  2: 'Lead Recruiter',
  3: 'Recruiter'
}

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-primary-600 dark:text-primary-400 font-medium">Loading...</p>
    </div>
  </div>
)

const RecruiterDetails = () => {
  const params = useParams()
  const [recruiter, setRecruiter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    candidates: [],
    vendors: [],
    clients: [],
    interviews: []
  })

  useEffect(() => {
    const fetchRecruiterData = async () => {
      try {
        console.log('Fetching data for recruiter ID:', params.id)

        if (!params.id) {
          setError('No recruiter ID provided')
          setLoading(false)
          return
        }

        const token = await auth.currentUser?.getIdToken()
        if (!token) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        // Fetch recruiter details from backend
        const recruiterRes = await apiFetch(`/users/${params.id}`, { token })

        if (!recruiterRes || !recruiterRes.user) {
          setError('Recruiter not found')
          setLoading(false)
          return
        }

        const userData = recruiterRes.user
        console.log('Recruiter data:', userData)

        // Map role number to string
        const mappedRole = typeof userData.role === 'number' ? roleMap[userData.role] : userData.role

        // Extract company name if populated
        const companyName = (userData.company_id && typeof userData.company_id === 'object')
          ? userData.company_id.name
          : 'No Company'

        setRecruiter({
          id: userData._id,
          display_name: userData.username || userData.display_name || userData.email,
          email: userData.email,
          contact: userData.contact || 'N/A',
          role: mappedRole,
          region: userData.recruiter_region || userData.lead_recruiter_region || 'Global',
          company_name: companyName,
          created_at: userData.created_at
        })

        // Fetch related data
        const [candidatesRes, vendorsRes, clientsRes, interviewsRes] = await Promise.all([
          apiFetch(`/candidates?created_by=${userData._id}`, { token }),
          apiFetch('/vendors', { token }),
          apiFetch('/clients', { token }),
          apiFetch('/interviewers/all-interviews', { token })
        ]);

        setStats({
          candidates: candidatesRes.candidates || [],
          vendors: vendorsRes.vendors || [],
          clients: clientsRes.clients || [],
          interviews: interviewsRes.interviews || []
        })

        setLoading(false)
      } catch (error) {
        console.error('Error fetching recruiter data:', error)
        setError(error.message || 'Failed to load recruiter data')
        setLoading(false)
      }
    }

    fetchRecruiterData()
  }, [params.id])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600">{error}</p>
        <Link
          href="/admin/recruiters"
          className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Recruiters</span>
        </Link>
      </div>
    </div>
  )
  if (!recruiter) return <div>Recruiter not found</div>

  // Prepare chart data
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d
  }).reverse()

  const candidatesPerDay = last7Days.map(date => {
    return stats.candidates.filter(c => {
      const createdDate = c.created_at ? new Date(c.created_at) : null
      return createdDate && createdDate.toDateString() === date.toDateString()
    }).length
  })

  const candidateStatusData = {
    labels: ['Screening', 'Interview Scheduled', 'Selected', 'Rejected', 'On Hold'],
    datasets: [{
      data: [
        stats.candidates.filter(c => c.status === 'screening').length,
        stats.candidates.filter(c => c.status === 'interview_scheduled').length,
        stats.candidates.filter(c => c.status === 'selected').length,
        stats.candidates.filter(c => c.status === 'rejected').length,
        stats.candidates.filter(c => c.status === 'on_hold').length,
      ],
      backgroundColor: [
        '#60A5FA',
        '#34D399',
        '#F59E0B',
        '#EF4444',
        '#6B7280',
      ],
    }],
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 pt-24">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/admin/recruiters"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back to Recruiters</span>
          </Link>
        </div>

        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="relative h-48 bg-gradient-to-r from-primary-500 to-accent-500">
            <div className="absolute -bottom-16 left-8">
              <div className="w-32 h-32 rounded-2xl bg-white dark:bg-gray-800 p-1">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">
                    {recruiter.display_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-20 px-8 pb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {recruiter.display_name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {recruiter.role} - {recruiter.region} Region
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {recruiter.email}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {recruiter.contact}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Company: {recruiter.company_name}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {stats.candidates.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Candidates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">
                    {stats.vendors.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Vendors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {stats.interviews.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Interviews</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Candidates Added Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Candidates Added (Last 7 Days)
            </h2>
            <Line
              data={{
                labels: last7Days.map(d => d.toLocaleDateString()),
                datasets: [{
                  label: 'Candidates Added',
                  data: candidatesPerDay,
                  borderColor: '#6366F1',
                  backgroundColor: '#6366F1',
                  tension: 0.4
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                }
              }}
            />
          </div>

          {/* Candidate Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Candidate Status Distribution
            </h2>
            <div className="h-[300px] flex items-center justify-center">
              <Doughnut
                data={candidateStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right'
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          {stats.candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No candidates found
            </div>
          ) : (
            <div className="space-y-4">
              {stats.candidates
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5)
                .map(candidate => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                        <span className="text-primary-600 dark:text-primary-400 font-medium">
                          {candidate.name?.[0]?.toUpperCase() || 'C'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {candidate.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {candidate.job_title}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${candidate.status === 'selected'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                        : candidate.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400'
                        }`}>
                        {candidate.status?.replace('_', ' ').toUpperCase()}
                      </span>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(candidate.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecruiterDetails