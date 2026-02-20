'use client';
import React, { useState, useEffect } from 'react';
import { FiDownload, FiBarChart2, FiTrendingUp, FiUsers, FiBriefcase, FiCheckSquare, FiCalendar } from 'react-icons/fi';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

// Company context interface
interface Company {
  id: string;
  name: string;
}

const ReportPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [candidateStats, setCandidateStats] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [vendorData, setVendorData] = useState<any[]>([]);
  const [jobStats, setJobStats] = useState<any[]>([]);
  const [hiringTrends, setHiringTrends] = useState<any[]>([]);
  const [rawCandidates, setRawCandidates] = useState<any[]>([]);
  const [rawJobs, setRawJobs] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);
  const [locationData, setLocationData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({
    totalCandidates: 0,
    totalInterviews: 0,
    totalSelected: 0,
    activeJobs: 0
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Add a refresh function
  const fetchData = async () => {
    setIsLoading(true);

    try {
      // Get auth token
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Build query params based on selected company
      let queryParams = '';
      if (selectedCompany?.id && selectedCompany.id !== 'all') {
        queryParams = `?company_id=${selectedCompany.id}`;
      }

      // Fetch real candidate status data from rekrooot server
      const candidatesRes = await apiFetch(`/candidates${queryParams}`, { token }) as { candidates: any[] };
      const candidates = candidatesRes.candidates || [];

      // Debug: Log the raw data
      console.log('Raw candidates data:', candidates);
      console.log('Selected period:', selectedPeriod);
      console.log('Selected company:', selectedCompany);

      // Build status counts and data helpers
      const now = new Date();
      const isWithinPeriod = (dateString: string) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (selectedPeriod === 'daily') {
          return date.toDateString() === now.toDateString();
        } else if (selectedPeriod === 'weekly') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return date >= weekAgo;
        } else if (selectedPeriod === 'monthly') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return date >= monthAgo;
        }
        return true; // All time
      };

      // Filter candidates and jobs based on selected period
      const filteredCandidates = candidates.filter((c: any) => isWithinPeriod(c.createdAt || c.created_at));

      // Fetch job data from rekrooot server
      const jobsRes: any = await apiFetch(`/jobs${queryParams}`, { token });
      const jobs = jobsRes.jobs || [];
      const filteredJobs = jobs.filter((j: any) => isWithinPeriod(j.createdAt || j.created_at));

      // Calculate candidate status statistics
      const statusCounts = filteredCandidates.reduce((acc: any, candidate: any) => {
        const status = candidate.status || 0;
        const statusLabels: { [key: string]: string } = { 0: 'waiting', 1: 'scheduled', 2: 'rescheduled', 3: 'in review', 4: 'interviewed', 5: 'cancelled' };
        const statusName = statusLabels[status] || 'Unknown';
        acc[statusName] = (acc[statusName] || 0) + 1;
        return acc;
      }, {});

      const statusData = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value as number
      }));
      setCandidateStats(statusData);

      // Fetch vendor data from rekrooot server
      const vendorsRes: any = await apiFetch(`/vendors${queryParams}`, { token });
      const vendors = vendorsRes.vendors || [];

      // Calculate vendor statistics using filtered candidates
      const vendorStats = vendors.map((vendor: any) => {
        const vendorIdString = (vendor._id || vendor.id)?.toString();
        const vendorCandidates = filteredCandidates.filter((c: any) => {
          const candidateVendorId = (c.vendor_id?._id || c.vendor_id)?.toString();
          return candidateVendorId === vendorIdString;
        });
        const selectedCount = vendorCandidates.filter((c: any) =>
          c.interview_id?.status === 3 || c.result === '1' || c.result === 1 || c.final_status === 'SELECTED'
        ).length;
        return {
          name: vendor.vendorName || vendor.name || 'Unknown Vendor',
          candidates: vendorCandidates.length,
          selected: selectedCount,
        };
      });
      setVendorData(vendorStats);

      // Calculate job statistics by category using filtered jobs
      const jobCategoryCounts = filteredJobs.reduce((acc: any, job: any) => {
        const category = job.category || 'Other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const jobStatsData = Object.entries(jobCategoryCounts).map(([category, count]) => {
        const categoryJobs = filteredJobs.filter((job: any) => (job.category || 'Other') === category);

        let totalSelected = 0;
        let totalCandidates = 0;

        categoryJobs.forEach((job: any) => {
          const counts = job.candidate_counts || {};
          totalSelected += (counts.selected || 0);
          totalCandidates += (
            (counts.waiting || 0) +
            (counts.scheduled || 0) +
            (counts.rescheduled || 0) +
            (counts.interview_in_review || 0) +
            (counts.selected || 0) +
            (counts.rejected || 0) +
            (counts.no_show || 0) +
            (counts.cancelled || 0) +
            (counts.technical_issue || 0) +
            (counts.proxy || 0) +
            (counts.on_hold || 0)
          );
        });

        return {
          category: category.charAt(0).toUpperCase() + category.slice(1),
          jobs: count as number,
          selected: totalSelected,
          total: totalCandidates
        };
      });
      setJobStats(jobStatsData);

      // Calculate location statistics using filtered candidates
      const locationCounts = filteredCandidates.reduce((acc: any, candidate: any) => {
        const location = candidate.location || 'Unknown';
        // Normalize location to title case to handle case variations
        const normalizedLocation = location === 'Unknown' ? 'Unknown' : 
          location.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        acc[normalizedLocation] = (acc[normalizedLocation] || 0) + 1;
        return acc;
      }, {});

      const locationData = Object.entries(locationCounts).map(([location, count]) => ({
        location,
        count
      }));
      setLocationData(locationData);

      // Generate timeline data based on filtered candidates
      const timelineData = filteredCandidates.reduce((acc: any[], candidate: any) => {
        const createdAt = candidate.createdAt || candidate.created_at;
        if (createdAt) {
          const date = new Date(createdAt);
          const month = date.toLocaleString('default', { month: 'short' });
          const existing = acc.find(item => item.date === month);

          // Accurate Pipeline Metrics:
          // 1. Interviews: Candidates who were scheduled or completed interviews
          const hasReachedInterview = candidate.interview_id || (candidate.status >= 1 && candidate.status <= 4);
          // 2. Selected: Candidates who were specifically marked as selected
          const isActuallySelected = candidate.interview_id?.status === 3 || candidate.result === '1' || candidate.result === 1 || candidate.final_status === 'SELECTED';

          if (existing) {
            existing.candidates++;
            if (hasReachedInterview) existing.interviews++;
            if (isActuallySelected) existing.selected++;
          } else {
            acc.push({
              date: month,
              candidates: 1,
              interviews: hasReachedInterview ? 1 : 0,
              selected: isActuallySelected ? 1 : 0
            });
          }
        }
        return acc;
      }, []);

      // Sort timeline data by biological month order for consistent trend display
      const monthPriority: { [key: string]: number } = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
      };
      timelineData.sort((a: any, b: any) => (monthPriority[a.date] || 0) - (monthPriority[b.date] || 0));

      setTimelineData(timelineData);
      setRawCandidates(filteredCandidates);
      setRawJobs(filteredJobs);
      setRawVendors(vendors);

      // Calculate overall summary stats
      const totalCandidates = filteredCandidates.length;
      const totalInterviews = filteredCandidates.filter((c: any) => c.interview_id || (c.status >= 1 && c.status <= 4)).length;
      const totalSelected = filteredCandidates.filter((c: any) =>
        c.interview_id?.status === 3 || c.result === '1' || c.result === 1 || c.final_status === 'SELECTED'
      ).length;
      const activeJobs = jobs.filter((j: any) => j.status === '0').length;

      setSummaryStats({
        totalCandidates,
        totalInterviews,
        totalSelected,
        activeJobs
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    try {
      if (rawCandidates.length === 0 && rawJobs.length === 0) {
        alert('No data available to export');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. Candidates Sheet
      const candidatesData = rawCandidates.map(c => ({
        'Full Name': c.full_name || 'N/A',
        'Email': c.email || 'N/A',
        'Contact': c.primary_contact || 'N/A',
        'Experience': c.experience_years || 'N/A',
        'Location': c.location || 'N/A',
        'Status': (['Waiting', 'Scheduled', 'Rescheduled', 'In Review', 'Interviewed', 'Cancelled'])[c.status] || 'Unknown',
        'Job': c.job_id?.title || 'N/A',
        'Client': c.client_id?.name || 'N/A',
        'Vendor': c.vendor_id?.name || 'N/A',
        'Created At': new Date(c.createdAt || c.created_at).toLocaleDateString()
      }));
      const wsCandidates = XLSX.utils.json_to_sheet(candidatesData);
      XLSX.utils.book_append_sheet(wb, wsCandidates, 'Candidates');

      // 2. Job Statistics Sheet
      const wsJobs = XLSX.utils.json_to_sheet(jobStats);
      XLSX.utils.book_append_sheet(wb, wsJobs, 'Job Category Stats');

      // 3. Vendor Performance Sheet
      const wsVendors = XLSX.utils.json_to_sheet(vendorData);
      XLSX.utils.book_append_sheet(wb, wsVendors, 'Vendor Performance');

      // 4. Recruitment Pipeline Sheet
      const pipelineDataExport = timelineData.map(item => ({
        'Month': item.date,
        'Applied': item.candidates,
        'Interviews': item.interviews,
        'Hires': item.selected
      }));
      const wsPipeline = XLSX.utils.json_to_sheet(pipelineDataExport);
      XLSX.utils.book_append_sheet(wb, wsPipeline, 'Recruitment Pipeline');

      // 5. Location Distribution Sheet
      const locationDataExport = locationData.map(item => ({
        'Location': item.location,
        'Count': item.count
      }));
      const wsLocation = XLSX.utils.json_to_sheet(locationDataExport);
      XLSX.utils.book_append_sheet(wb, wsLocation, 'Location Distribution');

      // Generate filename
      const companyName = selectedCompany?.name || 'All';
      const fileName = `Rekrooot_Report_${companyName}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report');
    }
  };

  // Sync selected company from header (via localStorage + custom event)
  useEffect(() => {
    // Read persisted company on mount
    const savedCompany = localStorage.getItem('selectedCompany');
    if (savedCompany) {
      try {
        setSelectedCompany(JSON.parse(savedCompany));
      } catch (e) {
        console.error('Error parsing selectedCompany:', e);
        setSelectedCompany({ id: 'all', name: 'All' });
      }
    } else {
      setSelectedCompany({ id: 'all', name: 'All' });
    }

    // Listen for header company changes
    const handleCompanyChange = (event: CustomEvent<Company>) => {
      setSelectedCompany(event.detail);
    };
    window.addEventListener('companyChanged', handleCompanyChange as EventListener);
    return () => window.removeEventListener('companyChanged', handleCompanyChange as EventListener);
  }, []);

  // Re-fetch whenever selected company or period changes
  useEffect(() => {
    if (selectedCompany === null) return; // wait until company is resolved from localStorage
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, selectedPeriod]);

  // Auth state listener — also refetch when the user signs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCandidateStats([]);
        setTimelineData([]);
        setVendorData([]);
        setJobStats([]);
        setHiringTrends([]);
        setLocationData([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000'];

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="p-8 max-w-[1800px] mx-auto min-h-screen"
    >
      {/* Header Section */}
      <motion.div {...fadeInUp} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <FiBarChart2 className="w-8 h-8 text-accent-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          {selectedCompany && selectedCompany.id !== 'all' && (
            <span className="ml-2 px-3 py-1 text-sm font-medium rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-500/20">
              {selectedCompany.name}
            </span>
          )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Comprehensive recruitment analytics and insights
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        {...fadeInUp}
        className="flex flex-wrap justify-between items-center mb-10 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"
      >
        <div className="flex gap-4 items-center">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg"
        >
          <FiDownload className="w-5 h-5" />
          Export Report
        </button>
      </motion.div>

      {/* Charts Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <div className="text-lg text-gray-500 dark:text-gray-400">Loading reports...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Candidate Status Distribution */}
          <motion.div
            {...fadeInUp}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow"
          >
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-accent-500" />
              Candidate Status Distribution
            </h3>
            <div className="h-[400px] w-full">
              {candidateStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={candidateStats}
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {candidateStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[400px]">
                  <div className="text-gray-500 dark:text-gray-400">No data available</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Candidate Timeline */}
          <motion.div
            {...fadeInUp}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow"
          >
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
              <FiTrendingUp className="w-5 h-5 text-accent-500" />
              Recruitment Pipeline
            </h3>
            <div className="h-[400px] w-full">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorCandidates" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSelected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ffc658" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Area type="monotone" dataKey="candidates" stroke="#8884d8" fillOpacity={1} fill="url(#colorCandidates)" />
                    <Area type="monotone" dataKey="interviews" stroke="#82ca9d" fillOpacity={1} fill="url(#colorInterviews)" />
                    <Area type="monotone" dataKey="selected" stroke="#ffc658" fillOpacity={1} fill="url(#colorSelected)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[400px]">
                  <div className="text-gray-500 dark:text-gray-400">No data available</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Job Category Statistics */}
          <motion.div
            {...fadeInUp}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow"
          >
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
              <FiBarChart2 className="w-5 h-5 text-accent-500" />
              Job Category Statistics
            </h3>
            <div className="h-[400px] w-full">
              {jobStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart layout="vertical" data={jobStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="category" type="category" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Bar dataKey="jobs" fill="#8884d8" name="No. of Jobs" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" fill="#0088FE" name="Total Candidates" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="selected" fill="#82ca9d" name="Selected" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[400px]">
                  <div className="text-gray-500 dark:text-gray-400">No data available</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Location Distribution */}
          <motion.div
            {...fadeInUp}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow"
          >
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
              <FiBarChart2 className="w-5 h-5 text-accent-500" />
              Location Distribution
            </h3>
            <div className="h-[400px] w-full">
              {locationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={locationData}
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="location"
                    >
                      {locationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[400px]">
                  <div className="text-gray-500 dark:text-gray-400">No data available</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Vendor Performance */}
          <motion.div
            {...fadeInUp}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow lg:col-span-2"
          >
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
              <FiBarChart2 className="w-5 h-5 text-accent-500" />
              Vendor Performance
            </h3>
            <div className="h-[400px] w-full">
              {vendorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={vendorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Bar dataKey="candidates" fill="#8884d8" name="Total Candidates" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="selected" fill="#82ca9d" name="Selected Candidates" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[400px]">
                  <div className="text-gray-500 dark:text-gray-400">No data available</div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ReportPage;