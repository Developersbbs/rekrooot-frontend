"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUserPlus, FiX } from 'react-icons/fi';
import { apiFetch, ApiError } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { Toaster, toast } from 'react-hot-toast';

type NewUserProps = {
    onClose: () => void;
};

type Company = {
    id: string;
    name: string;
};

type CompanyDto = {
    _id: string;
    name: string;
};

type LeadRecruiter = {
    id: string;
    display_name: string;
    companyId: string;
};

type FormState = {
    companyId: string;
    email: string;
    role: '' | 'Recruiter Admin' | 'Lead Recruiter' | 'Recruiter';
    leadRecruiterId: string;
    region: string;
};

export default function NewUser({ onClose }: NewUserProps) {
    const [formData, setFormData] = useState<FormState>({
        companyId: '',
        email: '',
        role: '',
        leadRecruiterId: '',
        region: '',
    });

    const [leadRecruiters, setLeadRecruiters] = useState<LeadRecruiter[]>([]);
    const [isLoadingLeadRecruiters, setIsLoadingLeadRecruiters] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI preview values
    const isSuperAdmin = true;
    const regions = useMemo(() => ['East', 'West', 'North', 'South'], []);
    const roles = useMemo<FormState['role'][]>(() => ['Recruiter Admin', 'Lead Recruiter', 'Recruiter'], []);

    const [companies, setCompanies] = useState<Company[]>([

    ]);

    useEffect(() => {
        let cancelled = false;

        async function loadCompanies() {
            if (!isSuperAdmin) return;

            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;

                const res = await apiFetch<{ companies: CompanyDto[] }>("/companies", { token });
                if (cancelled) return;

                const next = (res.companies || []).map((c) => ({ id: c._id, name: c.name }));
                if (next.length > 0) {
                    setCompanies(next);
                }
            } catch {
                // Keep fallback sample data
            }
        }

        void loadCompanies();

        return () => {
            cancelled = true;
        };
    }, [isSuperAdmin]);

    useEffect(() => {
        let cancelled = false;

        async function loadLeadRecruiters() {
            if (!formData.companyId) {
                setLeadRecruiters([]);
                return;
            }

            try {
                setIsLoadingLeadRecruiters(true);
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;

                const res = await apiFetch<{ leadRecruiters: any[] }>(`/users/lead-recruiters?company_id=${formData.companyId}`, { token });
                if (cancelled) return;

                const list = (res.leadRecruiters || []).map((u) => ({
                    id: u._id,
                    display_name: u.username || u.email,
                    companyId: formData.companyId
                }));
                setLeadRecruiters(list);
            } catch (err) {
                console.error("Failed to load lead recruiters:", err);
            } finally {
                setIsLoadingLeadRecruiters(false);
            }
        }

        void loadLeadRecruiters();

        return () => {
            cancelled = true;
        };
    }, [formData.companyId]);



    const showRegion = formData.role === 'Recruiter';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setConfirmationMessage('');
        setErrorMessage('');

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setErrorMessage('Not authenticated. Please login again.');
                return;
            }

            if (!formData.companyId) {
                setErrorMessage('Please select a company.');
                return;
            }

            if (!formData.role) {
                setErrorMessage('Please select a role.');
                return;
            }

            const payload: {
                email: string;
                company_id: string;
                team_id?: string | null;
                role: FormState['role'];
            } = {
                email: formData.email,
                company_id: formData.companyId,
                role: formData.role,
            };

            const res = await apiFetch<{
                invitation: { token: string };
                invite_url?: string;
                mail_sent?: boolean;
                mail_error?: string | null;
            }>("/invitations", {
                method: 'POST',
                token,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const inviteUrl = res.invite_url || `${window.location.origin}/createaccount?token=${res.invitation.token}`;

            if (res.mail_sent) {
                toast.success('Invitation email sent');
            } else {
                toast.error(res.mail_error || 'Invitation created but email was not sent');
            }

            setConfirmationMessage(inviteUrl);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 400) {
                    setErrorMessage(err.message);
                    toast.error(err.message);
                } else if (err.status === 401) {
                    setErrorMessage('Session expired. Please login again.');
                    toast.error('Session expired. Please login again.');
                } else if (err.status === 403) {
                    setErrorMessage('You are not allowed to invite users.');
                    toast.error('You are not allowed to invite users.');
                } else {
                    setErrorMessage(err.message);
                    toast.error(err.message);
                }
            } else {
                setErrorMessage('Failed to create invitation.');
                toast.error('Failed to create invitation.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyId = e.target.value;
        setFormData((prev) => ({
            ...prev,
            companyId,
            leadRecruiterId: '',
        }));
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const role = e.target.value as FormState['role'];
        setFormData((prev) => ({
            ...prev,
            role,
            leadRecruiterId: role === 'Recruiter' ? prev.leadRecruiterId : '',
            region: role === 'Recruiter' ? prev.region : '',
        }));
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <Toaster />
            <div
                className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header with Gradient Background */}
                <div className="relative h-28 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                    <div className="absolute -bottom-8 left-8">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                            <FiUserPlus className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white rounded-full p-2 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="px-8 pt-14 pb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                        Add New User
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                        Enter the user details to create a new account
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {isSuperAdmin && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select Company
                                </label>
                                <select
                                    onChange={handleCompanyChange}
                                    value={formData.companyId}
                                    required
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-gray-500 focus:border-transparent
                         transition-all duration-200 ease-in-out text-sm
                         placeholder-gray-400 dark:placeholder-gray-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select a company</option>
                                    {companies.map((company) => (
                                        <option key={company.id} value={company.id}>{company.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all duration-200 hover:border-accent-400 shadow-sm"
                                placeholder="user@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                User Role
                            </label>
                            <select
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                value={formData.role}
                                onChange={handleRoleChange}
                                required
                                disabled={isSubmitting || (isSuperAdmin && !formData.companyId)}
                            >
                                <option value="">Select a role</option>
                                {roles.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>

                        </div>

                        {formData.role === 'Recruiter' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Lead Recruiter
                                    </label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                        value={formData.leadRecruiterId}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((prev) => ({ ...prev, leadRecruiterId: e.target.value }))}
                                        disabled={isSubmitting || !formData.companyId || isLoadingLeadRecruiters}
                                    >
                                        <option value="">
                                            {isLoadingLeadRecruiters ? 'Loading...' : 'Select a lead recruiter'}
                                        </option>
                                        {leadRecruiters.map((lr: LeadRecruiter) => (
                                            <option key={lr.id} value={lr.id}>{lr.display_name}</option>
                                        ))}
                                    </select>
                                    {!formData.companyId ? (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Select a company first.</div>
                                    ) : null}
                                </div>

                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-1.5"
                                >
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Region (Optional)
                                    </label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                        value={formData.region}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select a region</option>
                                        {regions.map((region) => (
                                            <option key={region} value={region}>{region}</option>
                                        ))}
                                    </select>
                                </motion.div>
                            </>
                        )}

                        <div className="flex flex-col space-y-3 pt-2">
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full px-4 py-2.5 text-white font-medium 
                       bg-gradient-to-br from-orange-500 to-orange-600
                       hover:from-orange-600 hover:to-orange-700
                       focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                       shadow-sm shadow-orange-500/20
                       transition-all duration-200 ease-in-out
                       disabled:opacity-50 disabled:cursor-not-allowed
                       rounded-lg text-sm"
                            >
                                {isSubmitting ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mx-auto"
                                    />
                                ) : (
                                    'Send Invitation'
                                )}
                            </motion.button>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="w-full px-4 py-2.5 font-medium text-sm
                       text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-800 rounded-lg
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-all duration-200 ease-in-out
                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>

                    {errorMessage && (
                        <div className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
                            {errorMessage}
                        </div>
                    )}

                </div>
            </div>
        </motion.div>
    );
}