"use client";

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";

type CreateInterviewerProps = {
  onClose: () => void;
  onInterviewerAdded?: () => void;
  interviewer?: {
    _id: string;
    name: string;
    email: string;
    contact?: string;
    zoho_meet_uid?: string;
    skills?: string[];
    logo?: string;
  };
};

type Technology = {
  _id: string;
  name: string;
};

export default function CreateInterviewer({ onClose, onInterviewerAdded, interviewer }: CreateInterviewerProps) {
  const [name, setName] = useState(interviewer?.name ?? '');
  const [email, setEmail] = useState(interviewer?.email ?? '');
  const [phone, setPhone] = useState(interviewer?.contact ?? '');
  const [zohoUid, setZohoUid] = useState(interviewer?.zoho_meet_uid ?? '');
  const [profileFileName, setProfileFileName] = useState<string | null>(null);
  const [techSearch, setTechSearch] = useState('');
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [selectedTechNames, setSelectedTechNames] = useState<string[]>(interviewer?.skills ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load technologies from backend
  useEffect(() => {
    let cancelled = false;

    async function loadTechnologies() {
      try {
        const user = auth.currentUser;
        if (!user) return; // silently ignore; modal will still work with manual skills

        const token = await user.getIdToken();
        const res = await apiFetch<{ technologies: Technology[] }>("/technologies", {
          token,
        });

        if (!cancelled) {
          setTechnologies(res.technologies || []);
        }
      } catch {
        // Keep UI functional even if technologies fail to load
      }
    }

    void loadTechnologies();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTechnologyToggle = (tech: Technology) => {
    setSelectedTechIds((prev) =>
      prev.includes(tech._id) ? prev.filter((id) => id !== tech._id) : [...prev, tech._id]
    );
    setSelectedTechNames((prev) =>
      prev.includes(tech.name) ? prev.filter((name) => name !== tech.name) : [...prev, tech.name]
    );
  };

  const filteredTechnologies = technologies.filter((tech) =>
    tech.name.toLowerCase().includes(techSearch.toLowerCase()) &&
    !selectedTechIds.includes(tech._id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in to create interviewers.");
      }

      const token = await user.getIdToken();

      const payload = {
        name: name.trim(),
        email: email.trim(),
        contact: phone.trim() || undefined,
        zoho_meet_uid: zohoUid.trim() || undefined,
        // Send both human-readable skills and referenced technology IDs
        skills: selectedTechNames,
        technologies: selectedTechIds,
        logo: undefined,
      };

      if (interviewer?._id) {
        await apiFetch<{ interviewer: unknown }>(`/interviewers/${interviewer._id}`, {
          method: "PUT",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<{ interviewer: unknown }>("/interviewers", {
          method: "POST",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      onInterviewerAdded?.();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create interviewer");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-xl">
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add New Interviewer
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Capture basic details and areas of expertise.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-5">
        {/* Profile Picture */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-300 dark:border-gray-700">
              {profileFileName ? profileFileName.charAt(0).toUpperCase() : 'IMG'}
            </div>
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span>Select Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setProfileFileName(file ? file.name : null);
                  }}
                />
              </label>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Optional. JPG, PNG up to 5MB.
              </span>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter full name"
            required
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="name@example.com"
            required
          />
        </div>

        {/* Contact Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Contact Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        {/* Zoho Meet UID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Zoho Meet UID
          </label>
          <input
            type="text"
            value={zohoUid}
            onChange={(e) => setZohoUid(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter Zoho Meet UID"
          />
        </div>

        {/* Technologies multi-select */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Technologies
          </label>

          {/* Selected tags */}
          {selectedTechNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTechNames.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary-700 dark:text-primary-300 border border-primary/30"
                >
                  {tech}
                  <button
                    type="button"
                    onClick={() => {
                      const techObj = technologies.find((t) => t.name === tech);
                      if (techObj) {
                        handleTechnologyToggle(techObj);
                      } else {
                        // Fallback: just remove by name
                        setSelectedTechNames((prev) => prev.filter((name) => name !== tech));
                      }
                    }}
                    className="ml-1 text-[10px] text-primary-600 dark:text-primary-300 hover:text-primary-800"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search + dropdown */}
          <div className="relative">
            <input
              type="text"
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Search and add technologies"
            />
            {techSearch && filteredTechnologies.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg text-sm">
                {filteredTechnologies.map((tech) => (
                  <button
                    key={tech._id}
                    type="button"
                    onClick={() => {
                      handleTechnologyToggle(tech);
                      setTechSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    {tech.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Select one or more skills relevant to this interviewer.
          </span>
        </div>

        {error && (
          <div className="text-xs text-red-500 dark:text-red-400 pt-1">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-600 text-white rounded-md transition-colors disabled:opacity-60"
          >
            {isLoading ? 'Saving...' : 'Save Interviewer'}
          </button>
        </div>
      </form>
    </div>
  );
}