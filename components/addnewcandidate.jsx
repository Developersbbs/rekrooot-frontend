'use client'
import { useState, useEffect, useCallback, memo } from 'react'
import { Dialog } from '@headlessui/react'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import { FiUpload, FiX } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import Cookies from 'js-cookie'
import { apiFetch } from '@/lib/api'

// Memoize child components
const DocumentList = memo(({ documents, removeDocument }) => (
  <div className="mt-2 max-h-[100px] overflow-y-auto">
    {documents.map((doc, index) => (
      <div key={index} className="flex items-center justify-between py-1 text-sm group hover:bg-gray-50 dark:hover:bg-gray-700">
        <span className="truncate max-w-[250px] text-gray-600 dark:text-gray-300">{doc.name}</span>
        <button
          type="button"
          onClick={() => removeDocument(index)}
          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FiX className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
))

DocumentList.displayName = 'DocumentList'

const AddNewCandidate = ({
  isOpen,
  onClose,
  selectedJob = null,
  selectedClient = null,
  showClientJobDropdowns = true,
  onCandidateAdded,
  candidateData = null,
  isEditing = false,
  prefilledJobData = null
}) => {
  const [user, setUser] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vendors, setVendors] = useState([])
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [interviewers, setInterviewers] = useState([])
  const [profilePreview, setProfilePreview] = useState(null)
  const [resume, setResume] = useState([])
  const [supportingDocuments, setSupportingDocuments] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [currentSelectedJob, setCurrentSelectedJob] = useState(selectedJob)
  const [currentSelectedClient, setCurrentSelectedClient] = useState(selectedClient)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState([])
  const [companyValidationError, setCompanyValidationError] = useState('')
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('')
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false)
  const [filteredInterviewers, setFilteredInterviewers] = useState([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState([])
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [showTimeSlotDropdown, setShowTimeSlotDropdown] = useState(false)
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false)
  const [selectedSlotData, setSelectedSlotData] = useState(null)
  const [isParsing, setIsParsing] = useState(false)

  const [formData, setFormData] = useState({
    profilePic: null,
    name: '',
    email: '',
    location: '',
    primaryContact: '',
    secondaryContact: '',
    vendorId: '',
    jobId: '',
    clientId: '',
    interviewerId: '',
    resume: [],
    supportingDocuments: [],
    status: '0',
    experience: '',
    trash: false
  })


  useEffect(() => {
    if (formData.clientId) {
      const jobsForClient = jobs.filter(job => job.clientId === formData.clientId)
      setFilteredJobs(jobsForClient)
      setFormData(prev => ({ ...prev, jobId: '' }))
    } else {
      setFilteredJobs([])
    }
  }, [formData.clientId, jobs])

  const fetchData = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Use localStorage instead of cookies (same as Header component)
      const selectedCompanyStr = localStorage.getItem('selectedCompany')
      const currentSelectedCompany = selectedCompanyStr ? JSON.parse(selectedCompanyStr) : null
      const companyId = currentSelectedCompany?.id || 'all';

      // Fetch all data from backend
      const [vendorsRes, jobsRes, clientsRes, interviewersRes] = await Promise.all([
        apiFetch(`/vendors${companyId !== 'all' ? `?company_id=${companyId}` : ''}`, { token }),
        apiFetch(`/jobs${companyId !== 'all' ? `?company_id=${companyId}` : ''}`, { token }),
        apiFetch(`/clients${companyId !== 'all' ? `?company_id=${companyId}` : ''}`, { token }),
        apiFetch('/interviewers', { token }) // Interviewers are global
      ]);

      setVendors(vendorsRes.vendors || []);

      const mappedJobs = (jobsRes.jobs || []).map(j => ({
        ...j,
        id: j._id,
        clientId: j.client_id?._id || j.client_id
      }));
      setJobs(mappedJobs);

      setClients((clientsRes.clients || []).map(c => ({ ...c, id: c._id })));
      setInterviewers((interviewersRes.interviewers || []).map(i => ({ ...i, id: i._id })));

      // Update filtered jobs if there's a selected client or prefilled job
      const clientId = selectedJob?.clientId || prefilledJobData?.clientId || formData.clientId;
      if (clientId) {
        const jobsForClient = mappedJobs.filter(job => job.clientId === clientId);
        setFilteredJobs(jobsForClient);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
  }, [prefilledJobData, selectedJob, formData.clientId]);

  // Add effect to refetch data when company changes
  useEffect(() => {
    // Listen for company changes from header
    const handleCompanyChange = () => {
      console.log('Company changed, refetching data...');
      fetchData();
      // Reset form when company changes
      resetForm();
      // Reset duplicate modal state
      setShowDuplicateModal(false);
      setDuplicateCandidates([]);
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [fetchData]);

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter interviewers based on search term
  useEffect(() => {
    const filtered = interviewers.filter(interviewer => {
      const searchLower = interviewerSearchTerm.toLowerCase()
      const nameMatch = interviewer.name?.toLowerCase().includes(searchLower)
      const roleMatch = interviewer.role?.toLowerCase().includes(searchLower)
      const emailMatch = interviewer.email?.toLowerCase().includes(searchLower)
      return nameMatch || roleMatch || emailMatch
    })
    setFilteredInterviewers(filtered)
  }, [interviewerSearchTerm, interviewers])

  // Fetch available time slots
  const fetchTimeSlots = useCallback(async () => {
    if (!formData.interviewerId) {
      setAvailableTimeSlots([])
      return
    }

    setIsLoadingTimeSlots(true)
    try {
      const token = await auth.currentUser?.getIdToken();
      // Use rekrooot-server endpoint
      const data = await apiFetch(`/interviewers/${formData.interviewerId}/timeslots`, {
        token
      });

      if (data.success) {
        setAvailableTimeSlots(data.timeSlots || [])
      } else {
        console.error('Failed to fetch time slots')
        setAvailableTimeSlots([])
      }
    } catch (error) {
      console.error('Error fetching time slots:', error)
      setAvailableTimeSlots([])
    } finally {
      setIsLoadingTimeSlots(false)
    }
  }, [formData.interviewerId])

  // Fetch time slots when interviewer is selected
  useEffect(() => {
    if (formData.interviewerId) {
      fetchTimeSlots()
    } else {
      setAvailableTimeSlots([])
      setSelectedTimeSlot('')
    }
  }, [formData.interviewerId, fetchTimeSlots])

  // Validate form before submission
  const validateCompanySelection = () => {
    const userDataCookie = Cookies.get('userData')
    const selectedCompanyStr = localStorage.getItem('selectedCompany')

    let role = user?.role;
    if (!role && userDataCookie) {
      try {
        const userData = JSON.parse(userDataCookie);
        role = userData.role;
      } catch (e) {
        console.error("Error parsing user cookie", e);
      }
    }

    const selectedCompany = selectedCompanyStr ? JSON.parse(selectedCompanyStr) : null;
    const companyId = selectedCompany?.id;

    if (role === 'SuperAdmin' && (!companyId || companyId === 'all')) {
      setCompanyValidationError('Please select a specific company (not "All") to add a candidate.')
      return false
    }

    setCompanyValidationError('')
    return true
  }

  // Add validation for required fields
  const validateForm = () => {
    if (!validateCompanySelection()) {
      return false
    }

    const requiredFields = ['name', 'email', 'jobId', 'clientId']
    const missingFields = requiredFields.filter(field => !formData[field])

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`)
      return false
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error('Please enter a valid email address')
      return false
    }

    return true
  }

  // Check for existing candidate with same email
  const checkExistingCandidate = async (email) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return [];

      const selectedCompanyCookie = Cookies.get('selectedCompany');
      const selectedCompany = selectedCompanyCookie ? JSON.parse(selectedCompanyCookie) : null;
      const companyId = selectedCompany?.id || 'all';

      const res = await apiFetch(`/candidates?email=${encodeURIComponent(email)}${companyId !== 'all' ? `&company_id=${companyId}` : ''}`, {
        token
      });

      return res.candidates || [];
    } catch (error) {
      console.error('Error checking existing candidate:', error)
      return []
    }
  }

  useEffect(() => {
    if (selectedJob) {
      setCurrentSelectedJob(selectedJob)
      setFormData(prev => ({
        ...prev,
        jobId: selectedJob.id,
        clientId: selectedJob.clientId
      }))
    }
    if (selectedClient) {
      setCurrentSelectedClient(selectedClient)
      setFormData(prev => ({ ...prev, clientId: selectedClient.id }))
    }
  }, [selectedJob, selectedClient])

  // Replace the auth state handler with cookie-based user data
  useEffect(() => {
    const userDataCookie = Cookies.get('userData')
    if (userDataCookie) {
      try {
        const userData = JSON.parse(userDataCookie)
        setUser({
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          role: userData.role, // Add role here
        })
      } catch (error) {
        console.error('Error parsing userData cookie:', error)
        setUser(null)
      }
    }
  }, [])

  const handleProfilePicChange = useCallback((e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, profilePic: file }))
      setProfilePreview(URL.createObjectURL(file))
    }
  }, [])

  const handleResumeChange = useCallback(async (e) => {
    const files = Array.from(e.target.files)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    const validFiles = files.filter(file => allowedTypes.includes(file.type))
    if (validFiles.length !== files.length) {
      toast.error('Some files were not added. Only PDF and Word documents are allowed.')
    }

    setResume(prev => [...prev, ...validFiles])

    // Auto-parse the first resume added
    if (validFiles.length > 0) {
      const file = validFiles[0];
      setIsParsing(true);
      const toastId = toast.loading('Parsing resume details...');

      try {
        const formDataPayload = new FormData();
        formDataPayload.append('file', file);

        const response = await fetch('/api/parseresume', {
          method: 'POST',
          body: formDataPayload,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const parsed = result.data;

            setFormData(prev => ({
              ...prev,
              name: parsed.name || prev.name,
              email: parsed.email || prev.email,
              primaryContact: parsed.phone || prev.primaryContact,
              location: parsed.location || prev.location,
            }));

            toast.success('Resume details parsed successfully!', { id: toastId });
          } else {
            toast.error('Could not parse resume details.', { id: toastId });
          }
        } else {
          toast.error('Failed to parse resume.', { id: toastId });
        }
      } catch (error) {
        console.error('Parsing error:', error);
        toast.error('Error auto-parsing resume.', { id: toastId });
      } finally {
        setIsParsing(false);
      }
    }
  }, [formData])

  const handleSupportingDocumentsChange = useCallback((e) => {
    const files = Array.from(e.target.files)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    const validFiles = files.filter(file => allowedTypes.includes(file.type))
    if (validFiles.length !== files.length) {
      toast.error('Some files were not added. Only PDF and Word documents are allowed.')
    }

    setSupportingDocuments(prev => [...prev, ...validFiles])
  }, [])

  const removeResume = useCallback((index) => {
    setResume(prev => prev.filter((_, i) => i !== index))
  }, [])

  const removeSupportingDocument = useCallback((index) => {
    setSupportingDocuments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Add this new function to handle edit submission
  const handleEditSubmit = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Upload new profile picture if changed
      let profilePicUrl = formData.profilePic;
      if (formData.profilePic instanceof File) {
        const profilePicRef = ref(storage, `profilePics/${formData.profilePic.name}`);
        await uploadBytes(profilePicRef, formData.profilePic);
        profilePicUrl = await getDownloadURL(profilePicRef);
      }

      // Upload any new resumes
      const uploadedResumes = [];
      const timestamp = Date.now();

      for (const doc of resume) {
        if (doc instanceof File) {
          const safeName = doc.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const uniqueName = `${timestamp}_${safeName}`;
          const docRef = ref(storage, `resumes/${uniqueName}`);
          await uploadBytes(docRef, doc);
          const docUrl = await getDownloadURL(docRef);
          uploadedResumes.push({
            name: doc.name,
            url: docUrl
          });
        } else {
          uploadedResumes.push(doc);
        }
      }

      // Upload any new supporting documents
      const uploadedSupportingDocs = [];
      for (const doc of supportingDocuments) {
        if (doc instanceof File) {
          const safeName = doc.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const uniqueName = `${timestamp}_${safeName}`;
          const docRef = ref(storage, `documents/${uniqueName}`);
          await uploadBytes(docRef, doc);
          const docUrl = await getDownloadURL(docRef);
          uploadedSupportingDocs.push({
            name: doc.name,
            url: docUrl
          });
        } else {
          uploadedSupportingDocs.push(doc);
        }
      }

      // Prepare update data
      const payload = {
        job_id: formData.jobId,
        client_id: formData.clientId,
        vendor_id: formData.vendorId || null,
        full_name: formData.name,
        email: formData.email,
        location: formData.location,
        primary_contact: formData.primaryContact,
        secondary_contact: formData.secondaryContact,
        experience_years: formData.experience,
        status: formData.status,
        profile_pic: profilePicUrl,
        resumes: uploadedResumes,
        supporting_documents: uploadedSupportingDocs,
        trash: formData.trash
      };

      // Update the candidate via API
      await apiFetch(`/candidates/${candidateData.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(payload)
      });

      toast.success('Candidate updated successfully');
      onClose();
      onCandidateAdded?.();
    } catch (error) {
      console.error('Error updating candidate:', error);
      toast.error(`Failed to update candidate: ${error.message}`);
    }
  };

  // Modify the handleSubmit function to handle both add and edit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    if (!validateForm()) return;

    // For new candidates, check for existing email
    if (!isEditing) {
      const existingCandidates = await checkExistingCandidate(formData.email);
      if (existingCandidates.length > 0) {
        setDuplicateCandidates(existingCandidates);
        setShowDuplicateModal(true);
        return;
      }
    }

    proceedWithSubmission();
  };

  const proceedWithSubmission = async () => {
    setIsSubmitting(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // If editing, use handleEditSubmit
      if (isEditing && candidateData) {
        await handleEditSubmit();
        return;
      }

      // Add new candidate logic
      let profilePicUrl = null;
      const timestamp = Date.now();

      if (formData.profilePic) {
        const safeName = formData.profilePic.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueName = `${timestamp}_${safeName}`;
        const profilePicRef = ref(storage, `profilePics/${uniqueName}`);
        await uploadBytes(profilePicRef, formData.profilePic);
        profilePicUrl = await getDownloadURL(profilePicRef);
      }

      // Upload resumes
      const uploadedResumes = await Promise.all(
        resume.map(async (doc) => {
          const safeName = doc.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const uniqueName = `${timestamp}_${safeName}`;
          const docRef = ref(storage, `resumes/${uniqueName}`);
          await uploadBytes(docRef, doc);
          const url = await getDownloadURL(docRef);
          return {
            name: doc.name,
            url: url
          };
        })
      );

      // Upload supporting documents
      const uploadedSupportingDocs = await Promise.all(
        supportingDocuments.map(async (doc) => {
          const safeName = doc.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const uniqueName = `${timestamp}_${safeName}`;
          const docRef = ref(storage, `documents/${uniqueName}`);
          await uploadBytes(docRef, doc);
          const url = await getDownloadURL(docRef);
          return {
            name: doc.name,
            url: url
          };
        })
      );

      const selectedCompanyStr = localStorage.getItem('selectedCompany');
      const selectedCompany = selectedCompanyStr ? JSON.parse(selectedCompanyStr) : null;
      let companyId = selectedCompany?.id;

      if (companyId === 'all' || (companyId && !/^[0-9a-fA-F]{24}$/.test(companyId))) {
        if (user?.role === 'SuperAdmin') {
          toast.error('Please select a specific company (not "All") to add a candidate.');
          setIsSubmitting(false);
          return;
        }
        companyId = undefined;
      }

      let finalInterviewerId = formData.interviewerId;
      const currentJobData = jobs.find(j => j.id === formData.jobId);

      if (!finalInterviewerId && currentJobData && currentJobData.technologies?.length > 0) {
        try {
          const jobTechIds = currentJobData.technologies.map(t => (t && typeof t === 'object') ? t._id : t);
          const matchingInterviewer = interviewers.find(interviewer => {
            if (!interviewer.technologies) return false;
            const techArray = Array.isArray(interviewer.technologies) ? interviewer.technologies : [];
            return techArray.some(techId => {
              const idToCheck = (techId && typeof techId === 'object') ? techId._id : techId;
              return jobTechIds.includes(idToCheck);
            });
          });

          if (matchingInterviewer) {
            finalInterviewerId = matchingInterviewer.id;
          } else {
            console.log('No matching interviewer found for job technologies.');
          }
        } catch (autoAssignError) {
          console.error('Error during auto-assignment:', autoAssignError);
        }
      }

      if (!finalInterviewerId) {
        setIsSubmitting(false);
        toast.error('No interviewer found matching the job requirements. Please select an interviewer manually to proceed.');
        return;
      }
      let interviewerData = null;
      if (finalInterviewerId) {
        try {
          const interviewerRes = await apiFetch(`/interviewers/${finalInterviewerId}`, { token });
          interviewerData = interviewerRes.interviewer;
        } catch (error) {
          console.error('Error fetching interviewer details:', error);
        }
      }

      console.log('Proceeding with interviewer:', finalInterviewerId);

      const payload = {
        job_id: formData.jobId,
        client_id: formData.clientId,
        vendor_id: formData.vendorId || null,
        full_name: formData.name,
        email: formData.email,
        location: formData.location,
        primary_contact: formData.primaryContact,
        secondary_contact: formData.secondaryContact,
        experience_years: formData.experience,
        status: selectedTimeSlot ? '2' : '1',
        profile_pic: profilePicUrl,
        resumes: uploadedResumes,
        supporting_documents: uploadedSupportingDocs,
        company_id: companyId,
        interviewer_id: finalInterviewerId,
        presenterId: interviewerData?.zoho_meet_uid || '60058686791'
      };

      const res = await apiFetch('/candidates', {
        method: 'POST',
        token,
        body: JSON.stringify(payload)
      });

      const newCandidate = res.candidate;
      console.log('Candidate created:', newCandidate?._id);

      if (!newCandidate) throw new Error('Failed to create candidate');

      if (finalInterviewerId && newCandidate._id && interviewerData) {
        try {
          if (selectedSlotData) {
            const updatedSlots = { ...interviewerData.availability_slots };
            if (!updatedSlots[selectedSlotData.date]) updatedSlots[selectedSlotData.date] = {};
            updatedSlots[selectedSlotData.date][selectedSlotData.time] = newCandidate._id;

            const existingAssigned = Array.isArray(interviewerData.assigned_candidates)
              ? interviewerData.assigned_candidates.map(c => typeof c === 'object' ? c._id : c)
              : [];

            const updatedCandidates = Array.from(new Set([...existingAssigned, newCandidate._id]));

            await apiFetch(`/interviewers/${finalInterviewerId}`, {
              method: 'PUT',
              token,
              body: JSON.stringify({
                availability_slots: updatedSlots,
                assigned_candidates: updatedCandidates
              })
            });
          }
        } catch (updateError) {
          console.error('Error updating interviewer availability:', updateError);
        }

        const jobData = jobs.find(j => j.id === formData.jobId);
        const clientData = clients.find(c => c.id === formData.clientId);
        const vendorData = vendors.find(v => v.id === formData.vendorId);

        let meetingLink = null;
        let sessionId = null;

        if (selectedSlotData && jobData && clientData) {
          try {
            // Use rekrooot-server endpoint for meeting creation
            const [hours, minutes] = selectedSlotData.time24 ? selectedSlotData.time24.split(':') : selectedSlotData.time.split(':');
            const meetingDate = new Date(selectedSlotData.date);
            meetingDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const meetingPayload = {
              topic: `Interview: ${formData.name} for ${jobData.jobTitle || jobData.title}`,
              agenda: `Technical Interview for ${jobData.jobTitle || jobData.title} position at ${clientData.name}`,
              presenter: interviewerData.zoho_meet_uid || interviewerData.zohoMeetId || '60058686791',
              startTime: `${meetingDate.toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
              })} ${meetingDate.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }).trim()}`,
              duration: 3600000,
              timezone: "Asia/Kolkata",
              participants: [
                { email: formData.email, name: formData.name },
                { email: interviewerData.email, name: interviewerData.name }
              ],
              interviewerId: finalInterviewerId,
              candidateId: newCandidate._id
            };

            const meetData = await apiFetch('/meetings/create', {
              method: 'POST',
              token,
              body: JSON.stringify(meetingPayload)
            });

            if (meetData.session) {
              const session = meetData.session;
              meetingLink = session.joinLink || session.join_url || session.meetingLink || session.meeting_link || session.url;
              sessionId = session.meetingKey || session.meeting_key || session.sys_id || session.sessionId || session.session_id || session.id;
            }
          } catch (meetError) {
            console.error('Error creating Zoho meeting via server:', meetError);
          }
        }

        const baseUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
        const schedulingLink = `${baseUrl}/timeslots?candidateId=${newCandidate._id}`;

        const emailResult = await apiFetch('/emails/send-interview-slot', {
          method: 'POST',
          token,
          body: JSON.stringify({
            candidateEmail: formData.email,
            candidateName: formData.name,
            recruiterEmail: user?.email,
            vendorEmail: vendorData?.email || null,
            jobTitle: jobData?.jobTitle || jobData?.title,
            clientName: clientData?.name,
            interviewerName: interviewerData?.name || 'Interviewer',
            selectedTimeSlot: selectedTimeSlot,
            sendDirectInvitation: !!selectedTimeSlot,
            link: selectedTimeSlot && meetingLink ? meetingLink : schedulingLink
          }),
        });
        if (!emailResult.success) {
          toast.error('Candidate added but failed to send notifications');
        } else {
          toast.success(`Candidate added and ${selectedTimeSlot ? 'Scheduled' : 'invitation sent'} successfully`);
        }

        onClose();
        onCandidateAdded?.();
        resetForm();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Failed to add candidate: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueWithDuplicate = () => {
    setShowDuplicateModal(false);
    proceedWithSubmission();
  };

  const handleExitDuplicate = () => {
    setShowDuplicateModal(false);
    resetForm();
    onClose();
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      location: '',
      primaryContact: '',
      secondaryContact: '',
      vendorId: '',
      clientId: '',
      jobId: '',
      interviewerId: '',
      status: '0',
      profilePic: null,
      resume: [],
      supportingDocuments: [],
      experience: '',
      trash: false
    });

    setResume([]);
    setSupportingDocuments([]);
    setPreviewUrl(null);
    setCurrentSelectedClient(null);
    setCurrentSelectedJob(null);
    setInterviewerSearchTerm('');
    setShowInterviewerDropdown(false);
    setSelectedTimeSlot('');
    setSelectedSlotData(null);
    setAvailableTimeSlots([]);
  };

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleClientChange = (clientId) => {
    const client = clients.find(client => client.id === clientId)
    setCurrentSelectedClient(client)
    setFormData(prev => ({ ...prev, clientId }))
  }

  const handleJobChange = (jobId) => {
    const job = jobs.find(job => job.id === jobId)
    setCurrentSelectedJob(job)
    setFormData(prev => ({ ...prev, jobId }))
  }

  const handleInterviewerSearch = (value) => {
    setInterviewerSearchTerm(value)
    setShowInterviewerDropdown(true)
  }

  const handleInterviewerSelect = (interviewer) => {
    setFormData(prev => ({ ...prev, interviewerId: interviewer.id }))
    setInterviewerSearchTerm(`${interviewer.name || interviewer.email}${interviewer.role ? ` - ${interviewer.role}` : ''}`)
    setShowInterviewerDropdown(false)
  }

  const handleInterviewerInputFocus = () => {
    setShowInterviewerDropdown(true)
    setFilteredInterviewers(interviewers)
  }

  const handleInterviewerInputBlur = () => {
    setTimeout(() => setShowInterviewerDropdown(false), 150)
  }
  const handleTimeSlotSelect = (timeSlot) => {
    setSelectedTimeSlot(`${timeSlot.date} at ${timeSlot.time}`)
    setSelectedSlotData({
      date: timeSlot.date,
      time: timeSlot.time24,
      displayTime: timeSlot.time
    })
    setShowTimeSlotDropdown(false)
  }

  const handleTimeSlotInputFocus = () => {
    if (!formData.interviewerId) {
      toast.error('Please select an interviewer first')
      return
    }
    if (availableTimeSlots.length === 0) {
      fetchTimeSlots()
    }
    setShowTimeSlotDropdown(true)
  }

  const handleTimeSlotInputBlur = () => {
    setTimeout(() => setShowTimeSlotDropdown(false), 150)
  }
  const dialogTitle = isEditing ? 'Edit Candidate' : 'Add New Candidate'
  const submitButtonText = isEditing ? (isSubmitting ? 'Updating...' : 'Update Candidate')
    : (isSubmitting ? 'Adding...' : 'Add Candidate')

  // Update the useEffect for editing mode to properly handle file data
  useEffect(() => {
    if (isEditing && candidateData) {
      setFormData({
        ...candidateData,
        // Don't convert existing profilePic URL to File object
        profilePic: candidateData.profile_pic || null,
        name: candidateData.full_name || '',
        email: candidateData.email || '',
        location: candidateData.location || '',
        primaryContact: candidateData.primary_contact || '',
        secondaryContact: candidateData.secondary_contact || '',
        vendorId: candidateData.vendor_id || '',
        jobId: candidateData.job_id || '',
        clientId: candidateData.client_id || '',
        interviewerId: candidateData.interviewer_id || '',
        status: candidateData.status || '0',
        experience: candidateData.experience_years || ''
      });

      // Set profile preview if there's an existing profile pic
      if (candidateData.profilePic) {
        setProfilePreview(candidateData.profilePic);
      }

      // Set documents if they exist
      if (candidateData.resumes && candidateData.resumes.length > 0) {
        setResume(candidateData.resumes);
      }
      if (candidateData.supporting_documents && candidateData.supporting_documents.length > 0) {
        setSupportingDocuments(candidateData.supporting_documents);
      }

      // Set client and job selections
      if (candidateData.client_id) {
        setCurrentSelectedClient(clients.find(client => client.id === candidateData.client_id));
      }
      if (candidateData.job_id) {
        setCurrentSelectedJob(jobs.find(job => job.id === candidateData.job_id));
      }

      // Set interviewer search term if interviewer is selected
      if (candidateData.interviewer_id) {
        const selectedInterviewer = interviewers.find(i => i.id === candidateData.interviewer_id);
        if (selectedInterviewer) {
          setInterviewerSearchTerm(`${selectedInterviewer.name || selectedInterviewer.email}${selectedInterviewer.role ? ` - ${selectedInterviewer.role}` : ''}`);
        }
      }

      // Set time slot if interview is scheduled
      if (candidateData.interviewDate && candidateData.interviewTime) {
        setSelectedTimeSlot(`${candidateData.interviewDate} at ${candidateData.interviewTime}`);
        setSelectedSlotData({
          date: candidateData.interviewDate,
          time: candidateData.interviewTime,
          displayTime: candidateData.interviewTime
        });
      }
    }
  }, [isEditing, candidateData, clients, jobs, interviewers]);

  useEffect(() => {
    if (prefilledJobData || selectedJob) {
      const jobToUse = prefilledJobData || selectedJob;
      setFormData(prev => ({
        ...prev,
        jobId: jobToUse.id,
        clientId: jobToUse.clientId
      }));

      setCurrentSelectedJob(jobToUse);

      const relatedClient = clients.find(client => client.id === jobToUse.clientId);
      setCurrentSelectedClient(relatedClient);

      if (jobs.length > 0) {
        const jobsForClient = jobs.filter(job => job.clientId === jobToUse.clientId);
        setFilteredJobs(jobsForClient);
      }
    }
  }, [prefilledJobData, selectedJob, clients, jobs]);

  useEffect(() => {
    if (prefilledJobData) {
      const relatedClient = clients.find(client => client.id === prefilledJobData.clientId);

      setFormData(prev => ({
        ...prev,
        jobId: prefilledJobData.id,
        clientId: prefilledJobData.clientId
      }));

      setCurrentSelectedJob({
        id: prefilledJobData.id,
        title: prefilledJobData.title || prefilledJobData.jobTitle
      });

      if (relatedClient) {
        setCurrentSelectedClient(relatedClient);

        const jobsForClient = jobs.filter(job => job.clientId === relatedClient.id);
        setFilteredJobs(jobsForClient);
      }
    }
  }, [prefilledJobData, clients, jobs]);

  useEffect(() => {
    const handleCompanyChange = (event) => {
      const selectedCompany = event.detail;
      if (user?.role === 'SuperAdmin') {
        setFormData(prev => ({
          ...prev,
          company: selectedCompany.name
        }));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('companyChanged', handleCompanyChange);
      return () => {
        window.removeEventListener('companyChanged', handleCompanyChange);
      };
    }
  }, [user?.role]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />



      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-4xl max-h-[90vh] transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
              {dialogTitle}
            </Dialog.Title>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Upload */}
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="relative h-24 w-24">
                  {profilePreview ? (
                    <img
                      src={profilePreview}
                      alt="Profile preview"
                      className="h-full w-full rounded-full object-cover border-2 border-blue-500"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <FiUpload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Profile Picture</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Upload a professional photo</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Resume</h3>
                  </div>
                  <label className="inline-flex items-center px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                    <FiUpload className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 mr-1.5" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Add Files</span>
                    <input
                      type="file"
                      multiple
                      accept=".doc,.docx,.pdf"
                      onChange={handleResumeChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {resume.length > 0 ? (
                  <DocumentList documents={resume} removeDocument={removeResume} />
                ) : (
                  <div className="text-center py-2 px-4 bg-white dark:bg-gray-800 rounded border border-dashed border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Drop PDF or Word documents here
                    </p>
                  </div>
                )}
              </div>

              {/* Basic Information */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Basic Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleFormChange('location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Primary Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary Contact *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.primaryContact}
                      onChange={(e) => handleFormChange('primaryContact', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Secondary Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Secondary Contact
                    </label>
                    <input
                      type="tel"
                      value={formData.secondaryContact}
                      onChange={(e) => handleFormChange('secondaryContact', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Experience Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Experience (years)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.experience}
                      onChange={(e) => handleFormChange('experience', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Vendor Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Vendor
                    </label>
                    <select
                      value={formData.vendorId}
                      onChange={(e) => handleFormChange('vendorId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a vendor</option>
                      {vendors.map(vendor => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.vendorName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Conditionally render client and job dropdowns */}
                  {showClientJobDropdowns && (
                    <>
                      {/* Client Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Select Client *
                        </label>
                        <select
                          required
                          value={formData.clientId}
                          onChange={(e) => handleClientChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                          Select Job *
                        </label>
                        <select
                          required
                          value={formData.jobId}
                          onChange={(e) => handleJobChange(e.target.value)}
                          disabled={!formData.clientId}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                        >
                          <option value="">Select a job</option>
                          {filteredJobs.map(job => (
                            <option key={job.id} value={job.id}>
                              {job.title || job.jobTitle}
                            </option>
                          ))}
                        </select>
                        {!formData.clientId && (
                          <p className="text-xs text-gray-500 mt-1">Please select a client first</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Interviewer Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Interviewer
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={interviewerSearchTerm}
                        onChange={(e) => handleInterviewerSearch(e.target.value)}
                        onFocus={handleInterviewerInputFocus}
                        onBlur={handleInterviewerInputBlur}
                        placeholder="Search interviewer by name or role..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />

                      {showInterviewerDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredInterviewers.length > 0 ? (
                            filteredInterviewers.map(interviewer => (
                              <div
                                key={interviewer.id}
                                onMouseDown={() => handleInterviewerSelect(interviewer)}
                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-white"
                              >
                                <div className="font-medium">{interviewer.name || interviewer.email}</div>
                                {interviewer.role && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{interviewer.role}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
                              No interviewers found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time Slot Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Interview Time Slot
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        onFocus={handleTimeSlotInputFocus}
                        onBlur={handleTimeSlotInputBlur}
                        placeholder="Click to see all available time slots"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        readOnly
                      />

                      {showTimeSlotDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-80 overflow-y-auto">
                          {isLoadingTimeSlots ? (
                            <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
                              Loading time slots...
                            </div>
                          ) : availableTimeSlots.length > 0 ? (
                            <div>
                              {availableTimeSlots.map((slot, index) => {
                                // Group slots by date
                                const currentDate = slot.date;
                                const prevDate = index > 0 ? availableTimeSlots[index - 1].date : null;
                                const showDateHeader = currentDate !== prevDate;

                                return (
                                  <div key={index}>
                                    {showDateHeader && (
                                      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-600">
                                        {currentDate}
                                      </div>
                                    )}
                                    <div
                                      onMouseDown={() => handleTimeSlotSelect(slot)}
                                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="font-medium">{slot.time}</div>
                                        {slot.duration && (
                                          <div className="text-sm text-gray-500 dark:text-gray-400">{slot.duration}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
                              {formData.interviewerId ? 'No available time slots in the next 30 days' : 'Please select an interviewer first'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Supporting Documents</h3>
                    <span className="text-xs text-gray-400">({supportingDocuments.length} files)</span>
                  </div>
                  <label className="inline-flex items-center px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                    <FiUpload className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 mr-1.5" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Add Files</span>
                    <input
                      type="file"
                      multiple
                      accept=".doc,.docx,.pdf"
                      onChange={handleSupportingDocumentsChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {supportingDocuments.length > 0 ? (
                  <DocumentList documents={supportingDocuments} removeDocument={removeSupportingDocument} />
                ) : (
                  <div className="text-center py-2 px-4 bg-white dark:bg-gray-800 rounded border border-dashed border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Drop PDF or Word documents here
                    </p>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Candidate'
                  )}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Panel>
      </div>

      {/* Duplicate Candidate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden m-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Existing Candidate Found
                </h3>
                <button
                  onClick={handleExitDuplicate}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                A candidate with email <span className="font-medium">{formData.email}</span> already exists in the system.
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                Application History ({duplicateCandidates.length} {duplicateCandidates.length === 1 ? 'entry' : 'entries'})
              </h4>

              <div className="space-y-4">
                {duplicateCandidates.map((candidate, index) => (
                  <div key={candidate.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {candidate.name}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {candidate.primaryContact}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {candidate.location}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${candidate.status === '3' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        candidate.status === '4' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          candidate.status === '2' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                        {candidate.status === '0' ? 'APPLIED' :
                          candidate.status === '1' ? 'WAITING' :
                            candidate.status === '2' ? 'SCHEDULED' :
                              candidate.status === '3' ? 'SELECTED' :
                                candidate.status === '4' ? 'REJECTED' :
                                  candidate.status === '5' ? 'ON_HOLD' : 'APPLIED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Company:</span>
                        <p className="text-gray-600 dark:text-gray-400">{candidate.company_id?.name || candidate.company || 'N/A'}</p>
                      </div>

                      {(candidate.client_id || candidate.clientDetails) && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Client:</span>
                          <p className="text-gray-600 dark:text-gray-400">{candidate.client_id?.name || candidate.clientDetails?.name}</p>
                        </div>
                      )}

                      {(candidate.job_id || candidate.jobDetails) && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Job:</span>
                          <p className="text-gray-600 dark:text-gray-400">{candidate.job_id?.title || candidate.jobDetails?.jobTitle}</p>
                        </div>
                      )}

                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Applied:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          {candidate.createdAt?.toDate ? candidate.createdAt.toDate().toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {candidate.experience && (
                      <div className="mt-3 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Experience:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">{candidate.experience} years</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleExitDuplicate}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Exit
                </button>
                <button
                  onClick={handleContinueWithDuplicate}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
                >
                  Continue Adding Candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export default memo(AddNewCandidate)