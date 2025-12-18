import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import { MdBusinessCenter } from 'react-icons/md';
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2';
import { FiX } from 'react-icons/fi';
import { auth } from '@/lib/firebase';
import { apiFetch, ApiError } from '@/lib/api';
import type { FormEvent } from 'react';



type CreateCompanyProps = {
    onClose: () => void;
};

export default function CreateCompany({ onClose }: CreateCompanyProps) {

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState<string | null>(null);


    const handleAddCompany = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (isSubmitting) return;
        setError(null);
        setIsSubmitting(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setError('Not authenticated. Please login again.');
                return;
            }

            await apiFetch<{ company: unknown }>("/companies", {
                method: "POST",
                token,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: companyName.trim() }),
            });

            window.dispatchEvent(new CustomEvent('companiesUpdated'));

            resetForm();
            onClose();
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 409) {
                    setError(err.message);
                } else if (err.status === 403) {
                    setError('You are not allowed to create a company');
                } else if (err.status === 401) {
                    setError('Session expired. Please login again.');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Failed to create company');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset form state
    const resetForm = useCallback(() => {
        setCompanyName('');
        setIsSubmitting(false);
        setError(null);
    }, []);

    const close = useCallback(() => {
        if (isSubmitting) return;
        resetForm();
        onClose();
    }, [isSubmitting, onClose, resetForm]);
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={close}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800"
            >
                {/* Modal Header */}
                <div className="relative h-28 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                    <div className="absolute -bottom-8 left-8">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                            <MdBusinessCenter className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </div>
                    </div>
                    <button
                        onClick={close}
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
                        Create New Company
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                        Enter the company details to create a new organization
                    </p>

                    {error ? (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <form onSubmit={handleAddCompany} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Company Name
                            </label>
                            <div className="relative">
                                <input
                                    id="companyName"
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-gray-500 focus:border-transparent
                                 transition-all duration-200 ease-in-out text-sm
                                 placeholder-gray-400 dark:placeholder-gray-500
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter company name"
                                    required
                                    maxLength={100}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <HiOutlineBuildingOffice2 className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>
                        </div>

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
                                {isSubmitting ? 'Creating...' : 'Create Company'}
                            </motion.button>

                            <button
                                type="button"
                                onClick={close}
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
                </div>
            </motion.div>
        </motion.div>
    )
}