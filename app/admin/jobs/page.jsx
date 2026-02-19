'use client'
import React, { useState, useEffect } from 'react'
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiUserPlus, FiChevronDown } from 'react-icons/fi'
import { Dialog } from '@headlessui/react'
import { toast } from 'react-hot-toast'
import AddNewCandidate from '@/components/addnewcandidate'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'
import Cookies from 'js-cookie'


const JobsPage = () => {
  // State management
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [jobToDelete, setJobToDelete] = useState(null)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dropdown state
  const [statusDropdown, setStatusDropdown] = useState({
    isOpen: false,
    jobId: null,
    position: { x: 0, y: 0 }
  })

  const [filters, setFilters] = useState({
    status: 'all',
    jobType: 'all',
    jobCategory: 'all',
    searchQuery: ''
  })

  const jobStatusConfig = {
    '0': { label: 'ACTIVE', style: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    '1': { label: 'INACTIVE', style: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' },
    '2': { label: 'ONHOLD', style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' },
  };

  const [newJob, setNewJob] = useState({
    clientId: '',
    jobTitle: '',
    experience: '',
    jobLocation: '',
    jobCategory: 'Hybrid',
    jobType: 'Full Time',
    description: '',
    status: '0',
    requiredSkills: [],
    createdAt: new Date(),
    candidateCounts: {
      applied: 0,
      waiting: 0,
      scheduled: 0,
      selected: 0,
      rejected: 0,
      noShow: 0,
      cancelled: 0,
      technicalIssue: 0,
      proxy: 0,
      onHold: 0
    }
  })

  const [technologies, setTechnologies] = useState([])
  const [selectedSkills, setSelectedSkills] = useState('')

  // Custom alert state
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    type: 'error' // 'error' | 'success' | 'warning' | 'info'
  })

  // Add this new state for status update loading
  const [isStatusUpdating, setIsStatusUpdating] = useState(null)

  // Add this new state for the candidate modal
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false)
  const [selectedJobForCandidate, setSelectedJobForCandidate] = useState(null)

  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [candidateCounts, setCandidateCounts] = useState({})

  // Add event listener for company changes
  useEffect(() => {
    const handleCompanyChange = (event) => {
      const company = event.detail;
      if (company && company.id !== selectedCompanyId) {
        setSelectedCompanyId(company.id);
      }
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [selectedCompanyId]);

  // Initial load of company from cookie/localStorage
  useEffect(() => {
    const savedCompany = localStorage.getItem('selectedCompany');
    if (savedCompany) {
      try {
        const company = JSON.parse(savedCompany);
        setSelectedCompanyId(company.id || 'all');
      } catch (e) {
        console.error("Error parsing saved company", e);
      }
    }
  }, []);

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    const fetchData = async (user) => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Only show full loading if we don't have jobs yet
      const shouldShowFullLoading = jobs.length === 0;
      if (shouldShowFullLoading) {
        setIsLoading(true);
      }

      try {
        const token = await user.getIdToken();

        // Fetch jobs from backend
        const [jobsRes, techRes, clientsRes] = await Promise.all([
          apiFetch(`/jobs${selectedCompanyId !== 'all' ? `?company_id=${selectedCompanyId}` : ''}`, { token }),
          apiFetch('/technologies', { token }),
          apiFetch(`/clients${selectedCompanyId !== 'all' ? `?company_id=${selectedCompanyId}` : ''}`, { token })
        ]);

        if (cancelled) return;

        // Map technologies
        const technologiesData = techRes.technologies ? techRes.technologies.map(t => t.name) : [];

        // Map jobs and handle candidate counts
        const jobsWithCounts = (jobsRes.jobs || []).map(job => ({
          ...job,
          id: job._id,
          jobTitle: job.title,
          clientId: job.client_id?._id || job.client_id,
          clientName: job.client_id?.name,
          experience: job.experience_required,
          jobLocation: job.location,
          jobCategory: job.category,
          jobType: job.type,
          requiredSkills: job.technologies ? job.technologies.map(t => typeof t === 'object' ? t.name : t) : [],
          createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
          candidateCounts: job.candidate_counts ? {
            waiting: job.candidate_counts.waiting || 0,
            scheduled: job.candidate_counts.scheduled || 0,
            selected: job.candidate_counts.selected || 0,
            rejected: job.candidate_counts.rejected || 0,
            noShow: job.candidate_counts.no_show || 0,
            cancelled: job.candidate_counts.cancelled || 0,
            technicalIssue: job.candidate_counts.technical_issue || 0,
            proxy: job.candidate_counts.proxy || 0,
            onHold: job.candidate_counts.on_hold || 0,
            applied: job.candidate_counts.applied || 0
          } : {
            waiting: 0,
            scheduled: 0,
            selected: 0,
            rejected: 0,
            noShow: 0,
            cancelled: 0,
            technicalIssue: 0,
            proxy: 0,
            onHold: 0,
            applied: 0
          }
        }));

        setJobs(jobsWithCounts)
        setClients((clientsRes.clients || []).map(c => ({ ...c, id: c._id })))
        setTechnologies(technologiesData)
      } catch (error) {
        console.error('Error fetching data:', error)
        if (!cancelled) toast.error('Failed to load data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!cancelled) {
        fetchData(user);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [selectedCompanyId])


  const filteredJobs = jobs.filter(job => {
    const client = clients.find(c => c.id === job.clientId);
    const clientName = (client?.clientName || client?.name || '').toLowerCase();

    const matchesStatus = filters.status === 'all' || job.status === filters.status;
    const matchesType = filters.jobType === 'all' || job.jobType === filters.jobType;
    const matchesCategory = filters.jobCategory === 'all' || job.jobCategory === filters.jobCategory;
    const matchesSearch = !filters.searchQuery ||
      job.jobTitle.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      job.jobLocation.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      clientName.includes(filters.searchQuery.toLowerCase());

    return matchesStatus && matchesType && matchesCategory && matchesSearch;
  });

  // Custom alert functions
  const showAlert = (message, type = 'error') => {
    setAlert({ show: true, message, type })
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setAlert(prev => ({ ...prev, show: false }))
    }, 3000)
  }

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, show: false }))
  }

  // Check company selection before opening create modal
  const handleCreateJobClick = () => {
    if (!selectedCompanyId || selectedCompanyId === 'all') {
      showAlert('Please select a specific company before creating a job', 'error');
      return;
    }

    // If company is valid, open the create modal
    setIsCreateModalOpen(true);
  };

  // Handle job creation
  const handleCreateJob = async (e) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Read from localStorage (same as Header component)
      const selectedCompanyStr = localStorage.getItem('selectedCompany');
      console.log('Selected Company from localStorage:', selectedCompanyStr);

      let currentSelectedCompany = null;
      if (selectedCompanyStr) {
        try {
          currentSelectedCompany = JSON.parse(selectedCompanyStr);
        } catch (e) {
          console.error('Failed to parse selectedCompany from localStorage:', e);
        }
      }

      console.log('Parsed Company Object:', currentSelectedCompany);
      const companyId = currentSelectedCompany?.id || currentSelectedCompany?._id;
      console.log('Extracted Company ID:', companyId);

      // Validate companyId format (Mongo ObjectId is 24 hex characters)
      const isValidObjectId = companyId && /^[0-9a-fA-F]{24}$/.test(companyId);
      console.log('Is Valid ObjectId:', isValidObjectId);

      if (!companyId || companyId === 'all' || !isValidObjectId) {
        showAlert('Please select a valid company from the header before creating a job.', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!newJob.clientId || !newJob.jobTitle || !newJob.description) {
        toast.error('Please fill in all required fields');
        return;
      }

      const payload = {
        client_id: newJob.clientId,
        title: newJob.jobTitle,
        experience_required: newJob.experience,
        location: newJob.jobLocation,
        category: newJob.jobCategory,
        type: newJob.jobType,
        description: newJob.description,
        status: newJob.status,
        required_skills: selectedSkills.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0),
        company_id: companyId
      };

      const res = await apiFetch('/jobs', {
        method: 'POST',
        token,
        body: JSON.stringify(payload)
      });

      if (res.job) {
        setJobs(prev => [{
          ...res.job,
          id: res.job._id,
          jobTitle: res.job.title,
          experience: res.job.experience_required,
          jobLocation: res.job.location,
          jobCategory: res.job.category,
          jobType: res.job.type,
          requiredSkills: res.job.technologies ? res.job.technologies.map(t => typeof t === 'object' ? t.name : t) : [],
          clientId: res.job.client_id?._id || res.job.client_id,
          clientName: res.job.client_id?.name,
          candidateCounts: res.job.candidate_counts || {
            waiting: 0,
            scheduled: 0,
            selected: 0,
            rejected: 0,
            noShow: 0,
            cancelled: 0,
            technicalIssue: 0,
            proxy: 0,
            onHold: 0,
            applied: 0
          }
        }, ...prev])

        setIsCreateModalOpen(false)
        resetNewJob()
        toast.success('Job created successfully')
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error(`Failed to create job: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle job edit
  const handleEditJob = (job) => {
    setEditingJob({
      ...job,
      clientId: job.clientId || '',
      requiredSkills: job.requiredSkills || []
    })
    setSelectedSkills(job.requiredSkills ? job.requiredSkills.join(', ') : '')
    setIsEditModalOpen(true)
  }

  const handleUpdateJob = async (e) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const payload = {
        client_id: editingJob.clientId,
        title: editingJob.jobTitle,
        experience_required: editingJob.experience,
        location: editingJob.jobLocation,
        category: editingJob.jobCategory,
        type: editingJob.jobType,
        description: editingJob.description,
        status: editingJob.status,
        required_skills: selectedSkills.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0)
      }

      const res = await apiFetch(`/jobs/${editingJob.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(payload)
      })

      if (res.job) {
        setJobs(prev => prev.map(job =>
          job.id === editingJob.id ? {
            ...res.job,
            id: res.job._id,
            jobTitle: res.job.title,
            experience: res.job.experience_required,
            jobLocation: res.job.location,
            jobCategory: res.job.category,
            jobType: res.job.type,
            requiredSkills: res.job.technologies ? res.job.technologies.map(t => typeof t === 'object' ? t.name : t) : [],
            clientId: res.job.client_id?._id || res.job.client_id,
            clientName: res.job.client_id?.name,
            candidateCounts: res.job.candidate_counts || job.candidateCounts
          } : job
        ))

        setIsEditModalOpen(false)
        setEditingJob(null)
        setSelectedSkills('')
        toast.success('Job updated successfully')
      }
    } catch (error) {
      console.error('Error updating job:', error)
      toast.error('Failed to update job')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle job deletion
  const handleDeleteClick = (job) => {
    setJobToDelete(job)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await apiFetch(`/jobs/${jobToDelete.id}`, {
        method: 'DELETE',
        token
      })

      setJobs(prev => prev.filter(job => job.id !== jobToDelete.id))
      toast.success('Job deleted successfully')
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job')
    } finally {
      setIsDeleteModalOpen(false)
      setJobToDelete(null)
    }
  }

  const handleSkillsChange = (value) => {
    setSelectedSkills(value)
  }

  // Add this new function to handle status updates
  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      setIsStatusUpdating(jobId)
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await apiFetch(`/jobs/${jobId}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status: newStatus })
      })

      // Update local state
      setJobs(prev => prev.map(job =>
        job.id === jobId ? {
          ...job,
          status: newStatus
        } : job
      ))

      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setIsStatusUpdating(null)
    }
  }

  // Dropdown handling functions
  const handleStatusButtonClick = (e, jobId) => {
    const rect = e.target.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    
    // Calculate position to center the dropdown below the button
    const dropdownWidth = 120 // Approximate width of dropdown
    const buttonCenter = rect.left + rect.width / 2
    const dropdownLeft = buttonCenter - dropdownWidth / 2
    
    setStatusDropdown({
      isOpen: true,
      jobId,
      position: {
        x: dropdownLeft,
        y: rect.bottom + scrollTop
      }
    })
  }

  const handleStatusSelect = (jobId, newStatus) => {
    handleStatusUpdate(jobId, newStatus)
    setStatusDropdown({ isOpen: false, jobId: null, position: { x: 0, y: 0 } })
  }

  const closeStatusDropdown = () => {
    setStatusDropdown({ isOpen: false, jobId: null, position: { x: 0, y: 0 } })
  }

  const handleAddCandidate = (job) => {
    // Check if SuperAdmin has selected a company
    const userDataCookie = Cookies.get('userData');
    const userData = userDataCookie ? JSON.parse(userDataCookie) : null;

    if (userData?.role === 'SuperAdmin' && (!selectedCompanyId || selectedCompanyId === 'all')) {
      showAlert('Please select a company before adding a candidate', 'error');
      return;
    }

    setSelectedJobForCandidate({
      id: job.id,
      clientId: job.clientId,
      jobTitle: job.title || job.jobTitle,
      company: job.company
    });
    setIsAddCandidateModalOpen(true);
  }

  const resetNewJob = () => {
    setNewJob({
      clientId: '',
      jobTitle: '',
      experience: '',
      jobLocation: '',
      jobCategory: 'Hybrid',
      jobType: 'Full Time',
      description: '',
      status: '0',
      requiredSkills: [],
      createdAt: new Date(),
      candidateCounts: {
        applied: 0,
        waiting: 0,
        scheduled: 0,
        selected: 0,
        rejected: 0,
        noShow: 0,
        cancelled: 0,
        technicalIssue: 0,
        proxy: 0,
        onHold: 0
      }
    });
    // Also reset the selected skills state
    setSelectedSkills('');
  };

  const handleApply = (job) => {
    // Check if job is active
    if (job.status !== '0') {
      showAlert('Cannot apply for inactive jobs', 'error');
      return;
    }

    // Check if SuperAdmin has selected a company
    const userDataCookie = Cookies.get('userData');
    const userData = userDataCookie ? JSON.parse(userDataCookie) : null;

    if (userData?.role === 'SuperAdmin' && (!selectedCompanyId || selectedCompanyId === 'all')) {
      showAlert('Please select a company to apply for this job', 'error');
      return;
    }

    setSelectedJobForCandidate({
      id: job.id,
      clientId: job.clientId,
      jobTitle: job.title || job.jobTitle
    });
    setIsAddCandidateModalOpen(true);
  };

  // No longer needed separately as fetchData handles it
  const fetchJobs = () => { };

  return (
    <div className="p-6 min-h-screen overflow-visible">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">Job Listings</h1>
        <button
          onClick={handleCreateJobClick}
          className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors"
          disabled={isSubmitting}
        >
          <FiPlus /> Create New Job
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search jobs, clients, locations..."
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500"
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          </div>

          <div className="relative">
            <select
              className="form-select w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 appearance-none"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="3">Active</option>
              <option value="2">On Hold</option>
              <option value="1">Inactive</option>
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              className="form-select w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 appearance-none"
              value={filters.jobType}
              onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
            >
              <option value="all">All Types</option>
              <option value="Full Time">Full Time</option>
              <option value="Contract">Contract</option>
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              className="form-select w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 appearance-none"
              value={filters.jobCategory}
              onChange={(e) => setFilters(prev => ({ ...prev, jobCategory: e.target.value }))}
            >
              <option value="all">All Categories</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Remote</option>
              <option value="Onsite">Onsite</option>
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading jobs...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-visible">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gradient-to-r from-primary-500/10 via-accent-500/5 to-primary-500/10 dark:from-primary-900/50 dark:via-accent-900/30 dark:to-primary-900/50">
                  <th scope="col" className="sticky left-0 bg-inherit px-4 py-3.5 text-left text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">#</th>
                  <th scope="col" className="sticky left-[60px] bg-inherit px-4 py-3.5 text-left text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Client</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Job Role</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Apply</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Waiting</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Scheduled</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">In Review</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Selected</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Rejected</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">No Show</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Cancelled</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Tech Issue</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Proxy</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">On Hold</th>
                  
                  <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider whitespace-nowrap">Created</th>
                  <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredJobs.map((job, index) => {
                  const client = clients.find(c => c.id === job.clientId);
                  // Calculate total candidates by counting all candidates with this jobId
                  const totalCandidates = job.candidateCounts ? Object.values(job.candidateCounts).reduce((sum, count) => sum + count, 0) : 0;

                  return (
                    <tr key={job.id || job._id || index} className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/80">
                      <td className="sticky left-0 bg-inherit group-hover:bg-gray-50/80 dark:group-hover:bg-gray-800/80 px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {index + 1}
                      </td>
                      <td className="sticky left-[60px] bg-inherit group-hover:bg-gray-50/80 dark:group-hover:bg-gray-800/80 px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {job.clientName || client?.clientName || client?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{job.jobTitle}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{job.jobLocation}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleApply(job)}
                          disabled={job.status !== '0'}
                          title={job.status !== '0' ? 'Cannot apply for inactive jobs' : ''}
                          className={`inline-flex items-center justify-center p-2 rounded-full transition-all duration-200
                            ${job.status === '0' 
                              ? 'text-primary-600 hover:text-white hover:bg-primary-500 dark:text-primary-400 dark:hover:text-white dark:hover:bg-primary-600' 
                              : 'text-gray-400 cursor-not-allowed opacity-50'}`}
                        >
                          <FiUserPlus className="w-5 h-5" />
                        </button>
                      </td>
                      {/* Candidate Status Columns */}
                      {['total', 'waiting', 'scheduled', 'interviewInReview', 'selected', 'rejected', 'noShow', 'cancelled', 'technicalIssue', 'proxy', 'onHold'].map((status) => (
                        <td key={status} className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-full text-xs font-medium
                            ${status === 'total' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' :
                              status === 'waiting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' :
                                status === 'scheduled' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200' :
                                  status === 'interviewInReview' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200' :
                                    status === 'selected' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                                    status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' :
                                      status === 'noShow' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' :
                                        status === 'cancelled' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200' :
                                          status === 'technicalIssue' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200' :
                                            status === 'proxy' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' :
                                              status === 'onHold' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200'}`}>
                            {status === 'total' ?
                              totalCandidates :
                              job.candidateCounts?.[status] || 0}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {mounted && job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-GB') : '...'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => handleStatusButtonClick(e, job.id)}
                            className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full w-full justify-center
                              ${jobStatusConfig[job.status]?.style || 'bg-gray-100 text-gray-800'}`}
                            disabled={isStatusUpdating === job.id}
                          >
                            {isStatusUpdating === job.id ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <>
                                {jobStatusConfig[job.status]?.label || job.status}
                                <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEditJob(job)}
                            className="p-1.5 text-primary-600 hover:text-white hover:bg-primary-500 rounded-full dark:text-primary-400 dark:hover:text-white dark:hover:bg-primary-600 transition-all duration-200"
                            title="Edit Job"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(job)}
                            className="p-1.5 text-red-600 hover:text-white hover:bg-red-500 rounded-full dark:text-red-400 dark:hover:text-white dark:hover:bg-red-600 transition-all duration-200"
                            title="Delete Job"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
        className="relative z-50"
      >
        {/* Backdrop with blur effect */}
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md" aria-hidden="true" />

        {/* Modal Container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative w-full max-w-5xl max-h-[90vh] transform overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl transition-all flex flex-col">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-gradient-to-br from-primary-500/30 to-accent-500/30 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-gradient-to-tr from-accent-500/30 to-primary-500/30 rounded-full blur-2xl" />

            {/* Modal Header */}
            <div className="relative flex items-center justify-between border-b border-gray-200/30 dark:border-gray-700/30 pb-6 p-8">
              <div>
                <Dialog.Title className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
                  Create New Job
                </Dialog.Title>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Fill in the details below to create a new job posting
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
                className="rounded-full p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              {/* Form with enhanced styling */}
              <form onSubmit={handleCreateJob} className="relative space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  {/* Client Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Select Client
                    </label>
                    <div className="relative">
                      <select
                        value={newJob.clientId}
                        onChange={(e) => setNewJob(prev => ({ ...prev, clientId: e.target.value }))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                        required
                      >
                        <option value="">Select a client</option>
                        {clients.map(client => (
                          <option key={client.id || client._id} value={client.id || client._id}>
                            {client.clientName || client.name || 'Unnamed Client'}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    {clients.length === 0 && (
                      <p className="mt-2 text-sm text-red-500">
                        No clients found for your company. Please add clients first.
                      </p>
                    )}
                  </div>

                  {/* Job Title and Experience Row */}
                  <div className="col-span-2 grid grid-cols-2 gap-8">
                    {/* Job Title */}
                    <div>
                      <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={newJob.jobTitle}
                        onChange={(e) => setNewJob(prev => ({ ...prev, jobTitle: e.target.value }))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                        placeholder="e.g. Senior Software Engineer"
                        required
                      />
                    </div>

                    {/* Experience */}
                    <div>
                      <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                        Experience Required
                      </label>
                      <input
                        type="text"
                        value={newJob.experience}
                        onChange={(e) => setNewJob(prev => ({ ...prev, experience: e.target.value }))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                        placeholder="e.g. 3-5 years"
                      />
                    </div>
                  </div>

                  {/* Job Location */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newJob.jobLocation}
                      onChange={(e) => setNewJob(prev => ({ ...prev, jobLocation: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                      placeholder="e.g. New York, NY"
                      required
                    />
                  </div>

                  {/* Job Category */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Category
                    </label>
                    <select
                      value={newJob.jobCategory}
                      onChange={(e) => setNewJob(prev => ({ ...prev, jobCategory: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    >
                      <option value="Hybrid">Hybrid</option>
                      <option value="Remote">Remote</option>
                      <option value="Onsite">Onsite</option>
                    </select>
                  </div>

                  {/* Job Type */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Type
                    </label>
                    <select
                      value={newJob.jobType}
                      onChange={(e) => setNewJob(prev => ({ ...prev, jobType: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    >
                      <option value="Full Time">Full Time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>

                  {/* Required Skills */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Required Skills
                    </label>
                    <input
                      type="text"
                      value={selectedSkills}
                      onChange={(e) => handleSkillsChange(e.target.value)}
                      placeholder="Enter skills separated by commas (e.g., React, Node.js, MongoDB)"
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Separate multiple skills with commas
                    </p>
                  </div>

                  {/* Description */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Job Description
                    </label>
                    <textarea
                      value={newJob.description}
                      onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                      placeholder="Enter detailed job description..."
                      required
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200/30 dark:border-gray-700/30">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-primary-500/25"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FiPlus className="h-4 w-4" />
                        Create Job
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Edit Job Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        className="relative z-50"
      >
        {/* Backdrop with blur effect */}
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md" aria-hidden="true" />

        {/* Modal Container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative w-full max-w-5xl max-h-[90vh] transform overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl transition-all flex flex-col">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-gradient-to-br from-primary-500/30 to-accent-500/30 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-gradient-to-tr from-accent-500/30 to-primary-500/30 rounded-full blur-2xl" />

            {/* Modal Header */}
            <div className="relative flex items-center justify-between border-b border-gray-200/30 dark:border-gray-700/30 pb-6 p-8">
              <div>
                <Dialog.Title className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
                  Edit Job
                </Dialog.Title>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Update the job details below
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => !isSubmitting && setIsEditModalOpen(false)}
                className="rounded-full p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              {/* Form */}
              <form onSubmit={handleUpdateJob} className="relative space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  {/* Client Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Select Client
                    </label>
                    <select
                      value={editingJob?.clientId || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, clientId: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                      required
                    >
                      <option value="">Select a client</option>
                      {clients.map((client, idx) => (
                        <option key={client.id || client._id || idx} value={client.id || client._id}>
                          {client.clientName || client.name || 'Unnamed Client'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Job Title and Experience Row */}
                  <div className="col-span-2 grid grid-cols-2 gap-8">
                    {/* Job Title */}
                    <div>
                      <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={editingJob?.jobTitle || ''}
                        onChange={(e) => setEditingJob(prev => ({ ...prev, jobTitle: e.target.value }))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                        placeholder="e.g. Senior Software Engineer"
                        required
                      />
                    </div>

                    {/* Experience */}
                    <div>
                      <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                        Experience Required
                      </label>
                      <input
                        type="text"
                        value={editingJob?.experience || ''}
                        onChange={(e) => setEditingJob(prev => ({ ...prev, experience: e.target.value }))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                        placeholder="e.g. 3-5 years"
                      />
                    </div>
                  </div>

                  {/* Job Location */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editingJob?.jobLocation || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, jobLocation: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                      placeholder="e.g. New York, NY"
                      required
                    />
                  </div>

                  {/* Job Category */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Category
                    </label>
                    <select
                      value={editingJob?.jobCategory || 'Hybrid'}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, jobCategory: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    >
                      <option value="Hybrid">Hybrid</option>
                      <option value="Remote">Remote</option>
                      <option value="Onsite">Onsite</option>
                    </select>
                  </div>

                  {/* Job Type */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Type
                    </label>
                    <select
                      value={editingJob?.jobType || 'Full Time'}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, jobType: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    >
                      <option value="Full Time">Full Time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>

                  {/* Required Skills */}
                  <div>
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Required Skills
                    </label>
                    <input
                      type="text"
                      value={selectedSkills}
                      onChange={(e) => handleSkillsChange(e.target.value)}
                      placeholder="Enter skills separated by commas (e.g., React, Node.js, MongoDB)"
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Separate multiple skills with commas
                    </p>
                  </div>

                  {/* Description */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Job Description
                    </label>
                    <textarea
                      value={editingJob?.description || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                      placeholder="Enter detailed job description..."
                      required
                    />
                  </div>

                  {/* Job Status */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                      Status
                    </label>
                    <select
                      value={editingJob?.status || '0'}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                    >
                      <option value="0">Active</option>
                      <option value="1">Inactive</option>
                      <option value="2">On Hold</option>
                    </select>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200/30 dark:border-gray-700/30">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Updating...
                      </>
                    ) : (
                      <>
                        <FiEdit2 className="h-4 w-4" />
                        Update Job
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
        className="relative z-50"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" aria-hidden="true" />

        {/* Modal Container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
            {/* Warning Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-8 w-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="mt-4 text-center">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Job
              </Dialog.Title>
              <div className="mt-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {jobToDelete?.jobTitle}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>

              {/* Job Details Summary */}
              <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <p><span className="font-medium">Location:</span> {jobToDelete?.jobLocation}</p>
                  <p><span className="font-medium">Type:</span> {jobToDelete?.jobType}</p>
                  <p><span className="font-medium">Category:</span> {jobToDelete?.jobCategory}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="inline-flex justify-center items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FiTrash2 className="mr-2 h-4 w-4" />
                    Delete Job
                  </>
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Add New Candidate Modal */}
      <AddNewCandidate
        isOpen={isAddCandidateModalOpen}
        onClose={() => {
          setIsAddCandidateModalOpen(false);
          setSelectedJobForCandidate(null);
        }}
        prefilledJobData={selectedJobForCandidate}
        showClientJobDropdowns={false}
        selectedJob={selectedJobForCandidate}
        selectedClient={{ id: selectedJobForCandidate?.clientId }}
        onCandidateAdded={async () => {
          await fetchJobs(); // Wait for jobs to be fetched
          setIsAddCandidateModalOpen(false);
        }}
      />

      {/* Status Dropdown - Fixed positioning to break out of table */}
      {statusDropdown.isOpen && (
        <div
          className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 border border-gray-200 dark:border-gray-700 z-[9999] min-w-[120px] overflow-hidden"
          style={{
            left: `${statusDropdown.position.x}px`,
            top: `${statusDropdown.position.y}px`
          }}
        >
          <div className="py-1">
            {['0', '1', '2'].map((status) => {
              const job = jobs.find(j => j.id === statusDropdown.jobId);
              return (
                <button
                  key={status}
                  onClick={() => handleStatusSelect(statusDropdown.jobId, status)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors duration-200 block
                    ${job?.status === status ?
                      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  disabled={job?.status === status || isStatusUpdating === statusDropdown.jobId}
                >
                  <div className="flex items-center justify-between">
                    <span>{jobStatusConfig[status]?.label || status}</span>
                    {job?.status === status && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {statusDropdown.isOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={closeStatusDropdown}
        />
      )}

      {/* Custom Alert Component */}
      {alert.show && (
        <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-right">
          <div className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all duration-200
            ${alert.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              : alert.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : alert.type === 'warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
                  : 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }
          `}>
            {/* Icon */}
            <div className="flex-shrink-0">
              {alert.type === 'error' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {alert.type === 'success' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {alert.type === 'warning' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {alert.type === 'info' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Message */}
            <p className="text-sm font-medium">
              {alert.message}
            </p>

            {/* Close Button */}
            <button
              onClick={hideAlert}
              className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobsPage