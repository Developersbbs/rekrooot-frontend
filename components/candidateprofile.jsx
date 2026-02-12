'use client'
import React, { useState, useEffect, Fragment } from 'react'
import { FiX, FiDownload, FiEye, FiEdit2, FiTrash2, FiMail, FiArrowRight } from 'react-icons/fi'
import Image from 'next/image'
import { Document, Page } from 'react-pdf';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { pdfjs } from 'react-pdf';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


const CandidateProfile = ({ isOpen, onClose, candidateId, onEdit, onDelete, isFromInterviewed = false }) => {
  const [candidate, setCandidate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profilePicUrl, setProfilePicUrl] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [docUrl, setDocUrl] = useState(null);
  const [docError, setDocError] = useState(null);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [interviewDetails, setInterviewDetails] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return

      try {
        const token = await auth.currentUser.getIdToken()
        const res = await apiFetch('/auth/me', { token })

        if (res?.user) {
          setUserData(res.user)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }

    const selectedCompanyStr = localStorage.getItem('selectedCompany')
    if (selectedCompanyStr) {
      try {
        setSelectedCompany(JSON.parse(selectedCompanyStr))
      } catch (e) {
        console.error('Error parsing selectedCompany:', e)
      }
    }

    loadUserData()
  }, []);

  useEffect(() => {
    const fetchCandidateData = async () => {
      if (!candidateId || !auth.currentUser) return

      try {
        setLoading(true)
        const token = await auth.currentUser.getIdToken()

        // Fetch candidate data from backend
        const res = await apiFetch(`/candidates/${candidateId}`, { token })
        const data = res.candidate

        if (data) {
          // Profile picture URL is already in the response
          if (data.profile_pic) {
            setProfilePicUrl(data.profile_pic)
          }

          // Interview details if status is "interviewed"
          if (data.status === "interviewed") {
            const interviewDetails = {
              result: data.result || 'N/A',
              resultDoc: data.result_document_url || null,
              interviewVideoUrl: data.video_url || null,
              feedback: data.feedback || '',
              interviewNotes: data.notes || '',
              technicalRating: data.technical_rating || null,
              communicationRating: data.communication_rating || null,
              overallRating: data.overall_rating || null
            };
            setInterviewDetails(interviewDetails);
          }

          setCandidate({
            ...data,
            id: data._id,
            vendorName: data.vendor_id?.name || 'N/A',
            jobTitle: data.job_id?.title || 'N/A',
            clientName: data.client_id?.name || 'N/A',
            createdByName: data.created_by?.name || 'N/A',
            createdAt: data.createdAt ? new Date(data.createdAt) : null,
            interviewerName: data.interviewer_id?.name || 'N/A',
            // Map snake_case to camelCase for compatibility with existing UI
            primaryContact: data.primary_contact,
            secondaryContact: data.secondary_contact,
            profilePic: data.profile_pic,
            supportingDocuments: data.supporting_documents || [],
            resume: data.resumes || [],
            interviewDate: data.interview_date,
            interviewTime: data.interview_time,
            resultDocumentURL: data.result_document_url,
            videoUrl: data.video_url
          })
        }
      } catch (error) {
        console.error('Error fetching candidate:', error)
        toast.error('Failed to load candidate data')
      } finally {
        setLoading(false)
      }
    }

    fetchCandidateData()
  }, [candidateId])

  const handleDocumentView = async (doc) => {
    // Add debugging logs
    console.log('Document received:', doc);

    if (!doc) {
      console.error('Document is undefined');
      setDocError('Invalid document data');
      return;
    }

    const documentPath = doc.path || doc.url || doc.fileUrl;
    if (!documentPath) {
      console.error('No valid document path found');
      setDocError('Document path not found');
      return;
    }

    // Extract file extension from URL or use the name
    const getFileExtension = (url) => {
      try {
        // Try to get extension from URL path
        const urlObj = new URL(url);
        const urlPath = urlObj.pathname;
        const extension = urlPath.split('.').pop().toLowerCase();
        // If extension is long and contains slashes, it's not a real extension
        if (extension && extension.length < 10 && !extension.includes('/')) {
          return extension;
        }

        // Fallback to name parameter in URL
        const searchParams = urlObj.searchParams;
        const nameParam = searchParams.get('name');
        if (nameParam) {
          const nameExtension = nameParam.split('.').pop().toLowerCase();
          if (nameExtension && nameExtension.length < 10) {
            return nameExtension;
          }
        }
      } catch (e) {
        console.warn('Could not parse URL for extension:', url);
      }

      // Default fallback
      return doc.name?.split('.').pop().toLowerCase() || 'pdf';
    };

    // Set loading state
    setIsDocLoading(true);
    setDocError(null);
    setShowDocViewer(true);

    try {
      let url = documentPath;

      // If it's not a direct URL, try to get it from Firebase Storage
      if (!documentPath.startsWith('http') && !documentPath.startsWith('https')) {
        const storage = getStorage();
        const docRef = ref(storage, documentPath);
        console.log('Attempting to fetch URL for path:', documentPath);
        url = await getDownloadURL(docRef);
      }

      console.log('Final document URL:', url);

      // Detect file type
      const fileType = getFileExtension(url);
      console.log('Detected file type:', fileType);

      setDocUrl(url);
      setSelectedDoc({
        ...doc,
        uri: url,
        fileType: fileType,
        fileName: doc.name || `document.${fileType}`
      });
      setIsDocLoading(false);
    } catch (error) {
      console.error('Error loading document:', error);

      // Fallback to proxy API if it's not a direct URL
      if (!documentPath.startsWith('http')) {
        try {
          const proxyUrl = `/api/proxy-document?path=${encodeURIComponent(documentPath)}`;
          const fileType = getFileExtension(documentPath);
          setDocUrl(proxyUrl);
          setSelectedDoc({
            ...doc,
            uri: proxyUrl,
            fileType: fileType,
            fileName: doc.name || `document.${fileType}`
          });
          setIsDocLoading(false);
          return;
        } catch (proxyError) {
          console.error('Proxy also failed:', proxyError);
        }
      }

      setDocError(`Failed to load document: ${error.message}`);
      setIsDocLoading(false);
    }
  };

  const handleEdit = () => {
    if (candidate) {
      onEdit(candidate);
      onClose();
    }
  };

  const handleDelete = () => {
    if (candidate) {
      onDelete(candidate.id);
      onClose();
    }
  };

  const handleResendEmail = async () => {
    if (!candidate) return;

    try {
      // Show loading toast
      const loadingToastId = toast.loading('Sending email notifications...');

      // Fetch necessary details
      const fetchPromises = [
        getDoc(doc(db, 'jobs', candidate.jobId)),
        getDoc(doc(db, 'Clients', candidate.clientId)),
        getDoc(doc(db, 'Users', candidate.createdBy))
      ];

      // Only fetch vendor if vendorId exists
      if (candidate.vendorId) {
        fetchPromises.push(getDoc(doc(db, 'Vendor', candidate.vendorId)));
      }

      const results = await Promise.all(fetchPromises);
      const vendorDoc = candidate.vendorId ? results[3] : null;
      const jobDoc = results[0];
      const clientDoc = results[1];
      const recruiterDoc = results[2];

      const vendorData = vendorDoc ? vendorDoc.data() : null;
      const jobData = jobDoc.data();
      const clientData = clientDoc.data();
      const recruiterData = recruiterDoc.data();

      // Send email notifications
      const emailResponse = await fetch('/api/sendslot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          recruiterEmail: recruiterData?.email || userData?.email,
          vendorEmail: vendorData?.email || null,
          clientEmail: clientData.email,
          jobTitle: jobData.jobTitle,
          clientName: clientData.name,
          link: `${process.env.NEXT_PUBLIC_URL}/timeslots?candidateId=${candidate.id}`
        }),
      });

      const emailResult = await emailResponse.json();
      toast.dismiss(loadingToastId);

      if (emailResult.success) {
        // Update candidate status to 'waiting'
        const candidateRef = doc(db, 'candidates', candidate.id);
        await updateDoc(candidateRef, {
          status: '1'
        });

        toast.success('Email notifications sent successfully');
      } else {
        throw new Error(emailResult.error || emailResult.message || 'Failed to send notifications');
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error(`Failed to send emails: ${error.message}`);
    }
  };

  const fetchClientsAndJobs = async () => {
    try {
      const shouldFilterByCompany = !(userData?.role === 'SuperAdmin' && selectedCompany?.name === 'All');
      const companyName = userData?.role === 'SuperAdmin'
        ? selectedCompany?.name
        : userData?.company;

      if (!companyName) return;

      // Fetch clients
      let clientsQuery = collection(db, 'Clients');
      if (shouldFilterByCompany) {
        clientsQuery = query(clientsQuery, where('company', '==', companyName));
      }
      const clientsSnap = await getDocs(clientsQuery);
      const clientsData = clientsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(clientsData);

      // Fetch all jobs
      let jobsQuery = collection(db, 'jobs');
      if (shouldFilterByCompany) {
        jobsQuery = query(jobsQuery, where('company', '==', companyName));
      }
      const jobsSnap = await getDocs(jobsQuery);
      const jobsData = jobsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJobs(jobsData);
    } catch (error) {
      console.error('Error fetching clients and jobs:', error);
      toast.error('Failed to load clients and jobs');
    }
  };

  const handleClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedJobId(''); // Reset job selection

    // Filter jobs for selected client
    const jobsForClient = jobs.filter(job => job.clientId === clientId);
    setFilteredJobs(jobsForClient);
  };

  const handleMigrate = async () => {
    if (!selectedJobId || !selectedClientId) {
      toast.error('Please select both client and job');
      return;
    }

    setMigrateLoading(true);
    try {
      // Update candidate document
      const candidateRef = doc(db, 'candidates', candidate.id);
      await updateDoc(candidateRef, {
        clientId: selectedClientId,
        jobId: selectedJobId,
        migratedAt: serverTimestamp(),
        migratedBy: userData?.uid,
        previousClientId: candidate.clientId,
        previousJobId: candidate.jobId,
        status: '0' // Reset status for new position
      });

      // Fetch necessary details for email
      const fetchPromises = [
        getDoc(doc(db, 'jobs', selectedJobId)), // Use new job ID
        getDoc(doc(db, 'Clients', selectedClientId)), // Use new client ID
        getDoc(doc(db, 'Users', userData?.uid))
      ];

      // Only fetch vendor if vendorId exists
      if (candidate.vendorId) {
        fetchPromises.push(getDoc(doc(db, 'Vendor', candidate.vendorId)));
      }

      const results = await Promise.all(fetchPromises);
      const vendorDoc = candidate.vendorId ? results[3] : null;
      const jobDoc = results[0];
      const clientDoc = results[1];
      const recruiterDoc = results[2];

      const vendorData = vendorDoc ? vendorDoc.data() : null;
      const jobData = jobDoc.data();
      const clientData = clientDoc.data();
      const recruiterData = recruiterDoc.data();

      // Show loading toast for email
      const emailLoadingToast = toast.loading('Sending migration notifications...');

      // Send emails
      const emailResponse = await fetch('/api/sendslot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          recruiterEmail: recruiterData?.email,
          vendorEmail: vendorData?.email || null,
          clientEmail: clientData.email,
          jobTitle: jobData.jobTitle,
          clientName: clientData.name,
          link: `${process.env.NEXT_PUBLIC_URL}/timeslots?candidateId=${candidate.id}`
        }),
      });

      const emailResult = await emailResponse.json();
      toast.dismiss(emailLoadingToast);

      if (emailResult.success) {
        // Update candidate status to 'waiting'
        await updateDoc(candidateRef, {
          status: '1'
        });

        toast.success('Candidate migrated and notifications sent successfully');
      } else {
        // Migration succeeded but email failed
        toast.error('Migration successful but failed to send notifications');
        console.error('Email error:', emailResult.error || emailResult.message);
      }

      setIsMigrateModalOpen(false);
      onClose(); // Close the profile modal
    } catch (error) {
      console.error('Error in migration process:', error);
      toast.error(`Migration failed: ${error.message}`);
    } finally {
      setMigrateLoading(false);
    }
  };

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end transition-all duration-500">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl animate-slideIn">
        {/* Header with Actions */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              Candidate Profile
            </h2>
            <div className="flex items-center space-x-2">
              {/* Edit Action */}
              <button
                onClick={handleEdit}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400"
                title="Edit Candidate"
              >
                <FiEdit2 className="w-5 h-5" />
              </button>

              {/* Migrate Action */}
              <button
                onClick={() => {
                  setIsMigrateModalOpen(true);
                  fetchClientsAndJobs();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400"
                title="Migrate Candidate"
              >
                <FiArrowRight className="w-5 h-5" />
              </button>

              {/* Delete Action */}
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                title="Delete Candidate"
              >
                <FiTrash2 className="w-5 h-5" />
              </button>

              {/* Close Button */}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2"></div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200 text-gray-600 dark:text-gray-300"
                title="Close"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : candidate && (
          <div className="p-6 space-y-8">
            {/* Profile Header */}
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center space-x-6">
                <div className="h-24 w-24 rounded-lg overflow-hidden bg-primary-50 dark:bg-gray-700 shadow-md">
                  {profilePicUrl ? (
                    <Image
                      src={profilePicUrl}
                      alt={candidate.full_name}
                      width={96}
                      height={96}
                      className="object-cover w-full h-full"
                      priority
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary-500">
                        {candidate.full_name?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {candidate.full_name}
                  </h3>
                  <p className="text-primary-600 dark:text-primary-400 font-medium">
                    {candidate.email}
                  </p>
                  <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${candidate.status === '0' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                    candidate.status === '1' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      candidate.status === '2' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                        candidate.status === '3' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                          candidate.status === '4' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                            candidate.status === '5' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                    }`}>
                    {candidate.status === '0' ? 'APPLIED' :
                      candidate.status === '1' ? 'WAITING' :
                        candidate.status === '2' ? 'SCHEDULED' :
                          candidate.status === '3' ? 'SELECTED' :
                            candidate.status === '4' ? 'REJECTED' :
                              candidate.status === '5' ? 'ON_HOLD' : candidate.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Job Position', value: candidate.jobTitle, icon: '💼' },
                { label: 'Client', value: candidate.clientName, icon: '🏢' },
                { label: 'Vendor', value: candidate.vendorName, icon: '🤝' },
                { label: 'Interviewer', value: candidate.interviewerName, icon: '👨‍💼' },
                { label: 'Location', value: candidate.location, icon: '📍' },
                { label: 'Primary Contact', value: candidate.primaryContact, icon: '📱' },
                { label: 'Secondary Contact', value: candidate.secondaryContact, icon: '📞' },
                { label: 'Created By', value: candidate.createdByName, icon: '👤' },
                { label: 'Created At', value: candidate.createdAt?.toLocaleString(), icon: '📅' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{item.icon}</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.value || 'N/A'}
                  </p>
                </div>
              ))}
            </div>

            {/* Resume Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <span className="mr-2">�</span> Resume
                </h4>
              </div>
              <div className="p-4">
                {candidate.resume && candidate.resume.length > 0 ? (
                  <div className="space-y-3">
                    {candidate.resume.map((res, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                          <span className="mr-2">�</span>
                          {res.name || 'Resume'}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              if (!res.url) {
                                setDocError('Resume URL not found');
                                return;
                              }
                              handleDocumentView({ name: res.name || 'Resume', url: res.url });
                            }}
                            className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                            title="View Resume"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                            title="Download Resume"
                          >
                            <FiDownload className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 dark:text-gray-400">No resume available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <span className="mr-2">📁</span> Supporting Documents
                </h4>
              </div>
              <div className="p-4">
                {candidate.supportingDocuments && candidate.supportingDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {candidate.supportingDocuments.map((doc, index) => {
                      if (!doc || !doc.name) {
                        return null;
                      }

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                            <span className="mr-2">📎</span>
                            {doc.name}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                if (!doc.url) {
                                  setDocError('Document URL not found');
                                  return;
                                }
                                handleDocumentView({ name: doc.name, url: doc.url });
                              }}
                              className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                              title="View Document"
                            >
                              <FiEye className="w-4 h-4" />
                            </button>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                              title="Download Document"
                            >
                              <FiDownload className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 dark:text-gray-400">No supporting documents available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Interview Details Section */}
            {candidate && candidate.status === "Interviewed" && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <span className="mr-2">📅</span> Interview Details
                  </h4>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Basic Interview Details */}
                    {[
                      {
                        label: 'Interview Date',
                        value: candidate.interviewDate?.seconds ?
                          new Date(candidate.interviewDate.seconds * 1000).toLocaleDateString()
                          : candidate.interviewDate instanceof Date ?
                            candidate.interviewDate.toLocaleDateString()
                            : candidate.interviewDate,
                        icon: '📅'
                      },
                      {
                        label: 'Interview Time',
                        value: candidate.interviewTime,
                        icon: '⏰'
                      },
                      {
                        label: 'Interviewer',
                        value: candidate.interviewerName,
                        icon: '👤'
                      },
                      {
                        label: 'Result',
                        value: interviewDetails?.result,
                        icon: '🎯'
                      }
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{item.icon}</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white break-words">
                          {item.value || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Interview Resources */}
                  <div className="mt-6 space-y-4">
                    {/* Result Document */}
                    {candidate?.resultDocumentURL && (
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">📄</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Result Document</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDocumentView({
                                name: 'Result Document',
                                path: candidate.resultDocumentURL
                              })}
                              className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
                              title="View Document"
                            >
                              <FiEye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const storage = getStorage();
                                  const docRef = ref(storage, candidate.resultDocumentURL);
                                  const url = await getDownloadURL(docRef);
                                  if (typeof window !== 'undefined') {
                                    window.open(url, '_blank');
                                  }
                                } catch (error) {
                                  console.error('Error downloading document:', error);
                                  toast.error('Failed to download result document');
                                }
                              }}
                              className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
                              title="Download Document"
                            >
                              <FiDownload className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Interview Video */}
                    {candidate?.videoUrl && (
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">🎥</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Interview Recording</p>
                          </div>
                          <a
                            href={candidate.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
                          >
                            <FiEye className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Ratings and Feedback */}
                    {(interviewDetails?.technicalRating ||
                      interviewDetails?.communicationRating ||
                      interviewDetails?.overallRating ||
                      interviewDetails?.feedback ||
                      interviewDetails?.interviewNotes) && (
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: 'Technical', value: interviewDetails?.technicalRating },
                              { label: 'Communication', value: interviewDetails?.communicationRating },
                              { label: 'Overall', value: interviewDetails?.overallRating }
                            ].map((rating, index) => (
                              rating.value && (
                                <div key={index} className="text-center">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{rating.label} Rating</p>
                                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                                    {rating.value}/5
                                  </p>
                                </div>
                              )
                            ))}
                          </div>

                          {interviewDetails?.feedback && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Feedback</p>
                              <p className="text-gray-900 dark:text-white">{interviewDetails.feedback}</p>
                            </div>
                          )}

                          {interviewDetails?.interviewNotes && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Interview Notes</p>
                              <p className="text-gray-900 dark:text-white">{interviewDetails.interviewNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* Document Viewer Modal */}
            {showDocViewer && selectedDoc && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
                <div className="bg-white dark:bg-gray-900 w-11/12 h-5/6 rounded-lg shadow-xl overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold dark:text-white">{selectedDoc.fileName}</h3>
                    <button
                      onClick={() => {
                        setShowDocViewer(false);
                        setDocUrl(null);
                        setSelectedDoc(null);
                        setDocError(null);
                        setIsDocLoading(false);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    >
                      <FiX className="w-5 h-5 dark:text-white" />
                    </button>
                  </div>
                  <div className="h-[calc(100%-4rem)] w-full overflow-auto">
                    {docError ? (
                      <div className="flex flex-col items-center justify-center h-full p-6">
                        <p className="text-red-500 mb-4">{docError}</p>
                        <button
                          onClick={() => {
                            if (typeof document !== 'undefined') {
                              const downloadLink = document.createElement('a');
                              downloadLink.href = docUrl;
                              downloadLink.download = selectedDoc?.fileName || 'document';
                              downloadLink.target = '_blank';
                              downloadLink.click();
                            }
                          }}
                          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                        >
                          Download Instead
                        </button>
                      </div>
                    ) : isDocLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
                          <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
                        </div>
                      </div>
                    ) : docUrl && selectedDoc ? (
                      <div className="h-full w-full">
                        {selectedDoc.fileType === 'pdf' ? (
                          <iframe
                            src={docUrl}
                            className="w-full h-full border-0"
                            title={selectedDoc.fileName}
                            onLoad={() => console.log('PDF loaded successfully')}
                            onError={(e) => {
                              console.error('PDF iframe error:', e);
                              setDocError('Failed to load PDF. Try downloading instead.');
                            }}
                          />
                        ) : (
                          <DocViewer
                            documents={[{
                              uri: docUrl,
                              fileType: selectedDoc.fileType,
                              fileName: selectedDoc.fileName
                            }]}
                            pluginRenderers={DocViewerRenderers}
                            style={{ height: '100%', backgroundColor: 'rgb(249, 250, 251)' }}
                            config={{
                              header: {
                                disableHeader: true,
                                disableFileName: true,
                                retainURLParams: false
                              },
                              pdfZoom: {
                                defaultZoom: 1.1,
                                zoomJump: 0.2
                              },
                              pdfVerticalScrollByDefault: true,
                              loader: {
                                showLoadingIndicator: false
                              }
                            }}
                            onError={(error) => {
                              console.error('DocViewer error:', error);
                              setDocError('Failed to display document. Try downloading instead.');
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isMigrateModalOpen && (
              <div className="fixed inset-0 z-[70] overflow-y-auto">
                <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                  {/* Background overlay */}
                  <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                    onClick={() => !migrateLoading && setIsMigrateModalOpen(false)}
                  />

                  {/* This element is to trick the browser into centering the modal contents. */}
                  <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
                    &#8203;
                  </span>

                  {/* Modal panel */}
                  <div className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
                    <div className="px-4 pt-5 pb-4 sm:p-6">
                      <div className="sm:flex sm:items-start">
                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                            Migrate Candidate
                          </h3>

                          <div className="space-y-4">
                            {/* Client Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Client
                              </label>
                              <select
                                value={selectedClientId}
                                onChange={(e) => handleClientChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">Select a client</option>
                                {clients.map(client => (
                                  <option key={client.id} value={client.id}>
                                    {client.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Job Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Job
                              </label>
                              <select
                                value={selectedJobId}
                                onChange={(e) => setSelectedJobId(e.target.value)}
                                disabled={!selectedClientId}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                              >
                                <option value="">Select a job</option>
                                {filteredJobs.map(job => (
                                  <option key={job.id} value={job.id}>
                                    {job.jobTitle}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-6 flex justify-end space-x-3">
                            <button
                              type="button"
                              onClick={() => setIsMigrateModalOpen(false)}
                              disabled={migrateLoading}
                              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleMigrate}
                              disabled={migrateLoading || !selectedJobId || !selectedClientId}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {migrateLoading ? 'Migrating...' : 'Migrate'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CandidateProfile
