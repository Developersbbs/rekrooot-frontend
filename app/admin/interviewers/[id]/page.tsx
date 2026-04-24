"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { FaRegUserCircle } from "react-icons/fa"
import Image from 'next/image'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import '@/styles/calendar-styles.css'
import { IoCloudUploadOutline } from "react-icons/io5"
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { FiEdit3 } from 'react-icons/fi'
import { MdClose } from 'react-icons/md'
import { useParams } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { auth } from '@/lib/firebase'

// Optimize constant values
const INITIAL_FORM_STATE = {
  name: '',
  email: '',
  contact: '',
  zohoMeetId: '',
  technologies: [],
  photoURL: ''
}

// Memoize status colors
const STATUS_COLORS = {
  available: {
    selected: 'bg-green-500 text-white',
    default: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/50'
  },
  unavailable: {
    selected: 'bg-red-500 text-white',
    default: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-800/50'
  },
  scheduled: {
    selected: 'bg-blue-500 text-white cursor-not-allowed',
    default: 'bg-blue-100 text-blue-700 cursor-not-allowed dark:bg-blue-900/30 dark:text-blue-300'
  }
}

// Common input class
const INPUT_CLASS = `w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 
  dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all
  text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`

// Common button class
const BUTTON_CLASS = `px-4 py-2 rounded-lg font-medium transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed`

type InterviewerProfile = {
  name: string;
  email: string;
  contact: string;
  zohoMeetId: string;
  technologies: string[];
  photoURL: string;
};

export type TimeInterval = {
  start: string; // ISO string
  end: string; // ISO string
  status?: number; // 1 = available, 2 = scheduled
  candidateName?: string;
};

type ScheduledInterview = {
  id: string;
  candidateId: string;
  candidate: {
    name: string;
    email: string;
    phone?: string;
  };
  dateTime: Date;
  timeSlot: string;
  status: string;
};

