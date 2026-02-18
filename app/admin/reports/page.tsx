'use client';
import React, { useState, useEffect } from 'react';
import { FiDownload, FiBarChart2, FiTrendingUp, FiUsers, FiFilter, FiRefreshCw } from 'react-icons/fi';
import { 
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';

const ReportPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [candidateStats, setCandidateStats] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [vendorData, setVendorData] = useState([]);
  const [jobStats, setJobStats] = useState([]);
  const [hiringTrends, setHiringTrends] = useState([]);
  const [locationData, setLocationData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const db = getFirestore();
      
      try {
        // Fetch real candidate status data
        const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
        const candidates = candidatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate candidate status statistics
        const statusCounts = candidates.reduce((acc, candidate) => {
          const status = candidate.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const statusData = Object.entries(statusCounts).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value
        }));
        setCandidateStats(statusData);

        // Fetch vendor data
        const vendorsSnapshot = await getDocs(collection(db, 'Vendor'));
        const vendors = vendorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate vendor statistics
        const vendorStats = vendors.map(vendor => {
          const vendorCandidates = candidates.filter(c => c.vendorId === vendor.id);
          const selectedCandidates = vendorCandidates.filter(c => c.status === 'Selected');
          return {
            name: vendor.vendorName || vendor.name || 'Unknown Vendor',
            candidates: vendorCandidates.length,
            selected: selectedCandidates.length,
          };
        }).filter(v => v.candidates > 0);
        setVendorData(vendorStats);

        // Fetch job data
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate job statistics by category
        const jobCategoryCounts = jobs.reduce((acc, job) => {
          const category = job.jobCategory || 'Other';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        const jobStats = Object.entries(jobCategoryCounts).map(([category, openings]) => {
          const filledJobs = jobs.filter(job => 
            job.jobCategory === category && 
            candidates.some(c => c.jobId === job.id && c.status === 'Selected')
          ).length;
          
          return {
            category: category.charAt(0).toUpperCase() + category.slice(1),
            openings,
            filled: filledJobs
          };
        });
        setJobStats(jobStats);

        // Calculate location statistics
        console.log('=== DEBUG: Candidate Locations ===');
        candidates.forEach(candidate => {
          console.log('Candidate:', candidate.name, 'Location:', candidate.location, 'JobLocation:', candidate.jobLocation);
        });
        
        const locationCounts = candidates.reduce((acc, candidate) => {
          const location = candidate.location || candidate.jobLocation || 'Unknown';
          console.log('Processing location:', location);
          acc[location] = (acc[location] || 0) + 1;
          return acc;
        }, {});

        console.log('Location counts:', locationCounts);

        const locationData = Object.entries(locationCounts).map(([location, count]) => ({
          location: location.charAt(0).toUpperCase() + location.slice(1),
          count
        })).sort((a, b) => b.count - a.count).slice(0, 10);
        
        console.log('Final location data:', locationData);
        setLocationData(locationData);

        // Calculate hiring trends by job type
        const jobTypeCounts = jobs.reduce((acc, job) => {
          const type = job.jobType || 'Other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        const hiringTrends = Object.entries(jobTypeCounts).map(([type, count]) => ({
          month: new Date().toLocaleString('default', { month: 'short' }),
          fullTime: type === 'Full Time' ? count : 0,
          contract: type === 'Contract' ? count : 0,
          remote: type === 'Remote' ? count : 0
        }));
        setHiringTrends(hiringTrends);

        // Generate timeline data based on actual candidate creation dates
        const timelineData = candidates.reduce((acc, candidate) => {
          if (candidate.createdAt) {
            const month = new Date(candidate.createdAt.toDate()).toLocaleString('default', { month: 'short' });
            const existing = acc.find(item => item.date === month);
            
            if (existing) {
              existing.candidates++;
              if (candidate.status === 'Interviewed' || candidate.status === 'Selected') {
                existing.interviews++;
              }
              if (candidate.status === 'Selected') {
                existing.hired++;
              }
            } else {
              acc.push({
                date: month,
                candidates: 1,
                interviews: (candidate.status === 'Interviewed' || candidate.status === 'Selected') ? 1 : 0,
                hired: candidate.status === 'Selected' ? 1 : 0
              });
            }
          }
          return acc;
        }, []);

        setTimelineData(timelineData);

      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod]);

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
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiRefreshCw className="w-5 h-5 text-accent-500" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg">
          <FiDownload className="w-5 h-5" />
          Export Report
        </button>
      </motion.div>

      {/* Charts Grid */}
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
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
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
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorCandidates" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHired" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ffc658" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Area type="monotone" dataKey="candidates" stroke="#8884d8" fillOpacity={1} fill="url(#colorCandidates)" />
                <Area type="monotone" dataKey="interviews" stroke="#82ca9d" fillOpacity={1} fill="url(#colorInterviews)" />
                <Area type="monotone" dataKey="hired" stroke="#ffc658" fillOpacity={1} fill="url(#colorHired)" />
              </AreaChart>
            </ResponsiveContainer>
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
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={jobStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="openings" fill="#8884d8" name="Total Openings" radius={[0, 4, 4, 0]} />
                <Bar dataKey="filled" fill="#82ca9d" name="Positions Filled" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationData}
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="location"
                  label={({location, percent}) => `${location} ${(percent * 100).toFixed(0)}%`}
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
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
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
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
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ReportPage;