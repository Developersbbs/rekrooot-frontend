"use client";

import React, { useState, useEffect, useCallback } from "react";
import { IoAddOutline } from "react-icons/io5"
import { FaRegUserCircle } from "react-icons/fa"
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { apiFetch, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";


type NewInterviewerProps = {
  onClose: () => void;
  onInterviewerAdded?: () => void;
  interviewer?: Interviewer;
};

// Use dynamic import with noSSR option to prevent hydration errors
const NewInterviewer = dynamic<NewInterviewerProps>(() => import('@/components/createInterviewer'), {
  loading: () => <div>Loading...</div>,
  ssr: false
})

type Interviewer = {
  _id: string;
  name: string;
  email: string;
  contact?: string;
  logo?: string;
  technologies?: { _id: string; name: string }[];
};

const InterviewerImage = ({ src, alt, className }: { src?: string; alt: string; className?: string }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError || !src) {
    return <FaRegUserCircle className={className ? `${className} text-gray-400` : "w-16 h-16 text-gray-400"} />;
  }

  return (
    <div className={className ? `relative ${className}` : "relative w-16 h-16"}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="64px"
        className={`${className ? className.replace('w-16 h-16', '').trim() : ''} rounded-full object-cover`}
        priority={false}
        onError={() => setImageError(true)}
      />
    </div>
  );
};

const InterviewersPage = () => {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [editingInterviewer, setEditingInterviewer] = useState<Interviewer | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  const fetchInterviewers = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      let token: string | null = null;
      const user = auth.currentUser;
      if (user) {
        token = await user.getIdToken();
      } else if (typeof window !== "undefined") {
        token = localStorage.getItem("auth_token");
      }

      if (!token) {
        throw new Error("You must be logged in to view interviewers.");
      }

      let url = "/interviewers";

      const res = await apiFetch<{ interviewers: Interviewer[] }>(url, {
        token,
      });

      setInterviewers(res.interviewers || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load interviewers");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    const loadInitialCompany = () => {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
      };
      const selectedCompanyCookie = getCookie('selectedCompany');
      if (selectedCompanyCookie) {
        try {
          const company = JSON.parse(decodeURIComponent(selectedCompanyCookie));
          setSelectedCompany(company);
        } catch (e) {
          console.error('Error parsing selectedCompany cookie:', e);
        }
      }
    };

    const handleCompanyChange = (e: any) => {
      setSelectedCompany(e.detail);
    };

    loadInitialCompany();
    window.addEventListener('companyChanged', handleCompanyChange);

    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange);
    };
  }, []);

  useEffect(() => {
    setIsClient(true);
    let cancelled = false;

    const performFetch = async (user: any) => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const token = await user.getIdToken();

        let url = "/interviewers";

        const res = await apiFetch<{ interviewers: Interviewer[] }>(url, {
          token,
        });

        if (!cancelled) {
          setInterviewers(res.interviewers || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to load interviewers");
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!cancelled) {
        performFetch(user);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [selectedCompany?.id]);

  const handleModalClose = () => {
    setShowModal(false)
    setEditingInterviewer(null);
  }

  const handleEdit = (interviewer: Interviewer) => {
    setEditingInterviewer(interviewer);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this interviewer?")) return;

    setError(null);
    setIsLoading(true);

    try {
      let token: string | null = null;

      const user = auth.currentUser;
      if (user) {
        token = await user.getIdToken();
      } else if (typeof window !== "undefined") {
        token = localStorage.getItem("auth_token");
      }

      if (!token) {
        throw new Error("You must be logged in to delete interviewers.");
      }

      await apiFetch<{ message: string }>(`/interviewers/${id}`, {
        method: "DELETE",
        token,
      });

      await fetchInterviewers();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete interviewer");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 relative">
      {/* Header Section */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary-500 dark:text-primary-400">
            Interviewers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your interviewer roster
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          <IoAddOutline className="w-5 h-5" />
          <span>Add Interviewer</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Grid Layout for Interviewers */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
        </div>
      ) : interviewers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <p className="text-xl font-medium">No interviewers found</p>
          <p className="mt-2">Click the "Add Interviewer" button to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {interviewers.map((interviewer) => (
            <div
              key={interviewer._id}
              className="group bg-white/95 dark:bg-gray-900/70 backdrop-blur-lg rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 p-5 border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-700/70 relative overflow-hidden"
            >
              {/* Hover gradient overlay behind content */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/20 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />

              <div className="relative z-10 flex flex-col gap-4">
                {/* Header: avatar + primary info */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <InterviewerImage
                      src={interviewer.logo}
                      alt={interviewer.name}
                      className="w-16 h-16 rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">
                      {interviewer.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="truncate">{interviewer.email}</span>
                    </p>
                    {interviewer.contact && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">
                        {interviewer.contact}
                      </p>
                    )}
                  </div>
                </div>

                {/* Technologies */}
                {interviewer.technologies && interviewer.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {interviewer.technologies.map((tech) => (
                      <span
                        key={typeof tech === 'string' ? tech : tech._id}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/60 shadow-sm"
                      >
                        {typeof tech === 'string' ? tech : tech.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 mt-1">
                  <Link
                    href={`/admin/interviewers/${interviewer._id}`}
                    className="inline-flex items-center gap-2 text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                  >
                    <span>View profile</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(interviewer)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Edit interviewer"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(interviewer._id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                      title="Delete interviewer"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && isClient && (
        <div className="fixed inset-0 flex justify-center items-center bg-black/50 z-50">
          <NewInterviewer
            onClose={handleModalClose}
            onInterviewerAdded={fetchInterviewers}
            interviewer={editingInterviewer ?? undefined}
          />
        </div>
      )}
    </div>
  )
}

export default InterviewersPage