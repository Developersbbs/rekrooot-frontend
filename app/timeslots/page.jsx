'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { format, addDays, startOfToday } from 'date-fns'
import { collection, getDocs, doc, getDoc, updateDoc, query, where, deleteField } from 'firebase/firestore'
import { db } from '@/config/firebase.config'
import { MdWarning } from 'react-icons/md'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material'

const convertTo24Hour = (time) => {
  const [timeStr, period] = time.split(' ');
  let [hours, minutes] = timeStr.split(':').map(Number);

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes; // Convert to minutes for easier comparison
};

const TimeslotsPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TimeslotsPageContent />
    </Suspense>
  );
}

const fallbackPresenterId = process.env.NEXT_PUBLIC_ZOHO_DEFAULT_PRESENTER_ID || '60058686791';

const TimeslotsPageContent = () => {
  const searchParams = useSearchParams()
  const [candidateId, setCandidateId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(startOfToday())
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [interviewers, setInterviewers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedInterviewer, setSelectedInterviewer] = useState(null)
  const [candidateAssignedInterviewerId, setCandidateAssignedInterviewerId] = useState(null)
  const [interviewDetails, setInterviewDetails] = useState({
    company: {
      name: "",
      logo: "",
      position: "",
      type: "Technical Interview - Round 2",
      duration: "45 minutes",
      location: "Virtual (Zoom)",
    },
    candidate: {
      name: "",
      email: "",
      role: "",
      experience: "",
      avatar: ""
    }
  })
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [meetingDetails, setMeetingDetails] = useState(null)
  const [openDialog, setOpenDialog] = useState(false)

  useEffect(() => {
    const candidateId = searchParams.get('candidateId')
    if (candidateId) {
      setCandidateId(candidateId)
    }
  }, [searchParams])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch candidate data
        const candidateDoc = await getDoc(doc(db, 'candidates', candidateId))
        const candidateData = candidateDoc.data()

        // Store the candidate's assigned interviewer ID if it exists
        if (candidateData.interviewerId) {
          setCandidateAssignedInterviewerId(candidateData.interviewerId)
        }

        // Fetch client data using clientId from candidate
        const clientDoc = await getDoc(doc(db, 'Clients', candidateData.clientId))
        const clientData = clientDoc.data()

        // Fetch job data using jobId from candidate
        const jobDoc = await getDoc(doc(db, 'jobs', candidateData.jobId))
        const jobData = jobDoc.data()

        if (!candidateData.clientId || !candidateData.jobId) {
          console.error('Missing client or job ID');
          toast.error('Incomplete candidate data');
          return;
        }

        setInterviewDetails({
          company: {
            name: clientData.name,
            logo: clientData.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${clientData.name}`,
            position: jobData.title,
            type: "Technical Interview - Round 1",
            duration: "60 minutes",
            location: "Virtual (Zoho Meeting)",
          },
          candidate: {
            name: candidateData.name,
            email: candidateData.email,
            role: jobData.jobTitle,
            experience: candidateData.experience,
            avatar: candidateData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidateData.name}`
          }
        })
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Error fetching interview details')
      }
    }

    if (candidateId) {
      fetchData()
    }
  }, [candidateId])

  useEffect(() => {
    const fetchInterviewers = async () => {
      try {
        const interviewersSnapshot = await getDocs(collection(db, 'Interviewers'))
        const interviewersData = interviewersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }))
        setInterviewers(interviewersData)
      } catch (error) {
        console.error('Error fetching interviewers:', error)
        toast.error('Error fetching interviewers')
      }
    }

    fetchInterviewers()
  }, [])

  useEffect(() => {
    // Get available slots for selected date from interviewers
    // If candidate has assigned interviewer, show only that interviewer's slots
    const getAvailableSlotsForDate = () => {
      const dateStr = selectedDate.toDateString();
      const availableSlotsForDate = [];
      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Filter interviewers based on candidate's assigned interviewer
      const interviewersToCheck = candidateAssignedInterviewerId
        ? interviewers.filter(interviewer => interviewer.id === candidateAssignedInterviewerId)
        : interviewers;

      interviewersToCheck.forEach(interviewer => {
        if (interviewer.availabilitySlots && interviewer.availabilitySlots[dateStr]) {
          Object.entries(interviewer.availabilitySlots[dateStr]).forEach(([time, status]) => {
            if (status === 'available') {
              // Convert 24h format to 12h format
              const hour = parseInt(time.split(':')[0]);
              const period = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
              const formattedTime = `${displayHour.toString().padStart(2, '0')}:00 ${period}`;

              // Convert time to minutes for comparison
              const slotMinutes = hour * 60;

              // Only include slots that are current or future
              // If it's today, filter out past slots
              // If it's a future date, include all slots
              if (!isToday || slotMinutes >= currentMinutes) {
                if (!availableSlotsForDate.find(slot => slot.time === formattedTime)) {
                  availableSlotsForDate.push({
                    time: formattedTime,
                    interviewerId: interviewer.id,
                    createdAt: interviewer.createdAt
                  });
                }
              }
            }
          });
        }
      });

      // Sort slots by time
      availableSlotsForDate.sort((a, b) => {
        return convertTo24Hour(a.time) - convertTo24Hour(b.time);
      });

      setAvailableSlots(availableSlotsForDate);
    };

    if (interviewers.length > 0) {
      getAvailableSlotsForDate();
    }
  }, [selectedDate, interviewers, candidateAssignedInterviewerId]);

  const next7Days = [...Array(7)].map((_, i) => addDays(startOfToday(), i))

  const handleConfirmSlot = async () => {
    if (!selectedSlot || !candidateId) return;

    setLoading(true);
    try {
      const slotData = availableSlots.find(slot => slot.time === selectedSlot);
      if (!slotData) {
        throw new Error('Selected slot not found');
      }

      // Update candidate document in Firebase
      const candidateRef = doc(db, 'candidates', candidateId);

      // Get current candidate data
      const candidateDoc = await getDoc(candidateRef);
      const currentData = candidateDoc.data();

      // Create update object with new interview details and explicitly remove result
      const updateData = {
        status: 'Scheduled',
        interviewDate: format(selectedDate, 'EEE MMM dd yyyy'),
        interviewTime: selectedSlot,
        interviewerId: slotData.interviewerId
      };

      // If result exists, we need to remove it
      if (currentData && 'result' in currentData) {
        updateData.result = deleteField();
      }

      await updateDoc(candidateRef, updateData);
      console.log('✅ Updated candidate - result field should be removed');

      // Update the interviewer's timeslot with candidate ID
      const interviewerRef = doc(db, 'Interviewers', slotData.interviewerId);
      const dateStr = selectedDate.toDateString();
      const timeKey = selectedSlot.split(' ')[0];
      const period = selectedSlot.split(' ')[1];
      const hour = parseInt(timeKey.split(':')[0]);

      const hour24 = period === 'PM' ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
      const timeSlotKey = `${hour24.toString().padStart(2, '0')}:00`;

      await updateDoc(interviewerRef, {
        [`availabilitySlots.${dateStr}.${timeSlotKey}`]: candidateId
      });

      // Get interviewer details for the meeting
      const interviewerDoc = await getDoc(interviewerRef);
      const interviewerData = interviewerDoc.data();

      // Set initial meeting details before scheduling the meeting
      setMeetingDetails({
        date: format(selectedDate, 'MMMM d, yyyy'),
        time: selectedSlot,
        interviewer: interviewerData.name,
        duration: interviewDetails.company.duration,
        type: interviewDetails.company.type,
        meetingLink: '' // Will be updated after scheduling meeting
      });

      // Show success toast
      toast.success('Interview slot confirmed! Scheduling meeting...');

      // Schedule the meeting
      await scheduleMeeting(slotData.interviewerId);

      // Show the success popup
      setShowSuccessPopup(true);

    } catch (error) {
      console.error('Error confirming slot:', error);
      toast.error('Error confirming interview slot');
      setShowSuccessPopup(false);
    } finally {
      setLoading(false);
    }
  };

  const scheduleMeeting = async (selectedInterviewerId) => {
    try {
      // Fetch candidate details again to get interviewer and recruiter IDs
      const candidateDoc = await getDoc(doc(db, 'candidates', candidateId));
      const candidateData = candidateDoc.data();

      // Fetch all required data in parallel
      const fetchPromises = [
        getDoc(doc(db, 'Interviewers', selectedInterviewerId)),
        getDoc(doc(db, 'jobs', candidateData.jobId)), // Added job data fetch
        getDocs(query(collection(db, 'Users'), where('uid', '==', candidateData.createdBy)))
      ];

      // Only fetch vendor if vendorId exists
      if (candidateData.vendorId) {
        fetchPromises.push(getDoc(doc(db, 'Vendor', candidateData.vendorId)));
      }

      const results = await Promise.all(fetchPromises);
      const interviewerDoc = results[0];
      const vendorDoc = candidateData.vendorId ? results[3] : null;
      const jobDoc = results[1];
      const querySnapshot = results[2];

      const interviewerData = interviewerDoc?.data();
      if (!interviewerData) {
        throw new Error('Interviewer data not found');
      }

      const presenterId = interviewerData?.zohoMeetId || fallbackPresenterId;

      if (!presenterId) {
        throw new Error('Selected interviewer is missing a Zoho presenter ID. Update the interviewer profile or define NEXT_PUBLIC_ZOHO_DEFAULT_PRESENTER_ID.');
      }

      const vendorData = vendorDoc ? vendorDoc.data() : null;
      const jobData = jobDoc?.data();  // Get job data
      if (!jobData) {
        throw new Error('Job data not found');
      }
      const recruiterData = querySnapshot.docs[0]?.data() || null;

      // Fetch refresh token
      const refreshTokenResponse = await fetch('/api/refreshtoken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!refreshTokenResponse.ok) {
        throw new Error(`Failed to fetch refresh token: ${refreshTokenResponse.status}`);
      }
      const refreshTokenData = await refreshTokenResponse.json();

      // Convert selected time to 24-hour format
      const [time, period] = selectedSlot.split(' ');
      const [hour, minute] = time.split(':');
      let hour24 = parseInt(hour);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;

      // Create date object for the meeting
      const meetingDate = new Date(selectedDate);
      meetingDate.setHours(hour24, 0, 0, 0);

      // Format date for Zoho API (MMM DD, YYYY hh:mm A)
      const formattedDate = `${meetingDate.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      })} ${meetingDate.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).trim()}`;

      console.log(formattedDate); // Will output: "Dec 05, 2024 09:00 PM"

      const meetingTopic = `Interview: ${candidateData.name} - ${jobData?.jobTitle || 'Position'}`;
      const meetingAgenda = `Technical Interview for ${candidateData.name}`;

      console.log('Meeting request data:', {
        authToken: refreshTokenData.accessToken,
        topic: meetingTopic,
        agenda: meetingAgenda,
        presenter: presenterId,
        startTime: formattedDate,  // Will be in format: "Dec 05, 2024 09:00 PM"
        duration: 3600000,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        participants: [
          { email: candidateData.email },
          { email: interviewerData.email },
          { email: recruiterData?.email },
          { email: vendorData?.email }
        ].filter(p => p.email)
      });

      // Schedule meeting
      const createMeetResponse = await fetch('/api/createmeet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authToken: refreshTokenData.accessToken,
          topic: meetingTopic,
          agenda: meetingAgenda,
          presenter: presenterId,
          startTime: formattedDate,  // Now in the correct format
          duration: 3600000,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participants: [
            { email: candidateData.email },
            { email: interviewerData.email },
            { email: recruiterData?.email },
            { email: vendorData?.email }
          ].filter(p => p.email)
        })
      });

      if (!createMeetResponse.ok) {
        const errorData = await createMeetResponse.json();
        throw new Error(`Failed to schedule meeting: ${JSON.stringify(errorData)}`);
      }
      const meetData = await createMeetResponse.json();

      // Log the full meeting response to diagnose field names
      console.log('Full Zoho Meeting Response:', JSON.stringify(meetData, null, 2));

      // Check if we have a session object
      if (meetData && meetData.session) {
        // Try all possible field names for meeting link
        const meetingLink = meetData.session.joinLink ||
          meetData.session.join_url ||
          meetData.session.meetingLink ||
          meetData.session.meeting_link ||
          meetData.session.url;

        // Try all possible field names for session ID, prioritizing meetingKey for cancellation
        const sessionId = meetData.session.meetingKey ||
          meetData.session.meeting_key ||
          meetData.session.sys_id ||
          meetData.session.sessionId ||
          meetData.session.session_id ||
          meetData.session.id;

        console.log('Extracted - Meeting Link:', meetingLink, 'Session ID:', sessionId);

        if (meetingLink && sessionId) {
          // Update candidate document with meeting link and interview details
          const candidateRef = doc(db, 'candidates', candidateId);
          await updateDoc(candidateRef, {
            meetingLink: meetingLink,
            sessionId: sessionId,
            presenterId: presenterId,
            zsoid: meetData.session.zsoid || meetData.session.meeting?.zsoid || null,
            interviewDate: format(meetingDate, 'EEE MMM dd yyyy'),
            interviewTime: format(meetingDate, 'hh:mm a')
          });
          console.log('✅ Candidate updated with meeting link and session ID');

          // Update meeting details with the meeting link
          setMeetingDetails(prevDetails => ({
            ...prevDetails,
            meetingLink: meetingLink
          }));
        } else {
          console.error('❌ Missing meeting link or session ID in Zoho response');
          console.error('Available session fields:', Object.keys(meetData.session));
          toast.warning('Meeting scheduled but link/ID not available');
        }
      } else {
        console.error('❌ No session object in Zoho response');
        toast.warning('Meeting created but response format unexpected');
      }

      toast.success('Interview scheduled successfully!');

    } catch (error) {
      console.error('Error scheduling meeting:', error);
      toast.error('Error scheduling meeting: ' + error.message);
      setShowSuccessPopup(false);
    }
  };

  const handleClosePopup = () => {
    window.close();
  }

  // Update the Dialog content and handling
  const handleDialogClose = () => {
    setOpenDialog(false);
    window.close(); // Close the window when dialog is closed
  };

  // Update the useEffect that checks interview status
  useEffect(() => {
    const checkInterviewStatus = async () => {
      if (!candidateId) return;

      try {
        const candidateRef = doc(db, 'candidates', candidateId);
        const candidateDoc = await getDoc(candidateRef);

        if (candidateDoc.exists()) {
          const candidateData = candidateDoc.data();

          if (candidateData.interviewDate && candidateData.interviewTime && candidateData.interviewerId) {
            // Get interviewer details
            const interviewerDoc = await getDoc(doc(db, 'Interviewers', candidateData.interviewerId));
            const interviewerData = interviewerDoc.data();

            // Format the date properly
            const formattedDate = format(new Date(candidateData.interviewDate), 'MMMM d, yyyy');

            setInterviewDetails(prev => ({
              ...prev,
              scheduledDate: formattedDate,
              scheduledTime: candidateData.interviewTime,
              interviewer: interviewerData?.name || 'Not assigned',
              meetingLink: candidateData.meetingLink || '',
            }));
            setOpenDialog(true);
          }
        }
      } catch (error) {
        console.error("Error checking interview status:", error);
        toast.error("Error checking interview status");
      }
    };

    checkInterviewStatus();
  }, [candidateId]);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Company Header */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {interviewDetails.company.logo ? (
              <img
                src={interviewDetails.company.logo}
                alt="Company Logo"
                className="w-20 h-20 rounded-xl bg-primary-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary-100 flex items-center justify-center">
                <span>Logo</span>
              </div>
            )}
            <div className="space-y-2 text-center md:text-left flex-grow">
              <h1 className="text-3xl font-bold text-primary-500 dark:text-primary-300">
                {interviewDetails.company.name}
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400">
                {interviewDetails.candidate.role}
              </p>
            </div>
          </div>
        </div>

        {/* Interview Details Card */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-primary-500 dark:text-primary-300">
            Interview Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Interview Type</p>
                <p className="font-medium">{interviewDetails.company.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium">{interviewDetails.company.duration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{interviewDetails.company.location}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Candidate Name</p>
                <p className="font-medium">{interviewDetails.candidate.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{interviewDetails.candidate.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Role</p>
                <p className="font-medium">{interviewDetails.candidate.role} ({interviewDetails.candidate.experience})</p>
              </div>
            </div>
          </div>
        </div>

        {/* Updated Date Selection */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-primary-500 dark:text-primary-300">
            Select Interview Date
          </h2>
          <div className="relative">
            {/* Scroll Shadow Indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface-light dark:from-surface-dark to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface-light dark:from-surface-dark to-transparent pointer-events-none z-10" />

            {/* Date Selector */}
            <div className="flex overflow-x-auto scrollbar-hide pb-4 gap-3 px-1 snap-x snap-mandatory">
              {next7Days.map((date) => (
                <button
                  key={date.toString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-none w-[80px] p-3 rounded-xl transition-all snap-center ${selectedDate.toString() === date.toString()
                    ? 'bg-accent-500 text-white shadow-lg scale-105'
                    : 'bg-primary-50 dark:bg-primary-800 hover:bg-primary-100 dark:hover:bg-primary-700'
                    }`}
                >
                  <p className="font-medium text-sm">{format(date, 'EEE')}</p>
                  <p className="text-xl font-bold">{format(date, 'd')}</p>
                  <p className="text-xs">{format(date, 'MMM')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time Slots */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 sm:p-6 shadow-lg mb-16 sm:mb-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-primary-500 dark:text-primary-300">
              Available Time Slots
            </h2>
            <div className="flex items-center sm:items-end gap-2 text-gray-500">
              <span className="text-sm font-medium">
                {format(selectedDate, 'MMMM d, yyyy')}
              </span>
              <span className="hidden sm:inline text-gray-400">•</span>
              <span className="text-xs text-gray-400">
                Your local timezone
              </span>
            </div>
          </div>

          {/* Time Slots Grid */}
          <div className="space-y-4">
            {availableSlots.length > 0 ? (
              [
                { title: 'Morning', slots: availableSlots.filter(slot => slot.time.includes('AM')) },
                { title: 'Afternoon', slots: availableSlots.filter(slot => slot.time.includes('PM')) }
              ].map(({ title, slots }) => (
                slots.length > 0 && (
                  <div key={title}>
                    <h3 className="text-xs font-medium text-gray-500 mb-2">{title}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedSlot(slot.time)}
                          aria-label={`Select time slot for ${format(selectedDate, 'MMMM d')} at ${slot.time}`}
                          aria-selected={selectedSlot === slot.time}
                          role="option"
                          className={`relative p-2.5 sm:p-3 rounded-lg transition-all duration-200 
                            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
                            ${selectedSlot === slot.time
                              ? 'bg-accent-500 text-white shadow-md'
                              : 'bg-primary-50/50 dark:bg-primary-800/30 hover:bg-accent-500/90 hover:text-white'
                            }`}
                        >
                          <span className="text-sm font-medium">{slot.time}</span>
                          {selectedSlot === slot.time && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-[10px]">✓</span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))
            ) : (
              <div className="text-center py-10">
                <div className="flex flex-col items-center justify-center">
                  <MdWarning className="w-20 h-20 mb-4 text-gray-400" />
                  <p className="text-lg text-gray-500 font-medium">
                    No timeslots available on this date
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Bar - Fixed at Bottom */}
        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface-light dark:from-surface-dark to-transparent -top-8" />

            {/* Content */}
            <div className="relative bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 p-3 sm:p-4">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                {/* Selected Time Info */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-500" />
                    <p className="text-sm font-medium text-primary-500">
                      {format(selectedDate, 'MMMM d')} at {selectedSlot}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 pl-4">
                    {interviewDetails.company.duration} • {interviewDetails.company.type}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="flex-1 sm:flex-none min-w-[80px] px-3 py-1.5 rounded-lg text-sm
                      border border-gray-300 dark:border-gray-600 
                      text-gray-700 dark:text-gray-300 
                      hover:bg-gray-100 dark:hover:bg-gray-800 
                      transition-all duration-200
                      hover:shadow-sm active:scale-95"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSlot}
                    disabled={loading}
                    className="flex-1 sm:flex-none min-w-[120px] px-3 py-1.5 rounded-lg text-sm
                      bg-accent-500 text-white font-medium
                      hover:bg-accent-600
                      transition-all duration-200
                      hover:shadow-sm active:scale-95
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <ClipLoader size={16} color="#ffffff" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      'Confirm Slot'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Popup */}
      {showSuccessPopup && meetingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Interview Scheduled!</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="border-b dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {meetingDetails.date} at {meetingDetails.time}
                </p>
              </div>
              <div className="border-b dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Interview Details</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {meetingDetails.type} ({meetingDetails.duration})
                </p>
              </div>
              <div className="border-b dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Interviewer</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {meetingDetails.interviewer}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Meeting Link</p>
                <a
                  href={meetingDetails.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-500 hover:text-accent-600 font-medium break-all"
                >
                  {meetingDetails.meetingLink}
                </a>
              </div>
            </div>

            <button
              onClick={handleClosePopup}
              className="w-full bg-accent-500 text-white py-2 px-4 rounded-lg hover:bg-accent-600 transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle className="text-center">
          Interview Already Scheduled
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-2">
            <div className="text-center bg-primary-50 dark:bg-primary-900 p-4 rounded-lg">
              <p className="text-lg font-semibold text-primary-600 dark:text-primary-300">
                {interviewDetails.company?.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {interviewDetails.company?.type}
              </p>
            </div>

            <div className="space-y-3">
              {interviewDetails.meetingLink && (
                <div>
                  <p className="text-sm text-gray-500">Meeting Link</p>
                  <a
                    href={interviewDetails.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-500 hover:text-accent-600 break-all"
                  >
                    {interviewDetails.meetingLink}
                  </a>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button
            onClick={handleDialogClose}
            variant="contained"
            fullWidth
            style={{ backgroundColor: '#6366f1' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default TimeslotsPage