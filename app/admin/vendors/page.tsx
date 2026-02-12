'use client'
import React, { useState, useEffect } from 'react'
import { FiPlus, FiPhone, FiMail, FiUser, FiEdit2, FiTrash2 } from 'react-icons/fi'
import toast, { Toaster } from 'react-hot-toast'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

type Vendor = {
    id: string
    vendorName: string
    email: string
    contactNumber: string
    status: string
    company_id: string
    createdAt?: string
}

const VendorPage = () => {
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        vendorName: '',
        email: '',
        contactNumber: '',
        status: 'Active'
    })
    const [selectedCompany, setSelectedCompany] = useState<any>(null)
    const [isEditMode, setIsEditMode] = useState(false)
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const savedCompany = localStorage.getItem('selectedCompany');
        if (savedCompany) {
            try {
                setSelectedCompany(JSON.parse(savedCompany));
            } catch (e) {
                console.error('Error parsing saved company:', e);
            }
        }

        const handleCompanyChange = (event: any) => {
            setSelectedCompany(event.detail)
        }

        window.addEventListener('companyChanged', handleCompanyChange)
        return () => window.removeEventListener('companyChanged', handleCompanyChange)
    }, [])

    const companyIdForFetch = selectedCompany?.id || 'all';

    useEffect(() => {
        let cancelled = false;

        const fetchData = async (user: any) => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            const shouldShowFullLoading = vendors.length === 0;
            if (shouldShowFullLoading) {
                setIsLoading(true);
            }

            try {
                const token = await user.getIdToken();

                let url = '/vendors'
                if (companyIdForFetch !== 'all') {
                    url += `?company_id=${companyIdForFetch}`
                }

                const res = await apiFetch<{ vendors: Vendor[] }>(url, { token });

                if (!cancelled) {
                    setVendors(res.vendors);
                }
            } catch (error) {
                console.error('Error fetching vendors:', error);
                if (!cancelled) toast.error('Failed to fetch vendors');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!cancelled) {
                fetchData(user);
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [companyIdForFetch, vendors.length])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.vendorName || !formData.email || !formData.contactNumber) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            const payload = {
                ...formData,
                company_id: selectedCompany?.id === 'all' ? undefined : selectedCompany?.id
            }

            const url = isEditMode && selectedVendor
                ? `/vendors/${selectedVendor.id}`
                : '/vendors'

            const method = isEditMode ? 'PUT' : 'POST'

            const res = await apiFetch<{ vendor: Vendor }>(url, {
                method,
                token,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (isEditMode) {
                setVendors(prev => prev.map(v => v.id === res.vendor.id ? res.vendor : v))
                toast.success('Vendor updated successfully')
            } else {
                setVendors(prev => [res.vendor, ...prev])
                toast.success('Vendor added successfully')
            }

            setIsModalOpen(false)
            setFormData({
                vendorName: '',
                email: '',
                contactNumber: '',
                status: 'Active'
            })
        } catch (error) {
            console.error('Error saving vendor:', error)
            toast.error('Failed to save vendor')
        }
    }

    const handleDelete = async (vendorId: string) => {
        if (!window.confirm('Are you sure you want to delete this vendor?')) return

        try {
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            await apiFetch(`/vendors/${vendorId}`, {
                method: 'DELETE',
                token
            })

            setVendors(prev => prev.filter(v => v.id !== vendorId))
            toast.success('Vendor deleted successfully')
        } catch (error) {
            console.error('Error deleting vendor:', error)
            toast.error('Failed to delete vendor')
        }
    }

    const handleEdit = (vendor: Vendor) => {
        setSelectedVendor(vendor)
        setFormData({
            vendorName: vendor.vendorName,
            email: vendor.email,
            contactNumber: vendor.contactNumber,
            status: vendor.status
        })
        setIsEditMode(true)
        setIsModalOpen(true)
    }

    const handleAddVendor = () => {
        const isValidId = selectedCompany?.id && (selectedCompany.id !== 'all') && /^[0-9a-fA-F]{24}$/.test(selectedCompany.id);

        if (!isValidId) {
            toast.error('Please select a specific, valid company before adding a vendor')
            return
        }

        setSelectedVendor(null)
        setFormData({
            vendorName: '',
            email: '',
            contactNumber: '',
            status: 'Active'
        })
        setIsEditMode(false)
        setIsModalOpen(true)
    }

    return (
        <div className="p-6 min-h-screen">
            <Toaster position="top-right" />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-primary-500 dark:text-primary-100">
                    Vendor Management
                </h1>
                <button
                    onClick={handleAddVendor}
                    className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-all duration-200"
                >
                    <FiPlus className="text-lg" /> Add Vendor
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map((vendor) => (
                        <div
                            key={vendor.id}
                            className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden"
                        >
                            <div className="absolute top-4 right-4">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${vendor.status === 'Active'
                                    ? 'bg-green-50 text-green-600 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    : 'bg-red-50 text-red-600 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                    }`}>
                                    {vendor.status}
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 group-hover:text-accent-500 transition-colors">
                                        {vendor.vendorName}
                                    </h3>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                        <FiMail className="text-accent-500" />
                                        {vendor.email}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                        <FiPhone className="text-accent-500" />
                                        {vendor.contactNumber}
                                    </div>
                                </div>

                                <div className="flex justify-end items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 gap-2">
                                    <button
                                        onClick={() => handleEdit(vendor)}
                                        className="p-2 text-gray-500 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-lg transition-colors"
                                    >
                                        <FiEdit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(vendor.id)}
                                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <FiTrash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />

                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-xl transform rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                            <div className="p-6 pb-0 mb-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                                            {isEditMode ? 'Edit Vendor' : 'Add New Vendor'}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Manage vendor details below
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vendor Name</label>
                                    <div className="relative">
                                        <FiUser className="absolute left-3 top-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            required
                                            value={formData.vendorName}
                                            onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                                            placeholder="Enter vendor name"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                                    <div className="relative">
                                        <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                                            placeholder="vendor@company.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Number</label>
                                    <div className="relative">
                                        <FiPhone className="absolute left-3 top-3.5 text-gray-400" />
                                        <input
                                            type="tel"
                                            required
                                            value={formData.contactNumber}
                                            onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                                            placeholder="+1 (555) 000-0000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 rounded-xl bg-accent-500 text-white hover:bg-accent-600 font-medium shadow-lg shadow-accent-500/30 transition-all hover:shadow-accent-500/40"
                                    >
                                        {isEditMode ? 'Update Vendor' : 'Add Vendor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VendorPage