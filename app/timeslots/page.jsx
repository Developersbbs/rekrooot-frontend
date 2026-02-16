'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { format, addDays, startOfToday } from 'date-fns'
import { MdWarning } from 'react-icons/md'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import { Dialog } from '@mui/material'

const convertTo24Hour = (time) => {
  const [timeStr, period] = time.split(' ');
  let [hours, minutes] = timeStr.split(':').map(Number);

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

const TimeslotsPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TimeslotsPageContent />
    </Suspense>
  );
}

const fallbackPresenterId = process.env.NEXT_PUBLIC_ZOHO_DEFAULT_PRESENTER_ID;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const TimeslotsPageContent = () => {
  const searchParams = useSearchParams()
  const [candidateId, setCandidateId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(startOfToday())
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [interviewers, setInterviewers] = useState([])
  const [loading, setLoading] = useState(false)
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
    const cid = searchParams.get('candidateId')
    if (cid) {
      setCandidateId(cid)
    }
  }, [searchParams])

  useEffect(() => {
    const fetchData = async () => {
      if (!candidateId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/public`);
        if (!response.ok) throw new Error('Failed to fetch candidate');

        const { candidate } = await response.json();

        if (candidate.interviewer_id) {
          setCandidateAssignedInterviewerId(candidate.interviewer_id);
        }

        const clientData = candidate.client_id || {};
        const jobData = candidate.job_id || {};

        setInterviewDetails({
          company: {
            name: clientData.name || "Company",
            logo: clientData.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${clientData.name || 'Company'}`,
            position: jobData.title || jobData.jobTitle || "Position",
            type: "Technical Interview - Round 1",
            duration: "60 minutes",
            location: "Virtual (Zoho Meeting)",
          },
          candidate: {
            name: candidate.full_name,
            email: candidate.email,
            role: jobData.title || jobData.jobTitle || "Candidate",
            experience: candidate.experience_years,
            avatar: candidate.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.full_name}`
          }
        });

        // Check/Set existing interview status
        if (candidate.interview_date && candidate.interview_time) {
          const formattedDate = format(new Date(candidate.interview_date), 'MMMM d, yyyy');
          setMeetingDetails({
            date: formattedDate,
            time: candidate.interview_time,
            meetingLink: candidate.meeting_link,
            isExisting: true // Mark as existing to show the "Already Scheduled" dialog
          });
        }

      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Error fetching interview details')
      }
    }

    fetchData()
  }, [candidateId])

  useEffect(() => {
    const fetchInterviewers = async () => {
      try {
        // Fetch all interviewers with public info + availability
        const response = await fetch(`${API_BASE_URL}/interviewers/public/list`);
        if (!response.ok) throw new Error("Failed to fetch interviewers");

        const data = await response.json();
        // Map backend fields to frontend expectations
        const mappedInterviewers = (data.interviewers || []).map(i => ({
          id: i._id,
          name: i.name,
          email: i.email,
          zohoMeetId: i.zoho_meet_uid,
          availabilitySlots: i.availability_slots || {} // Map snake_case to camelCase
        }));

        setInterviewers(mappedInterviewers)
      } catch (error) {
        console.error('Error fetching interviewers:', error)
        toast.error('Error fetching interviewers')
      }
    }

    fetchInterviewers()
  }, [])

  useEffect(() => {
    const getAvailableSlotsForDate = () => {
      const dateStr = selectedDate.toDateString(); // e.g., "Mon Dec 01 2025"
      // Note: Backend availability_slots keys MUST match this format 
      // i.e., keys in availability_slots are "Mon Dec 01 2025" strings.
      // If backend uses different format, we need to adjust.
      // Assuming legacy format persisted.

      const availableSlotsForDate = [];
      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const interviewersToCheck = candidateAssignedInterviewerId
        ? interviewers.filter(interviewer => interviewer.id === candidateAssignedInterviewerId)
        : interviewers;

      interviewersToCheck.forEach(interviewer => {
        if (interviewer.availabilitySlots && interviewer.availabilitySlots[dateStr]) {
          Object.entries(interviewer.availabilitySlots[dateStr]).forEach(([time, status]) => {
            const isBooked = typeof status === 'string' && status !== 'available';

            // Convert 24h to 12h
            const [hourStr, minStr] = time.split(':');
            const hour = parseInt(hourStr);
            const minute = parseInt(minStr);

            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const displayMin = minute < 10 ? `0${minute}` : minute;
            const formattedTime = `${displayHour.toString().padStart(2, '0')}:${displayMin} ${period}`;

            const slotMinutes = hour * 60 + minute;

            if (!isToday || slotMinutes >= currentMinutes) {
              const existingSlot = availableSlotsForDate.find(slot => slot.time === formattedTime);

              if (!existingSlot) {
                // Calculate end time (1 hour duration)
                let endHour = hour + 1;
                let endMinute = minute;
                if (endHour >= 24) endHour -= 24;

                const endPeriod = endHour >= 12 ? 'PM' : 'AM';
                const displayEndHour = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
                const displayEndMin = endMinute < 10 ? `0${endMinute}` : endMinute;

                const startLabel = minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${displayMin} ${period}`;
                const endLabel = endMinute === 0 ? `${displayEndHour} ${endPeriod}` : `${displayEndHour}:${displayEndMin} ${endPeriod}`;
                const displayLabel = `${startLabel} to ${endLabel}`;

                availableSlotsForDate.push({
                  time: formattedTime,
                  displayLabel: displayLabel,
                  interviewerId: interviewer.id,
                  isBooked: isBooked
                });
              } else if (existingSlot.isBooked && !isBooked) {
                // If we found an available interviewer for a slot that was previously marked as booked,
                // mark it as available.
                existingSlot.isBooked = false;
                existingSlot.interviewerId = interviewer.id;
              }
            }
          });
        }
      });

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

      // Schedule the meeting first to get the link
      const meetingResult = await scheduleMeeting(slotData.interviewerId);

      if (!meetingResult) throw new Error("Failed to schedule meeting");

      const { meetingLink, sessionId, presenterId, zsoid } = meetingResult;

      // Update candidate (and interviewer availability via backend hook)
      const confirmResponse = await fetch(`${API_BASE_URL}/candidates/${candidateId}/confirm-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interviewDate: selectedDate.toDateString(),
          interviewTime: selectedSlot,
          interviewerId: slotData.interviewerId,
          meetingLink,
          sessionId,
          presenterId,
          zsoid
        })
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm slot in database');
      }

      // Set meeting details for popup
      const interviewer = interviewers.find(i => i.id === slotData.interviewerId);
      setMeetingDetails({
        date: format(selectedDate, 'MMMM d, yyyy'),
        time: selectedSlot,
        interviewer: interviewer?.name || "Interviewer",
        duration: interviewDetails.company.duration,
        type: interviewDetails.company.type,
        meetingLink: meetingLink,
        isExisting: false // Newly created
      });

      toast.success('Interview slot confirmed! Meeting scheduled.');
      setShowSuccessPopup(true);

    } catch (error) {
      console.error('Error confirming slot:', error);
      toast.error('Error confirming interview slot: ' + error.message);
      setShowSuccessPopup(false);
    } finally {
      setLoading(false);
    }
  };

  const scheduleMeeting = async (selectedInterviewerId) => {
    try {
      // Get interviewer details
      const interviewer = interviewers.find(i => i.id === selectedInterviewerId);
      if (!interviewer) throw new Error("Interviewer not found locally");

      const presenterId = interviewer.zohoMeetId || fallbackPresenterId;

      const meetingTopic = `Interview: ${interviewDetails.candidate.name} - ${interviewDetails.candidate.role}`;
      const meetingAgenda = `Technical Interview for ${interviewDetails.candidate.name}`;

      const [time, period] = selectedSlot.split(' ');
      const [hour, minute] = time.split(':');
      let hour24 = parseInt(hour);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;

      const meetingDate = new Date(selectedDate);
      meetingDate.setHours(hour24, 0, 0, 0);

      const formattedDate = `${meetingDate.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      })} ${meetingDate.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).trim()}`;

      const response = await fetch(`${API_BASE_URL}/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidateId: candidateId,
          topic: meetingTopic,
          agenda: meetingAgenda,
          presenter: presenterId,
          interviewerId: selectedInterviewerId,
          startTime: formattedDate,
          duration: 3600000, // 1 hour
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participants: [
            { email: interviewDetails.candidate.email },
            { email: interviewer.email }
          ]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Backend failed to create meeting");
      }

      const meetData = await response.json();

      // Extract links similar to previous logic
      if (meetData && meetData.session) {
        const meetingLink = meetData.session.joinLink ||
          meetData.session.join_url ||
          meetData.session.meetingLink ||
          meetData.session.meeting_link ||
          meetData.session.url;

        const sessionId = meetData.session.meetingKey ||
          meetData.session.meeting_key ||
          meetData.session.sys_id ||
          meetData.session.sessionId ||
          meetData.session.session_id ||
          meetData.session.id;

        const zsoid = meetData.session.zsoid || meetData.session.meeting?.zsoid || null;

        return { meetingLink, sessionId, presenterId, zsoid };
      }
      return null;

    } catch (e) {
      console.error("Schedule meeting error:", e);
      return null; // Return null to indicate failure
    }
  };

  const handleClosePopup = () => {
    // window.close(); // Only works if opened by script
    setShowSuccessPopup(false);
  }

  // Effect to check if already scheduled (optional, good UX)
  useEffect(() => {
    if (meetingDetails?.meetingLink && meetingDetails?.isExisting) {
      setOpenDialog(true);
    }
  }, [meetingDetails]);

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

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
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium">{interviewDetails.candidate.role} ({interviewDetails.candidate.experience || 'N/A'})</p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-primary-500 dark:text-primary-300">
            Select Interview Date
          </h2>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface-light dark:from-surface-dark to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface-light dark:from-surface-dark to-transparent pointer-events-none z-10" />

            <div className="flex overflow-x-auto scrollbar-hide pb-4 gap-3 px-1 snap-x snap-mandatory">
              {next7Days.map((date) => (
                <button
                  key={date.toString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-none w-[80px] p-3 rounded-xl transition-all snap-center ${selectedDate.toDateString() === date.toDateString()
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
                          onClick={() => !slot.isBooked && setSelectedSlot(slot.time)}
                          disabled={slot.isBooked}
                          className={`relative p-2.5 sm:p-3 rounded-lg transition-all duration-200 
                            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
                            ${slot.isBooked
                              ? 'bg-gray-100 dark:bg-gray-800/20 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700'
                              : selectedSlot === slot.time
                                ? 'bg-accent-500 text-white shadow-md'
                                : 'bg-primary-50/50 dark:bg-primary-800/30 hover:bg-accent-500/90 hover:text-white'
                            }`}
                        >
                          <span className={`text-sm font-medium ${slot.isBooked ? 'line-through' : ''}`}>
                            {slot.displayLabel || slot.time}
                          </span>
                          {slot.isBooked && (
                            <span className="block text-[10px] uppercase tracking-tighter font-bold opacity-60">
                              Booked
                            </span>
                          )}
                          {!slot.isBooked && selectedSlot === slot.time && (
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

        {/* Confirmation Bar */}
        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <div className="absolute inset-0 bg-gradient-to-t from-surface-light dark:from-surface-dark to-transparent -top-8" />
            <div className="relative bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 p-3 sm:p-4">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-500" />
                    <p className="text-sm font-medium text-primary-500">
                      {format(selectedDate, 'MMMM d')} at {availableSlots.find(s => s.time === selectedSlot)?.displayLabel || selectedSlot}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 pl-4">
                    {interviewDetails.company.duration} • {interviewDetails.company.type}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="flex-1 sm:flex-none min-w-[80px] px-3 py-1.5 rounded-lg text-sm
                      border border-gray-300 dark:border-gray-600 
                      text-gray-700 dark:text-gray-300 
                      hover:bg-gray-100 dark:hover:bg-gray-800 
                      transition-all duration-200"
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
                  {meetingDetails.date} at {availableSlots.find(s => s.time === meetingDetails.time)?.displayLabel || meetingDetails.time}
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

    </div>
  )
}

export default TimeslotsPage