const EditModal = ({ isOpen, onClose, initialData, onSave, isSaving, imagePreview, onImageChange }: {
  isOpen: boolean;
  onClose: () => void;
  initialData: InterviewerProfile;
  onSave: (data: InterviewerProfile) => void;
  isSaving: boolean;
  imagePreview: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const [localFormData, setLocalFormData] = useState<InterviewerProfile>(initialData)

  useEffect(() => {
    setLocalFormData(initialData)
  }, [initialData])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setLocalFormData((prev: InterviewerProfile) => ({
      ...prev,
      [name]: value
    }))
  }, [])

  const handleSubmit = useCallback(() => {
    onSave(localFormData)
  }, [localFormData, onSave])

  // Memoize the form content
  const formContent = useMemo(() => (
    <div className="space-y-6">
      {/* Image Upload */}
      <div className="flex justify-center">
        <div className="relative group w-40 h-40">
          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="hidden"
            id="profile-upload"
          />
          <label htmlFor="profile-upload" className="cursor-pointer block w-full h-full">
            {imagePreview ? (
              <div className="relative w-40 h-40 rounded-2xl overflow-hidden group">
                <Image
                  src={imagePreview}
                  alt="Profile preview"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <IoCloudUploadOutline className="w-10 h-10 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-primary-500 transition-colors">
                <IoCloudUploadOutline className="w-10 h-10 text-gray-400 group-hover:text-primary-500 transition-colors" />
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {Object.entries(localFormData).map(([key, value]) => {
          if (key === 'technologies' || key === 'photoURL') return null
          return (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input
                type={key === 'email' ? 'email' : 'text'}
                name={key}
                value={value as any}
                onChange={handleInputChange}
                className={INPUT_CLASS}
                placeholder={`Enter ${key.toLowerCase()}`}
              />
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4">
        <button
          onClick={onClose}
          className={`${BUTTON_CLASS} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className={`${BUTTON_CLASS} bg-primary-500 text-white hover:bg-primary-600 flex items-center gap-2`}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  ), [localFormData, handleInputChange, handleSubmit, imagePreview, onImageChange, onClose, isSaving])

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} static>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 bg-clip-text text-transparent mb-6 flex justify-between items-center"
                >
                  Edit Profile
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <MdClose className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </Dialog.Title>
                {formContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

// Update the CustomCalendar component
const CustomCalendar = ({ value, onChange, availabilityIntervals, className }: any) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className="w-full h-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  }

  return (
    <Calendar
      onChange={onChange}
      value={value}
      minDate={new Date()} // Prevent selecting past dates
      className={className || "w-full h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"}
      tileClassName={({ date }) => {
        const dateStr = date.toDateString();
        const isActive = value && date.toDateString() === value.toDateString();
        const hasSlots = availabilityIntervals && availabilityIntervals[dateStr] && availabilityIntervals[dateStr].some((i: TimeInterval) => i.status === 1 || i.status === undefined);

        return `
          relative w-full h-full p-4 text-center
          rounded-lg transition-all duration-200
          ${isActive
            ? '!bg-primary-500 !text-white shadow-lg scale-105 z-10'
            : 'hover:bg-primary-50 dark:hover:bg-primary-900/20'}
          ${hasSlots && !isActive
            ? 'font-bold text-primary-600 dark:text-primary-300 ring-2 ring-primary-500/30'
            : !isActive ? 'text-gray-600 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white' : ''}
        `;
      }}
      navigationLabel={({ date }) => (
        <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      )}
      prevLabel={
        <div className="p-3 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      }
      nextLabel={
        <div className="p-3 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      }
      formatShortWeekday={(locale, date) => {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      }}
      calendarType="iso8601"
      showFixedNumberOfWeeks={true}
    />
  );
};


// Helper function to format time to AM/PM
const formatTime = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
};

// Update SlotStatus constants
const SlotStatus = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  SCHEDULED: 'scheduled'
};

// Update STATUS_STYLES to match the SlotStatus values
const STATUS_STYLES = {
  [SlotStatus.AVAILABLE]: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    hover: 'hover:bg-emerald-200 dark:hover:bg-emerald-800/50',
    border: 'border-emerald-200 dark:border-emerald-800'
  },
  [SlotStatus.UNAVAILABLE]: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    hover: 'hover:bg-red-200 dark:hover:bg-red-800/50',
    border: 'border-red-200 dark:border-red-800'
  },
  [SlotStatus.SCHEDULED]: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    extra: 'cursor-not-allowed opacity-80'
  }
};

const TimeSlotSection = ({ 
  selectedDate, 
  availabilityIntervals, 
  onIntervalsChange 
}: { 
  selectedDate: Date; 
  availabilityIntervals: Record<string, TimeInterval[]>; 
  onIntervalsChange: (dateStr: string, newIntervals: TimeInterval[]) => void 
}) => {
  const [slotDuration, setSlotDuration] = useState<number>(60);
  
  const dateStr = selectedDate.toDateString();
  const intervals = availabilityIntervals[dateStr] || [];

  const addInterval = (intervals: TimeInterval[], startObj: Date, endObj: Date): TimeInterval[] => {
    let newIntervals = [...intervals, { start: startObj.toISOString(), end: endObj.toISOString(), status: 1 }];
    newIntervals.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    const merged: TimeInterval[] = [];
    for (const current of newIntervals) {
      if (merged.length === 0) {
        merged.push(current);
        continue;
      }
      const previous = merged[merged.length - 1];
      
      if ((previous.status === 1 || !previous.status) && (current.status === 1 || !current.status)) {
        const prevEnd = new Date(previous.end).getTime();
        const currStart = new Date(current.start).getTime();
        const currEnd = new Date(current.end).getTime();
        
        if (currStart <= prevEnd) {
          previous.end = new Date(Math.max(prevEnd, currEnd)).toISOString();
        } else {
          merged.push(current);
        }
      } else {
        merged.push(current);
      }
    }
    return merged;
  };

  const removeInterval = (intervals: TimeInterval[], startObj: Date, endObj: Date): TimeInterval[] => {
    const result: TimeInterval[] = [];
    const removeStart = startObj.getTime();
    const removeEnd = endObj.getTime();
    
    for (const inv of intervals) {
      if (inv.status === 2) {
        result.push(inv);
        continue;
      }
      
      const invStart = new Date(inv.start).getTime();
      const invEnd = new Date(inv.end).getTime();
      
      if (removeEnd <= invStart || removeStart >= invEnd) {
        result.push(inv);
      } else {
        if (invStart < removeStart) {
          result.push({ ...inv, end: new Date(removeStart).toISOString() });
        }
        if (invEnd > removeEnd) {
          result.push({ ...inv, start: new Date(removeEnd).toISOString() });
        }
      }
    }
    return result;
  };

  const handleSlotClick = (hour: number, minute: number) => {
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hour, minute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotStart.getMinutes() + slotDuration);

    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotEnd.getTime();

    // Determine current status
    let isScheduled = false;
    let isAvailable = false;

    for (const inv of intervals) {
      const invStart = new Date(inv.start).getTime();
      const invEnd = new Date(inv.end).getTime();
      
      // If the slot is partially or fully inside the interval
      if (slotStartMs < invEnd && slotEndMs > invStart) {
        if (inv.status === 2) {
          isScheduled = true;
          break;
        }
        // We consider it available if the interval completely covers it or covers its start
        if (invStart <= slotStartMs && invEnd >= slotEndMs) {
          isAvailable = true;
        }
      }
    }

    if (isScheduled) return;

    let newIntervals;
    if (isAvailable) {
      newIntervals = removeInterval(intervals, slotStart, slotEnd);
    } else {
      newIntervals = addInterval(intervals, slotStart, slotEnd);
    }
    
    onIntervalsChange(dateStr, newIntervals);
  };

  const renderSlotButton = (hour: number, minute: number) => {
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hour, minute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotStart.getMinutes() + slotDuration);

    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotEnd.getTime();

    let status = SlotStatus.UNAVAILABLE;
    let candidateName = "";

    for (const inv of intervals) {
      const invStart = new Date(inv.start).getTime();
      const invEnd = new Date(inv.end).getTime();
      
      if (slotStartMs < invEnd && slotEndMs > invStart) {
        if (inv.status === 2) {
          status = SlotStatus.SCHEDULED;
          candidateName = inv.candidateName || "";
          break;
        }
        if (invStart <= slotStartMs && invEnd >= slotEndMs) {
          status = SlotStatus.AVAILABLE;
        }
      }
    }

    const styles = STATUS_STYLES[status] || STATUS_STYLES[SlotStatus.UNAVAILABLE];
    const isScheduled = status === SlotStatus.SCHEDULED;

    const now = new Date();
    const isCurrentDay = selectedDate.toDateString() === now.toDateString();
    const isPast = isCurrentDay && slotStart < now;

    const formatTimeOnly = (date: Date) => {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
      <button
        key={`${hour}:${minute}`}
        onClick={() => handleSlotClick(hour, minute)}
        disabled={isScheduled || isPast}
        className={`
          relative p-2 rounded-lg border transition-all duration-200 text-xs font-medium
          ${styles.bg} ${styles.text} ${styles.border} 
          ${styles.hover || ''} ${styles.extra || ''}
          ${isScheduled ? 'cursor-default' : 'hover:scale-105 active:scale-95'}
          ${isPast ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}
          group flex flex-col items-center justify-center
        `}
      >
        <span>
          {slotDuration === 60 ? formatTimeOnly(slotStart) : `${slotStart.getMinutes().toString().padStart(2, '0')}`}
        </span>
        
        {isScheduled && candidateName && (
          <div className="absolute invisible group-hover:visible w-32 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg -top-12 left-1/2 -translate-x-1/2 z-20 border border-gray-200 dark:border-gray-700 text-[10px]">
            <p className="font-bold text-gray-800 dark:text-gray-200">Scheduled</p>
            <p className="truncate text-blue-500">{candidateName}</p>
          </div>
        )}
      </button>
    );
  };

  const renderHourBlock = (hour: number) => {
    const subdivisions = 60 / slotDuration;
    const hourLabel = new Date();
    hourLabel.setHours(hour, 0, 0, 0);
    const displayHour = hourLabel.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

    return (
      <div key={hour} className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
          {displayHour}
        </div>
        <div className={`grid gap-2 ${subdivisions === 1 ? 'grid-cols-1' : subdivisions === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {Array.from({ length: subdivisions }).map((_, i) => renderSlotButton(hour, i * slotDuration))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="dark:text-white">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="dark:text-white">Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="dark:text-white">Scheduled</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Slot Duration:</label>
          <select 
            value={slotDuration} 
            onChange={e => setSlotDuration(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm cursor-pointer"
          >
            <option value={60}>1 Hour (60 mins)</option>
            <option value={30}>Half Hour (30 mins)</option>
            <option value={15}>Quarter Hour (15 mins)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Morning Slots */}
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">☀️</span>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Morning (12 AM - 11 AM)</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => renderHourBlock(i))}
          </div>
        </div>

        {/* Afternoon/Evening Slots */}
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-4 border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌆</span>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Afternoon & Evening (12 PM - 11 PM)</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => renderHourBlock(i + 12))}
          </div>
        </div>
      </div>
    </div>
  );
};

const InterviewerProfilePage = () => {
  const params = useParams();
  const interviewerId = (params as { id?: string }).id;

  const [interviewer, setInterviewer] = useState<InterviewerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [interviewerError, setInterviewerError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [availabilityIntervals, setAvailabilityIntervals] = useState<Record<string, TimeInterval[]>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState<InterviewerProfile>({
    name: '',
    email: '',
    contact: '',
    zohoMeetId: '',
    technologies: [],
    photoURL: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Add this for time-sensitive content
  const [mounted, setMounted] = useState(false)

  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);
  const [selectedInterviewDate, setSelectedInterviewDate] = useState<Date | null>(new Date());

  // Declare selectedTime state (not used but kept for potential UI extensions)
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load interviewer details from backend
  useEffect(() => {
    const loadInterviewer = async () => {
      if (!interviewerId) {
        setIsLoading(false);
        setInterviewerError('Missing interviewer id in route');
        return;
      }

      try {
        setInterviewerError(null);
        setIsLoading(true);

        let token: string | null = null;
        const user = auth.currentUser;
        if (user) {
          token = await user.getIdToken();
        }

        if (!token) {
          setInterviewerError('You must be logged in to view interviewer details.');
          setIsLoading(false);
          return;
        }

        const res = await apiFetch<{
          interviewer: {
            name: string;
            email: string;
            contact?: string;
            logo?: string;
            zoho_meet_uid?: string;
            technologies?: { _id: string; name: string }[] | string[];
          };
        }>(`/interviewers/${interviewerId}`, { token });

        const backend = res.interviewer;

        const technologies: string[] = Array.isArray(backend.technologies)
          ? (backend.technologies as any[]).map((t) =>
            typeof t === 'string' ? t : t.name
          )
          : [];

        const mapped: InterviewerProfile = {
          name: backend.name,
          email: backend.email,
          contact: backend.contact || '',
          zohoMeetId: backend.zoho_meet_uid || '',
          technologies,
          photoURL: backend.logo || '',
        };

        setInterviewer(mapped);
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setInterviewerError(err.message);
        } else if (err instanceof Error) {
          setInterviewerError(err.message);
        } else {
          setInterviewerError('Failed to load interviewer');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (auth.currentUser) {
      void loadInterviewer();
    } else {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) void loadInterviewer();
      });
      return () => unsubscribe();
    }
  }, [interviewerId]);

  // Load scheduled interviews from backend
  useEffect(() => {
    const loadInterviews = async () => {
      if (!interviewerId) return;

      try {
        setIsLoadingInterviews(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const res = await apiFetch<{ interviews: any[] }>(`/interviewers/${interviewerId}/interviews`, { token });

        const mapped = res.interviews.map(i => ({
          id: i._id,
          candidateId: i._id, // placeholder
          candidate: {
            name: i.candidate_name,
            email: i.candidate_email,
            phone: i.candidate_phone
          },
          dateTime: new Date(i.date_time),
          timeSlot: new Date(i.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          status: i.status
        }));

        setScheduledInterviews(mapped);
      } catch (err) {
        console.error("Failed to load interviews:", err);
      } finally {
        setIsLoadingInterviews(false);
      }
    };

    if (auth.currentUser) {
      void loadInterviews();
    } else {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) void loadInterviews();
      });
      return () => unsubscribe();
    }
  }, [interviewerId]);

  // Load availability for the selected date from backend when possible
  useEffect(() => {
    const loadAvailability = async () => {
      if (!interviewerId) return;

      // derive day range in local time, then send as UTC ISO strings
      const dayStartLocal = new Date(selectedDate);
      dayStartLocal.setHours(0, 0, 0, 0);
      const dayEndLocal = new Date(dayStartLocal);
      dayEndLocal.setDate(dayEndLocal.getDate() + 1);

      const from = dayStartLocal.toISOString();
      const to = dayEndLocal.toISOString();

      try {
        setAvailabilityError(null);

        let token: string | null = null;
        const user = auth.currentUser;
        if (user) {
          token = await user.getIdToken();
        }

        if (!token) {
          // If no token, keep UI in mock mode without failing hard
          return;
        }

        const res = await apiFetch<{ availability: { start_time: string; end_time: string; status?: number; candidate_id?: any }[] }>(
          `/interviewers/${interviewerId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { token }
        );

        const dateKey = selectedDate.toDateString();
        
        const intervalsForDate = (res.availability || []).map(item => ({
          start: item.start_time,
          end: item.end_time,
          status: item.status || 1,
          candidateName: item.candidate_id?.full_name
        }));

        setAvailabilityIntervals((prev) => ({
          ...prev,
          [dateKey]: intervalsForDate,
        }));
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setAvailabilityError(err.message);
        } else if (err instanceof Error) {
          setAvailabilityError(err.message);
        } else {
          setAvailabilityError('Failed to load availability');
        }
      }
    };

    if (auth.currentUser) {
      void loadAvailability();
    } else {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) void loadAvailability();
      });
      return () => unsubscribe();
    }
  }, [interviewerId, selectedDate]);

  useEffect(() => {
    if (interviewer && !editFormData.name) {
      setEditFormData({
        name: interviewer.name || '',
        email: interviewer.email || '',
        contact: interviewer.contact || '',
        zohoMeetId: interviewer.zohoMeetId || '',
        technologies: interviewer.technologies || [],
        photoURL: interviewer.photoURL || ''
      })
      if (interviewer.photoURL) {
        setImagePreview(interviewer.photoURL)
      }
    }
  }, [interviewer])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0])
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(e.target.files[0])
    }
  }

  // Handle edit save locally (UI-only)
  const handleSaveEdit = useCallback(async (formData: InterviewerProfile) => {
    setIsSaving(true);
    try {
      const photoURL = imagePreview || formData.photoURL || interviewer?.photoURL || '';

      // Update local state only
      setInterviewer(prev => ({ ...prev, ...formData, photoURL }));
      setIsEditing(false);
      setImageFile(null);
    } finally {
      setIsSaving(false);
    }
  }, [imagePreview, interviewer]);

  // Save availability to backend when possible (falls back to local-only behavior on error)
  const saveAvailability = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (interviewerId) {
        const dateKey = selectedDate.toDateString();
        const intervals = availabilityIntervals[dateKey] || [];

        const payloadIntervals = intervals
          .filter(i => !i.status || i.status === 1)
          .map(i => ({
            start_time: i.start,
            end_time: i.end
          }));

        if (payloadIntervals.length === 0) {
          const dummyStart = new Date(selectedDate);
          dummyStart.setHours(23, 59, 59, 998);
          const dummyEnd = new Date(selectedDate);
          dummyEnd.setHours(23, 59, 59, 999);
          payloadIntervals.push({
            start_time: dummyStart.toISOString(),
            end_time: dummyEnd.toISOString()
          });
        }

        try {
          let token: string | null = null;
          const user = auth.currentUser;
          if (user) {
            token = await user.getIdToken();
          } else if (typeof window !== 'undefined') {
            token = localStorage.getItem('auth_token');
          }

          if (token) {
            await apiFetch(`/interviewers/${interviewerId}/availability`, {
              method: 'PUT',
              token,
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ intervals: payloadIntervals }),
            });
          }
        } catch (err: unknown) {
          if (err instanceof ApiError) {
            setSaveError(err.message);
          } else if (err instanceof Error) {
            setSaveError(err.message);
          } else {
            setSaveError('Failed to save availability.');
          }
        }
      }

      // Always keep local UX responsive
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      if (!saveError) {
        setSaveError('Failed to save availability.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleIntervalsChange = useCallback((dateStr: string, newIntervals: TimeInterval[]) => {
    setAvailabilityIntervals(prev => ({
      ...prev,
      [dateStr]: newIntervals
    }));
  }, []);

  // Render the profile header with enhanced styling
  const renderProfileHeader = () => (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl transition-all border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
        {/* Profile Image */}
        <div className="relative group">
          {interviewer?.photoURL ? (
            <div className="relative w-40 h-40 overflow-hidden">
              <Image
                src={interviewer.photoURL}
                alt={interviewer.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
              <FaRegUserCircle className="w-24 h-24 text-primary-500 dark:text-primary-300" />
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="text-center md:text-left space-y-4 flex-1">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 bg-clip-text">
            {interviewer?.name}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">{interviewer?.email}</p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {interviewer?.technologies?.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 text-sm font-medium rounded-full bg-primary-100/80 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 transition-all hover:scale-105 hover:shadow-md cursor-default border border-primary-200 dark:border-primary-700"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-4 right-4 p-3 
            bg-white/90 dark:bg-gray-700/90 
            text-primary-500 dark:text-primary-300
            rounded-full 
            hover:bg-primary-50 dark:hover:bg-gray-600 
            transition-all duration-300 
            group 
            shadow-lg hover:shadow-xl
            ring-1 ring-gray-200 dark:ring-gray-600"
        >
          <FiEdit3 className="w-5 h-5 
            group-hover:scale-110 
            transition-transform 
            group-hover:text-primary-600 dark:group-hover:text-primary-200"
          />
        </button>
      </div>
    </div>
  );

  const handleModalClose = () => {
    setIsEditing(false)
    // Reset form data to current interviewer data
    if (interviewer) {
      setEditFormData({
        name: interviewer.name || '',
        email: interviewer.email || '',
        contact: interviewer.contact || '',
        zohoMeetId: interviewer.zohoMeetId || '',
        technologies: interviewer.technologies || [],
        photoURL: interviewer.photoURL || ''
      })
      setImagePreview(interviewer.photoURL)
      setImageFile(null)
    }
  }

  // Update the filtered interviews computation
  const filteredInterviews = useMemo(() => {
    if (!selectedInterviewDate) {
      // If no date selected, show all future interviews
      const now = new Date();
      return scheduledInterviews.filter(interview => interview.dateTime >= now);
    }

    return scheduledInterviews.filter(interview =>
      interview.dateTime.toDateString() === selectedInterviewDate.toDateString()
    );
  }, [scheduledInterviews, selectedInterviewDate]);

  // Sync scheduled interviews date with calendar selection
  useEffect(() => {
    setSelectedInterviewDate(selectedDate);
  }, [selectedDate]);

  // Update the interview list rendering
  const renderScheduledInterviews = () => (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 bg-clip-text text-white">
            Scheduled Interviews
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredInterviews.length} {selectedInterviewDate ? 'interviews on selected date' : 'upcoming interviews'}
          </p>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedInterviewDate ? `${selectedInterviewDate.getFullYear()}-${(selectedInterviewDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedInterviewDate.getDate().toString().padStart(2, '0')}` : ''}
            onChange={(e) => setSelectedInterviewDate(e.target.value ? new Date(e.target.value) : null)}
            className={`${INPUT_CLASS} !w-auto`}
          />
          {selectedInterviewDate && (
            <button
              onClick={() => setSelectedInterviewDate(null)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MdClose className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {isLoadingInterviews ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading interviews...</p>
        </div>
      ) : filteredInterviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            {selectedInterviewDate
              ? 'No interviews scheduled for selected date'
              : 'No upcoming interviews'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInterviews.map((interview) => (
            <div
              key={interview.id}
              className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <span className="text-xl font-medium text-primary-600 dark:text-primary-300">
                      {interview.candidate?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {interview.candidate?.name || 'Unknown Candidate'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {interview.candidate?.email}
                    </p>
                    {interview.candidate?.phone && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {interview.candidate.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {interview.dateTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {interview.dateTime.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Optimize render method with proper loading and error states
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-surface-light to-primary-50 dark:from-surface-dark dark:to-gray-900">
        <div className="relative w-32 h-32">
          <div className="absolute border-8 border-primary-200 border-t-primary-500 rounded-full w-32 h-32 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full shadow-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (interviewerError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-surface-light to-primary-50 dark:from-surface-dark dark:to-gray-900">
        <div className="text-center space-y-4">
          <p className="text-xl text-red-600 dark:text-red-400">{interviewerError}</p>
        </div>
      </div>
    );
  }

  if (!interviewer) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-surface-light to-primary-50 dark:from-surface-dark dark:to-gray-900">
        <div className="text-center space-y-4">
          <FaRegUserCircle className="w-24 h-24 mx-auto text-gray-400 dark:text-gray-600" />
          <p className="text-xl text-gray-600 dark:text-gray-400">Interviewer not found</p>
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50 dark:from-gray-900 dark:to-primary-900/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Profile Section */}
        {renderProfileHeader()}

        {/* Edit Modal */}
        <EditModal
          isOpen={isEditing}
          onClose={handleModalClose}
          initialData={editFormData}
          onSave={handleSaveEdit}
          isSaving={isSaving}
          imagePreview={imagePreview || ''}
          onImageChange={handleImageChange}
        />

        {/* Calendar and Timeslots Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar Card */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 bg-clip-text dark:text-white text-black">
                Select Date
              </h2>
            </div>
            <div className="p-6">
              <CustomCalendar
                value={selectedDate}
                onChange={setSelectedDate}
                availabilityIntervals={availabilityIntervals}
                className="w-full max-w-full"
              />
            </div>
          </div>

          {/* Timeslots Card */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 bg-clip-text dark:text-white text-black">
                Available Time Slots
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <TimeSlotSection
              selectedDate={selectedDate}
              availabilityIntervals={availabilityIntervals}
              onIntervalsChange={handleIntervalsChange}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveAvailability}
            disabled={isSaving}
            className="group relative px-8 py-4 rounded-xl font-semibold text-white
              bg-gradient-to-r from-primary-600 to-primary-500
              hover:from-primary-500 hover:to-primary-400
              disabled:from-gray-400 disabled:to-gray-300
              transition-all duration-300
              shadow-lg hover:shadow-xl
              disabled:cursor-not-allowed
              flex items-center gap-3"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <span>Save Availability</span>
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Scheduled Interviews Section */}
        {renderScheduledInterviews()}
      </div>
    </div>
  );
};

// Add custom styles for scrollbar
const customStyles = `
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(155, 155, 155, 0.5);
    border-radius: 20px;
    border: transparent;
  }
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = customStyles;
  document.head.appendChild(styleSheet);
}

export default InterviewerProfilePage