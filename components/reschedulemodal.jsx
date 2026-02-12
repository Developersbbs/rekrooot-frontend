'use client';

import React, { useState, useEffect, memo } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiCalendar, FiUser, FiClock } from 'react-icons/fi';
import { toast, Toaster } from 'react-hot-toast';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

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
            const interviewersSnap = await getDocs(collection(db, 'Interviewers'));
            const interviewersData = interviewersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInterviewers(interviewersData);

            if (candidate?.interviewerId) {
                const current = interviewersData.find(i => i.id === candidate.interviewerId);
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
            const response = await fetch('/api/gettimeslots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ interviewerId })
            });
            const data = await response.json();

            if (data.success) {
                setAvailableTimeSlots(data.timeSlots || []);
            } else {
                console.error('Failed to fetch slots:', data.message);
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
            // 1. Cancel previous Zoho meeting if it exists
            if (candidate.sessionId && candidate.meetingLink) {
                try {
                    const tokenResp = await fetch('/api/refreshtoken', { method: 'POST' });
                    const { accessToken } = await tokenResp.json();

                    if (accessToken) {
                        await fetch('/api/cancelmeet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                authToken: accessToken,
                                sessionId: candidate.sessionId,
                                presenterId: candidate.presenterId,
                                zsoid: candidate.zsoid
                            })
                        });
                    }
                } catch (cancelError) {
                    console.error('Error cancelling previous meeting:', cancelError);
                }
            }

            // 2. Clear old slot in interviewer schedule
            if (candidate.interviewerId) {
                const oldInterviewerRef = doc(db, 'Interviewers', candidate.interviewerId);
                const oldInterviewerSnap = await getDoc(oldInterviewerRef);
                if (oldInterviewerSnap.exists()) {
                    const slots = oldInterviewerSnap.data().availabilitySlots || {};
                    let updateKey = null;
                    for (const d in slots) {
                        for (const t in slots[d]) {
                            if (slots[d][t] === candidate.id) {
                                updateKey = `availabilitySlots.${d}.${t}`;
                                break;
                            }
                        }
                        if (updateKey) break;
                    }
                    if (updateKey) {
                        await updateDoc(oldInterviewerRef, { [updateKey]: 'available' });
                    }
                }
            }

            // 3. Create new Zoho meeting
            const tokenResp = await fetch('/api/refreshtoken', { method: 'POST' });
            const { accessToken } = await tokenResp.json();

            let newMeeting = { sessionId: null, meetingLink: null, zsoid: null };
            if (accessToken) {
                // Combine date and time using time24 format (HH:mm)
                const [hours, minutes] = selectedSlot.time24.split(':');
                const mDate = new Date(selectedSlot.date);
                mDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                const meetPayload = {
                    authToken: accessToken,
                    topic: `Rescheduled Interview: ${candidate.full_name}`,
                    agenda: `Technical Interview (Rescheduled)`,
                    presenter: selectedInterviewer.zohoMeetId || '60058686791',
                    startTime: `${mDate.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} ${mDate.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).trim()}`,
                    duration: 3600000,
                    timezone: "Asia/Kolkata",
                    participants: [{ email: candidate.email, name: candidate.full_name }, { email: selectedInterviewer.email, name: selectedInterviewer.name }]
                };

                const meetResp = await fetch('/api/createmeet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(meetPayload)
                });
                const meetData = await meetResp.json();

                if (meetData.session) {
                    newMeeting.sessionId = meetData.session.meetingKey || meetData.session.sys_id;
                    newMeeting.meetingLink = meetData.session.joinLink || meetData.session.join_url;
                    newMeeting.zsoid = meetData.session.meeting?.zsoid || meetData.session.zsoid;
                }
            }

            // 4. Book new slot in interviewer schedule
            const newInterviewerRef = doc(db, 'Interviewers', selectedInterviewer.id);
            await updateDoc(newInterviewerRef, {
                [`availabilitySlots.${selectedSlot.date}.${selectedSlot.time24}`]: candidate.id
            });

            // 5. Update candidate record
            const candidateRef = doc(db, 'candidates', candidate.id);
            await updateDoc(candidateRef, {
                status: '2',
                interviewerId: selectedInterviewer.id,
                interviewDate: selectedSlot.date,
                interviewTime: selectedSlot.time,
                sessionId: newMeeting.sessionId,
                meetingLink: newMeeting.meetingLink,
                zsoid: newMeeting.zsoid,
                presenterId: selectedInterviewer.zohoMeetId || '60058686791'
            });

            // 6. Send Rescheduling confirmation email
            try {
                const fetchPromises = [
                    getDoc(doc(db, 'jobs', candidate.jobId)),
                    getDoc(doc(db, 'Clients', candidate.clientId)),
                    getDoc(doc(db, 'Users', candidate.createdBy))
                ];
                if (candidate.vendorId) fetchPromises.push(getDoc(doc(db, 'Vendor', candidate.vendorId)));

                const results = await Promise.all(fetchPromises);
                const jobData = results[0]?.data();
                const clientData = results[1]?.data();
                const recruiterData = results[2]?.data();
                const vendorData = results[3]?.data();

                if (jobData && clientData) {
                    await fetch('/api/sendslot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            candidateEmail: candidate.email,
                            candidateName: candidate.full_name,
                            recruiterEmail: recruiterData?.email,
                            vendorEmail: vendorData?.email,
                            jobTitle: jobData.jobTitle,
                            clientName: clientData.name,
                            interviewerName: selectedInterviewer.name,
                            selectedTimeSlot: `${selectedSlot.date} at ${selectedSlot.time}`,
                            sendDirectInvitation: true,
                            link: newMeeting.meetingLink
                        })
                    });
                }
            } catch (emailErr) {
                console.error('Error sending reschedule email:', emailErr);
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
            // 1. Cancel Zoho meeting if it exists
            if (candidate.sessionId && candidate.meetingLink) {
                const tokenResp = await fetch('/api/refreshtoken', { method: 'POST' });
                const { accessToken } = await tokenResp.json();

                if (accessToken) {
                    await fetch('/api/cancelmeet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            authToken: accessToken,
                            sessionId: candidate.sessionId,
                            presenterId: candidate.presenterId,
                            zsoid: candidate.zsoid
                        })
                    });
                }
            }

            // 2. Clear slot in interviewer schedule
            if (candidate.interviewerId) {
                const interviewerRef = doc(db, 'Interviewers', candidate.interviewerId);
                const interviewerSnap = await getDoc(interviewerRef);
                if (interviewerSnap.exists()) {
                    const slots = interviewerSnap.data().availabilitySlots || {};
                    let updateKey = null;
                    for (const d in slots) {
                        for (const t in slots[d]) {
                            if (slots[d][t] === candidate.id) {
                                updateKey = `availabilitySlots.${d}.${t}`;
                                break;
                            }
                        }
                        if (updateKey) break;
                    }
                    if (updateKey) {
                        await updateDoc(interviewerRef, { [updateKey]: 'available' });
                    }
                }
            }

            // 3. Update candidate record
            const candidateRef = doc(db, 'candidates', candidate.id);
            await updateDoc(candidateRef, {
                status: '4',
                meetingLink: null,
                sessionId: null,
                interviewDate: null,
                interviewTime: null,
                interviewerId: null,
                zsoid: null,
                presenterId: null
            });

            // 4. Send cancellation email notification
            try {
                const fetchPromises = [
                    getDoc(doc(db, 'jobs', candidate.jobId)),
                    getDoc(doc(db, 'Clients', candidate.clientId)),
                    getDoc(doc(db, 'Users', candidate.createdBy))
                ];
                if (candidate.vendorId) fetchPromises.push(getDoc(doc(db, 'Vendor', candidate.vendorId)));

                const results = await Promise.all(fetchPromises);
                const jobData = results[0]?.data();
                const clientData = results[1]?.data();
                const recruiterData = results[2]?.data();
                const vendorData = results[3]?.data();

                if (jobData && clientData) {
                    await fetch('/api/sendslot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'cancel',
                            candidateEmail: candidate.email,
                            candidateName: candidate.full_name,
                            recruiterEmail: recruiterData?.email,
                            vendorEmail: vendorData?.email,
                            jobTitle: jobData.jobTitle,
                            clientName: clientData.name
                        })
                    });
                }
            } catch (emailErr) {
                console.error('Error sending cancellation email:', emailErr);
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
