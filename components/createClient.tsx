'use client';
import { motion } from 'framer-motion';

import { useState, useCallback, useRef } from 'react';
import { FiX, FiBriefcase, FiMail, FiPhone, FiImage, FiUpload } from 'react-icons/fi';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { apiFetch, ApiError } from '@/lib/api';
import type { FormEvent } from 'react';
import { toast } from 'react-hot-toast';

type CreateClientProps = {
    onClose: () => void;
    companyId?: string;
};

export default function CreateClient({ onClose, companyId }: CreateClientProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        contact: '',
        logo: ''
    });
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleAddClient = async (e: FormEvent<HTMLFormElement>) => {
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

            let logoUrl = formData.logo;

            if (selectedFile) {
                try {
                    const storageRef = ref(storage, `clients/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    logoUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadError) {
                    console.error("Error uploading image:", uploadError);
                    toast.error("Failed to upload image. Please try again.");
                    setIsSubmitting(false);
                    return;
                }
            }

            await apiFetch<{ client: unknown }>("/clients", {
                method: "POST",
                token,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    logo: logoUrl,
                    ...(companyId && { company_id: companyId })
                }),
            });

            toast.success('Client created successfully');

            // Dispatch event to refresh client lists
            window.dispatchEvent(new CustomEvent('clientsUpdated'));

            onClose();
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('Failed to create client');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const close = useCallback(() => {
        if (isSubmitting) return;
        onClose();
    }, [isSubmitting, onClose]);

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
                            <FiBriefcase className="w-6 h-6 text-gray-700 dark:text-gray-300" />
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
                        Add New Client
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                        Enter the client details to add them to your database
                    </p>

                    {error ? (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <form onSubmit={handleAddClient} className="space-y-4">
                        <div className="space-y-1">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Client Name *
                            </label>
                            <div className="relative">
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-orange-500 focus:border-transparent
                                 transition-all duration-200 ease-in-out text-sm"
                                    placeholder="Enter client name"
                                    required
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <FiBriefcase className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email Address
                            </label>
                            <div className="relative">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-orange-500 focus:border-transparent
                                 transition-all duration-200 ease-in-out text-sm"
                                    placeholder="client@example.com"
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <FiMail className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Contact Number
                            </label>
                            <div className="relative">
                                <input
                                    id="contact"
                                    name="contact"
                                    type="text"
                                    value={formData.contact}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-orange-500 focus:border-transparent
                                 transition-all duration-200 ease-in-out text-sm"
                                    placeholder="Enter contact number"
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <FiPhone className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Client Logo
                            </label>
                            <div className="flex items-center gap-4 mt-1">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium border border-gray-200 dark:border-gray-700"
                                >
                                    <FiUpload className="w-4 h-4" />
                                    Upload Image
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*"
                                    className="hidden"
                                />
                                {logoPreview && (
                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedFile(null);
                                                setLogoPreview(null);
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md"
                                        >
                                            <FiX className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3 pt-6">
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
                               rounded-lg text-sm flex justify-center items-center gap-2"
                            >
                                {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {isSubmitting ? 'Creating...' : 'Create Client'}
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
    );
}
