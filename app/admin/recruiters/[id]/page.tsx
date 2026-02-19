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

interface Recruiter {
  id: string;
  display_name: string;
  email: string;
  contact: string;
  role: string;
  region: string;
  company_name: string;
  created_at?: string;
}

interface Candidate {
  _id?: string;
  id?: string;
  full_name?: string;
  name?: string;
  status: number;
  createdAt?: string;
  created_at?: string;
  job_id?: { title: string };
  job_title?: string;
}

interface Stats {
  candidates: Candidate[];
  vendors: any[];
  clients: any[];
  interviews: any[];
}

const RecruiterDetails = () => {
  const params = useParams()
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    candidates: [],
    vendors: [],
    clients: [],
    interviews: []
  })

  useEffect(() => {
    const fetchRecruiterData = async (firebaseUser: any) => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching data for recruiter ID:', params.id)

        if (!params.id) {
          setError('No recruiter ID provided')
          setLoading(false)
          return
        }

        const token = await firebaseUser.getIdToken();
        if (!token) {
          setError('Failed to retrieve authentication token')
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
          apiFetch(`/vendors?created_by=${userData._id}`, { token }),
          apiFetch(`/clients?created_by=${userData._id}`, { token }),
          apiFetch(`/interviewers/all-interviews?created_by=${userData._id}`, { token })
        ]);

        setStats({
          candidates: candidatesRes.candidates || [],
          vendors: vendorsRes.vendors || [],
          clients: clientsRes.clients || [],
          interviews: interviewsRes.interviews || []
        })

        setLoading(false)
      } catch (error: any) {
        console.error('Error fetching recruiter data:', error)
        setError(error.message || 'Failed to load recruiter data')
        setLoading(false)
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchRecruiterData(user)
      } else {
        setError('Not authenticated')
        setLoading(false)
      }
    })

    return () => unsubscribe()
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
      const dateStr = c.createdAt || c.created_at;
      const createdDate = dateStr ? new Date(dateStr) : null
      return createdDate && createdDate.toDateString() === date.toDateString()
    }).length
  })

  // Mapping from numeric status (0-5) to labels
  const statusLabels: { [key: number]: string } = {
    0: 'Waiting',
    1: 'Scheduled',
    2: 'Rescheduled',
    3: 'Review',
    4: 'Interviewed',
    5: 'Cancelled'
  };

  const candidateStatusData = {
    labels: Object.values(statusLabels),
    datasets: [{
      data: Object.keys(statusLabels).map(s =>
        stats.candidates.filter(c => c.status === parseInt(s)).length
      ),
      backgroundColor: [
        '#9DA2AB', // Waiting - Gray
        '#60A5FA', // Scheduled - Blue
        '#818CF8', // Rescheduled - Indigo
        '#FBBF24', // Review - Amber
        '#34D399', // Interviewed - Green
        '#EF4444', // Cancelled - Red
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
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  {recruiter.role} {recruiter.region && ` - ${recruiter.region} Region`}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Email:</span> {recruiter.email}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Phone:</span> {recruiter.contact}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Company:</span> {recruiter.company_name}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {stats.candidates.length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Candidates</div>
                </div>
                <div className="text-center px-4 py-2 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">
                    {stats.vendors.length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Vendors</div>
                </div>
                <div className="text-center px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {stats.interviews.length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Interviews</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Candidates Added Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center justify-between">
              Candidates Added
              <span className="text-sm font-normal text-gray-500">Last 7 Days</span>
            </h2>
            <div className="h-[300px]">
              <Line
                data={{
                  labels: last7Days.map(d => d.toLocaleDateString()),
                  datasets: [{
                    label: 'Candidates Added',
                    data: candidatesPerDay,
                    borderColor: '#6366F1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#1F2937',
                      padding: 12,
                      titleFont: { size: 14 },
                      bodyFont: { size: 12 },
                      cornerRadius: 8
                    }
                  },
                  scales: {
                    y: { beginAtZero: true, grid: { display: false } },
                    x: { grid: { display: false } }
                  }
                }}
              />
            </div>
          </div>

          {/* Candidate Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Pipeline Distribution
            </h2>
            <div className="h-[300px] flex items-center justify-center">
              <Doughnut
                data={candidateStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        boxWidth: 12,
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 12 }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Recent Activity
          </h2>
          {stats.candidates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
              <p className="text-gray-500 dark:text-gray-400">No recent activity found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...stats.candidates]
                .sort((a, b) => {
                  const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
                  const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
                  return dateB - dateA;
                })
                .slice(0, 10)
                .map(candidate => {
                  const cStatus = candidate.status || 0;
                  const cLabel = statusLabels[cStatus] || 'Unknown';

                  return (
                    <div
                      key={candidate._id || candidate.id}
                      className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 flex items-center justify-center border border-primary-500/20">
                          <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">
                            {(candidate.full_name || candidate.name)?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {candidate.full_name || candidate.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {candidate.job_id?.title || candidate.job_title || 'Position not specified'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase ${cStatus === 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          cStatus === 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                          {cLabel}
                        </span>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {(() => {
                            const dateStr = candidate.createdAt || candidate.created_at;
                            return dateStr ? new Date(dateStr).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A';
                          })()}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecruiterDetails