'use client';

import React, { useState, useEffect, memo } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiCalendar, FiUser, FiClock } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';

const RescheduleModal = ({ isOpen, onClose, candidate, onRescheduled }) => {
    const [interviewers, setInterviewers] = useState([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState(null);
    const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
    const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInterviewers();
            if (candidate?.interviewerId) {
                const currentInterviewer = interviewers.find(i => i.id === candidate.interviewerId);
                if (currentInterviewer) {
                    setSelectedInterviewer(currentInterviewer);
                    setInterviewerSearchTerm(currentInterviewer.name || currentInterviewer.email);
                }
            }
        }
    }, [isOpen, candidate]);

    useEffect(() => {
        if (selectedInterviewer) {
            fetchAvailableSlots(selectedInterviewer.id);
        }
    }, [selectedInterviewer]);

    const fetchInterviewers = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const data = await apiFetch('/interviewers', { token });
            // The server returns mapping and data structure might be different, 
            // but based on typical patterns in this 앱:
            const interviewersData = data.interviewers || [];
            setInterviewers(interviewersData);

            if (candidate?.interviewerId) {
                const current = interviewersData.find(i => i._id === candidate.interviewerId);
                if (current) {
                    setSelectedInterviewer(current);
                    setInterviewerSearchTerm(current.name || current.email);
                }
            }
        } catch (error) {
            console.error('Error fetching interviewers:', error);
        }
    };

    const fetchAvailableSlots = async (interviewerId) => {
        setIsLoadingSlots(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const data = await apiFetch(`/interviewers/${interviewerId}/timeslots`, { token });

            if (data.success) {
                setAvailableTimeSlots(data.timeSlots || []);
            } else {
                console.error('Failed to fetch slots');
                setAvailableTimeSlots([]);
            }
        } catch (error) {
            console.error('Error fetching slots:', error);
            setAvailableTimeSlots([]);
        } finally {
            setIsLoadingSlots(false);
        }
    };

    const handleInterviewerSelect = (interviewer) => {
        setSelectedInterviewer(interviewer);
        setInterviewerSearchTerm(interviewer.name || interviewer.email);
        setShowInterviewerDropdown(false);
        setSelectedSlot(null);
    };

    const handleReschedule = async () => {
        if (!selectedSlot || !selectedInterviewer) {
            toast.error('Please select both an interviewer and a time slot');
            return;
        }

        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            // 1. Cancel previous Zoho meeting if it exists via server
            if (candidate.sessionId && candidate.meetingLink) {
                try {
                    await apiFetch('/meetings/cancel', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                            sessionId: candidate.sessionId,
                            presenterId: candidate.presenterId
                        })
                    });
                } catch (cancelError) {
                    console.error('Error cancelling previous meeting via server:', cancelError);
                }
            }

            // 2. Clear old slot in interviewer schedule
            // Note: Server-side handles Candidate update and status, 
            // but we might need to manually update interviewer availability if server doesn't.
            // Based on candidate.route.js confirm-slot, it updates availability.
            // We should use a server endpoint for rescheduling if possible.

            // 3. Create new Zoho meeting via server
            let newMeeting = { sessionId: null, meetingLink: null, zsoid: null };
            try {
                const [hours, minutes] = selectedSlot.time24.split(':');
                const mDate = new Date(selectedSlot.date);
                mDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                const meetPayload = {
                    topic: `Rescheduled Interview: ${candidate.full_name}`,
                    agenda: `Technical Interview (Rescheduled)`,
                    presenter: selectedInterviewer.zoho_meet_uid || '60058686791',
                    startTime: `${mDate.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} ${mDate.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).trim()}`,
                    duration: 3600000,
                    timezone: "Asia/Kolkata",
                    participants: [
                        { email: candidate.email, name: candidate.full_name || candidate.name },
                        { email: selectedInterviewer.email, name: selectedInterviewer.name }
                    ],
                    interviewerId: selectedInterviewer._id || selectedInterviewer.id,
                    candidateId: candidate._id || candidate.id
                };

                const meetData = await apiFetch('/meetings/create', {
                    method: 'POST',
                    token,
                    body: JSON.stringify(meetPayload)
                });

                if (meetData.session) {
                    newMeeting.sessionId = meetData.session.meetingKey || meetData.session.sys_id || meetData.session.id;
                    newMeeting.meetingLink = meetData.session.joinLink || meetData.session.join_url;
                    newMeeting.zsoid = meetData.session.zsoid;
                }
            } catch (meetErr) {
                console.error('Error creating rescheduled meeting:', meetErr);
            }

            // 4. Update candidate record and interviewer schedule via server
            // We'll use confirm-slot endpoint which handles both
            await apiFetch(`/candidates/${candidate._id || candidate.id}/confirm-slot`, {
                method: 'POST',
                token,
                body: JSON.stringify({
                    interviewDate: selectedSlot.date,
                    interviewTime: selectedSlot.time,
                    interviewerId: selectedInterviewer._id || selectedInterviewer.id,
                    meetingLink: newMeeting.meetingLink,
                    sessionId: newMeeting.sessionId,
                    presenterId: selectedInterviewer.zoho_meet_uid || '60058686791',
                    zsoid: newMeeting.zsoid
                })
            });

            // 5. Send Rescheduling confirmation email via server
            try {
                // Fetch full candidate data to get job/client/owner details if needed
                const fullCandidate = await apiFetch(`/candidates/${candidate._id || candidate.id}`, { token });
                const c = fullCandidate.candidate;

                await apiFetch('/emails/send-interview-slot', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                        candidateEmail: c.email,
                        candidateName: c.full_name,
                        recruiterEmail: auth.currentUser?.email,
                        vendorEmail: c.vendor_id?.email,
                        jobTitle: c.job_id?.jobTitle || c.job_id?.title,
                        clientName: c.client_id?.name,
                        interviewerName: selectedInterviewer.name,
                        selectedTimeSlot: `${selectedSlot.date} at ${selectedSlot.time}`,
                        sendDirectInvitation: true,
                        link: newMeeting.meetingLink
                    })
                });
            } catch (emailErr) {
                console.error('Error sending reschedule email via server:', emailErr);
            }

            toast.success('Interview rescheduled successfully');
            onRescheduled?.();
            onClose();
        } catch (error) {
            console.error('Error rescheduling:', error);
            toast.error('Failed to reschedule: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelOnly = async () => {
        if (!window.confirm(`Are you sure you want to cancel the interview for ${candidate?.full_name} without rescheduling?`)) {
            return;
        }

        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            // 1. Cancel Zoho meeting if it exists via server
            if (candidate.sessionId && candidate.meetingLink) {
                try {
                    await apiFetch('/meetings/cancel', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                            sessionId: candidate.sessionId,
                            presenterId: candidate.presenterId
                        })
                    });
                } catch (cancelError) {
                    console.error('Error cancelling interview meeting via server:', cancelError);
                }
            }

            // 2. Clear slot in interviewer schedule if needed
            // Based on confirm-slot logic, we should probably have a cancel-slot endpoint
            // or just update candidate status.

            // 3. Update candidate record via server
            await apiFetch(`/candidates/${candidate._id || candidate.id}`, {
                method: 'PUT',
                token,
                body: JSON.stringify({
                    status: '4', // Rejected/Cancelled
                    meetingLink: null,
                    sessionId: null,
                    interviewDate: null,
                    interviewTime: null,
                    interviewerId: null,
                    zsoid: null,
                    presenterId: null
                })
            });

            // 4. Send cancellation email notification via server
            try {
                const fullCandidate = await apiFetch(`/candidates/${candidate._id || candidate.id}`, { token });
                const c = fullCandidate.candidate;

                await apiFetch('/emails/send-interview-slot', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                        type: 'cancel',
                        candidateEmail: c.email,
                        candidateName: c.full_name,
                        recruiterEmail: auth.currentUser?.email,
                        vendorEmail: c.vendor_id?.email,
                        jobTitle: c.job_id?.jobTitle || c.job_id?.title,
                        clientName: c.client_id?.name
                    })
                });
            } catch (emailErr) {
                console.error('Error sending cancellation email via server:', emailErr);
            }

            toast.success('Interview cancelled successfully');
            onRescheduled?.();
            onClose();
        } catch (error) {
            console.error('Error cancelling interview:', error);
            toast.error('Failed to cancel: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredInterviewers = interviewers.filter(i =>
        (i.name?.toLowerCase().includes(interviewerSearchTerm.toLowerCase())) ||
        (i.email?.toLowerCase().includes(interviewerSearchTerm.toLowerCase()))
    );

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                            Reschedule Interview
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                            <FiX className="h-5 w-5" />
                        </button>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Rescheduling interview for <span className="font-semibold text-gray-900 dark:text-white">{candidate?.full_name}</span>
                    </p>

                    <div className="space-y-4">
                        {/* Interviewer Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Interviewer
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiUser className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={interviewerSearchTerm}
                                    onChange={(e) => {
                                        setInterviewerSearchTerm(e.target.value);
                                        setShowInterviewerDropdown(true);
                                    }}
                                    onFocus={() => setShowInterviewerDropdown(true)}
                                    placeholder="Search interviewer..."
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                                {showInterviewerDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                        {filteredInterviewers.map(i => (
                                            <div
                                                key={i.id}
                                                onClick={() => handleInterviewerSelect(i)}
                                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                                            >
                                                {i.name || i.email}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Slot Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select New Time Slot
                            </label>
                            <div className="relative">
                                {isLoadingSlots ? (
                                    <div className="animate-pulse flex h-10 w-full bg-gray-100 dark:bg-gray-700 rounded-md"></div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2">
                                        {availableTimeSlots.length > 0 ? (
                                            availableTimeSlots.map((slot, idx) => {
                                                const isSelected = selectedSlot?.date === slot.date && selectedSlot?.time === slot.time;
                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setSelectedSlot(slot)}
                                                        className={`p-2 rounded-md cursor-pointer border text-sm transition-colors ${isSelected
                                                            ? 'bg-blue-500 border-blue-500 text-white'
                                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-blue-500'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="flex items-center gap-2">
                                                                <FiCalendar className="w-3 h-3" /> {slot.date}
                                                            </span>
                                                            <span className="flex items-center gap-2">
                                                                <FiClock className="w-3 h-3" /> {slot.time}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-4 text-xs text-gray-500">
                                                {selectedInterviewer ? 'No available slots found' : 'Select an interviewer first'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={handleCancelOnly}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                            >
                                Cancel Interview Only
                            </button>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleReschedule}
                                disabled={isSubmitting || !selectedSlot || !selectedInterviewer}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
                            >
                                {isSubmitting ? 'Processing...' : 'Reschedule'}
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default memo(RescheduleModal);
