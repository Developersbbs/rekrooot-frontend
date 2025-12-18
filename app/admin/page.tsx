'use client';
import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, PieChart, Pie, Cell,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';


type StatState = {
  totalJobs: number;
  totalClients: number;
  totalVendors: number;
  appliedCandidates: number;
  selectedCandidates: number;
  rejectedCandidates: number;
};

type MonthlyTrend = {
  month: string;
  interviews: number;
  hired: number;
};

type CandidateStatusDatum = {
  name: string;
  value: number;
};

type InterviewRow = {
  id: string;
  candidateName: string;
  email: string;
  primaryContact: string;
  jobName: string;
  clientName: string;
  vendorName: string;
  dateISO: string; // ISO date string
  status: 'pending' | 'completed';
};

function DashboardPage() {
  const [filterDate, setFilterDate] = useState<'today' | 'tomorrow'>('today');

  const stats: StatState = {
    totalJobs: 48,
    totalClients: 12,
    totalVendors: 7,
    appliedCandidates: 186,
    selectedCandidates: 23,
    rejectedCandidates: 41,
  };

  const monthlyTrends: MonthlyTrend[] = [
    { month: 'Jan', interviews: 12, hired: 3 },
    { month: 'Feb', interviews: 18, hired: 4 },
    { month: 'Mar', interviews: 25, hired: 8 },
    { month: 'Apr', interviews: 21, hired: 6 },
    { month: 'May', interviews: 29, hired: 9 },
    { month: 'Jun', interviews: 24, hired: 7 },
  ];

  const candidateStatusData: CandidateStatusDatum[] = [
    { name: 'Applied', value: 120 },
    { name: 'Scheduled', value: 28 },
    { name: 'Selected', value: 23 },
    { name: 'Rejected', value: 41 },
  ];

  const interviews: InterviewRow[] = [
    {
      id: 'i1',
      candidateName: 'Aarav Mehta',
      email: 'aarav.mehta@example.com',
      primaryContact: '+91 90000 11111',
      jobName: 'Frontend Developer',
      clientName: 'Acme Corp',
      vendorName: 'TalentBridge',
      dateISO: new Date().toISOString(),
      status: 'pending',
    },
    {
      id: 'i2',
      candidateName: 'Sara Khan',
      email: 'sara.khan@example.com',
      primaryContact: '+91 90000 22222',
      jobName: 'Node.js Developer',
      clientName: 'Rekrooot Labs',
      vendorName: 'HireFast',
      dateISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: 'i3',
      candidateName: 'John Dsouza',
      email: 'john.dsouza@example.com',
      primaryContact: '+91 90000 33333',
      jobName: 'QA Engineer',
      clientName: 'Globex',
      vendorName: 'TalentBridge',
      dateISO: new Date().toISOString(),
      status: 'completed',
    },
  ];

  const filteredInterviews = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    return interviews.filter((i) => {
      const d = new Date(i.dateISO);
      if (filterDate === 'today') return d >= today && d < tomorrow;
      return d >= tomorrow && d < dayAfterTomorrow;
    });
  }, [filterDate, interviews]);

  const monthlyData = useMemo(() => {
    return monthlyTrends;
  }, [monthlyTrends]);

  const COLORS = ['#2f4858', '#fb8404', '#64748b', '#cbd5e1'];

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <div className="p-6 bg-gradient-to-br min-h-screen">
      <motion.h1 
        className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-8 relative"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        Dashboard
      </motion.h1>
      
      {/* Stats Counter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
        {[
          { title: 'Total Jobs', value: stats.totalJobs, bgColor: 'bg-primary-50 dark:bg-primary-900/30', textColor: 'text-primary-700 dark:text-primary-300' },
          { title: 'Total Clients', value: stats.totalClients, bgColor: 'bg-accent-50 dark:bg-accent-900/30', textColor: 'text-accent-700 dark:text-accent-300' },
          { title: 'Total Vendors', value: stats.totalVendors, bgColor: 'bg-gray-50 dark:bg-gray-900/30', textColor: 'text-gray-700 dark:text-gray-300' },
          { title: 'Applied Candidates', value: stats.appliedCandidates, bgColor: 'bg-primary-50 dark:bg-primary-900/30', textColor: 'text-primary-700 dark:text-primary-300' },
          { title: 'Selected Candidates', value: stats.selectedCandidates, bgColor: 'bg-accent-50 dark:bg-accent-900/30', textColor: 'text-accent-700 dark:text-accent-300' },
          { title: 'Rejected Candidates', value: stats.rejectedCandidates, bgColor: 'bg-gray-50 dark:bg-gray-900/30', textColor: 'text-gray-700 dark:text-gray-300' }
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            className={`${stat.bgColor} backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">{stat.title}</h3>
            <p className={`text-4xl font-bold ${stat.textColor} flex items-end`}>
              {stat.value}
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-2 mb-1">items</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Line Chart */}
        <motion.div 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50"
          {...fadeInUp}
        >
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100 flex items-center">
            <span className="w-2 h-6 bg-primary-500 rounded-full mr-3"></span>
            Monthly Interview Trends
          </h2>
          <div className="h-[300px] [&_.recharts-wrapper]:!w-full [&_.recharts-surface]:!w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="currentColor" 
                  opacity={0.1} 
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  stroke="currentColor" 
                  tick={{ 
                    fill: 'currentColor',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                  axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                  tickLine={{ stroke: 'currentColor', opacity: 0.2 }}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis 
                  stroke="currentColor"
                  tick={{ 
                    fill: 'currentColor',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                  axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                  tickLine={{ stroke: 'currentColor', opacity: 0.2 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: '#1f2937',
                    padding: '12px'
                  }}
                  labelStyle={{ 
                    color: '#374151',
                    fontWeight: 600,
                    marginBottom: '4px'
                  }}
                  itemStyle={{ 
                    color: '#374151',
                    padding: '4px 0'
                  }}
                />
                <Legend 
                  verticalAlign="top"
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {value}
                    </span>
                  )}
                />
                <Line 
                  type="monotone" 
                  dataKey="interviews" 
                  stroke="#2f4858" 
                  strokeWidth={2}
                  dot={{ 
                    strokeWidth: 2, 
                    fill: '#fff',
                    r: 4
                  }}
                  activeDot={{ 
                    r: 6, 
                    strokeWidth: 2,
                    stroke: '#2f4858',
                    fill: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="hired" 
                  stroke="#fb8404" 
                  strokeWidth={2}
                  dot={{ 
                    strokeWidth: 2, 
                    fill: '#fff',
                    r: 4
                  }}
                  activeDot={{ 
                    r: 6, 
                    strokeWidth: 2,
                    stroke: '#fb8404',
                    fill: '#fff'
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Pie Chart */}
        <motion.div 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50"
          {...fadeInUp}
        >
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100 flex items-center">
            <span className="w-2 h-6 bg-accent-500 rounded-full mr-3"></span>
            Candidate Status Distribution
          </h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={candidateStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={(props: { name?: string; percent?: number }) => {
                    const name = props.name ?? ''
                    const percent = props.percent ?? 0
                    return `${name} ${(percent * 100).toFixed(0)}%`
                  }}
                  labelLine={{ stroke: 'currentColor', strokeWidth: 0.5 }}
                >
                  {candidateStatusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: '#1f2937'
                  }}
                  labelStyle={{ color: '#374151' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-gray-700 dark:text-gray-300">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Interviews Table */}
      <motion.div 
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50"
        {...fadeInUp}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <span className="w-2 h-6 bg-gray-500 rounded-full mr-3"></span>
            Recent Interviews
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterDate('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterDate === 'today' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilterDate('tomorrow')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterDate === 'tomorrow' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-700/80 border-b border-gray-200 dark:border-gray-600">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Job</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-200 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredInterviews.length > 0 ? (
                filteredInterviews.map((interview) => (
                  <tr key={interview.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">
                      {interview.candidateName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {interview.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {interview.primaryContact}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {interview.jobName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {interview.clientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {interview.vendorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {new Date(interview.dateISO).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        interview.status === 'completed' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      }`}>
                        {interview.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No interviews found for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <style jsx global>{`
        .recharts-wrapper {
          margin: 0 auto;
        }
        .recharts-surface {
          overflow: visible;
        }
        .recharts-legend-wrapper {
          padding-bottom: 16px !important;
        }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke-opacity: 0.1;
        }
        .recharts-tooltip-cursor {
          stroke-opacity: 0.1;
        }
        .recharts-cartesian-axis-tick:first-child {
          transform: translateX(0) !important;
        }
        .recharts-cartesian-axis-tick:last-child {
          transform: translateX(0) !important;
        }
      `}</style>

    </div>
  );
}

export default DashboardPage;