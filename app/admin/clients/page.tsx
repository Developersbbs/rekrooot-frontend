'use client'
import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { toast, Toaster } from 'react-hot-toast'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'

type Client = {
    _id: string;
    name: string;
    email: string;
    contact: string;
    logo: string;
    company_id: string;
};

const ClientsPage = () => {
    const [clients, setClients] = useState<Client[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newClient, setNewClient] = useState({
        name: '',
        email: '',
        contact: '',
        logo: '',
    })
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingClient, setEditingClient] = useState<Client | null>(null)
    const [userData, setUserData] = useState<any>(null)
    const [selectedCompany, setSelectedCompany] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)



    const fetchClients = async () => {
        try {
            setIsLoading(true)
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            let url = '/clients'
            if (selectedCompany?.id && selectedCompany.id !== 'all') {
                url += `?company_id=${selectedCompany.id}`
            }

            const res = await apiFetch<{ clients: Client[] }>(url, { token })
            setClients(res.clients)
        } catch (error) {
            console.error('Error fetching clients:', error)
            toast.error('Failed to fetch clients')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        const loadInitialCompany = () => {
            const savedCompany = localStorage.getItem('selectedCompany');
            if (savedCompany) {
                try {
                    setSelectedCompany(JSON.parse(savedCompany));
                } catch (e) {
                    console.error('Error parsing selectedCompany from localStorage:', e);
                }
            }

            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
            };
            const userDataCookie = getCookie('userData');
            if (userDataCookie) {
                try {
                    const data = JSON.parse(decodeURIComponent(userDataCookie));
                    setUserData(data);
                } catch (e) {
                    console.error('Error parsing userData cookie:', e);
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

    const companyIdForFetch = selectedCompany?.id || 'all';

    useEffect(() => {
        let cancelled = false;

        const fetchAll = async (user: any) => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            if (clients.length === 0) {
                setIsLoading(true);
            }

            try {
                const token = await user.getIdToken();

                let url = '/clients'
                if (selectedCompany?.id && selectedCompany.id !== 'all') {
                    url += `?company_id=${selectedCompany.id}`
                }

                const res = await apiFetch<{ clients: Client[] }>(url, { token })

                if (!cancelled) {
                    setClients(res.clients)
                }
            } catch (error) {
                console.error('Error fetching clients:', error)
                if (!cancelled) toast.error('Failed to fetch clients')
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!cancelled) {
                fetchAll(user);
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [companyIdForFetch])

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newClient.name) {
            toast.error('Client name is required')
            return
        }

        try {
            setIsUploading(true);
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            let logoUrl = newClient.logo;

            if (selectedFile) {
                try {
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const { storage } = await import('@/lib/firebase');

                    const storageRef = ref(storage, `clients/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    logoUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadError) {
                    console.error("Error uploading image:", uploadError);
                    toast.error("Failed to upload image. Please try again.");
                    setIsUploading(false);
                    return;
                }
            }

            const payload = {
                ...newClient,
                logo: logoUrl,
                company_id: selectedCompany?.id === 'all' ? undefined : selectedCompany?.id
            }

            const res = await apiFetch<{ client: Client }>('/clients', {
                method: 'POST',
                token,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            setClients(prev => [res.client, ...prev])
            setIsModalOpen(false)
            setNewClient({ name: '', email: '', contact: '', logo: '' })
            setLogoPreview(null)
            setSelectedFile(null);
            toast.success('Client added successfully')
        } catch (error) {
            console.error('Error adding client:', error)
            toast.error('Failed to add client')
        } finally {
            setIsUploading(false);
        }
    }

    const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null)
    const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null)
    const [isEditUploading, setIsEditUploading] = useState(false)

    useEffect(() => {
        if (editingClient) {
            setEditLogoPreview(editingClient.logo || null)
            setEditSelectedFile(null)
        }
    }, [editingClient])

    const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setEditSelectedFile(file);
            setEditLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingClient) return

        try {
            setIsEditUploading(true)
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            let logoUrl = editingClient.logo

            if (editSelectedFile) {
                try {
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const { storage } = await import('@/lib/firebase');

                    const storageRef = ref(storage, `clients/${Date.now()}_${editSelectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, editSelectedFile);
                    logoUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadError) {
                    console.error("Error uploading image:", uploadError);
                    toast.error("Failed to upload image. Please try again.");
                    setIsEditUploading(false);
                    return;
                }
            }

            const payload = {
                ...editingClient,
                logo: logoUrl
            }

            const res = await apiFetch<{ client: Client }>(`/clients/${editingClient._id}`, {
                method: 'PUT',
                token,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            setClients(prev => prev.map(c => c._id === res.client._id ? res.client : c))
            setIsEditModalOpen(false)
            setEditingClient(null)
            toast.success('Client updated successfully')
        } catch (error) {
            console.error('Error updating client:', error)
            toast.error('Failed to update client')
        } finally {
            setIsEditUploading(false)
        }
    }

    const handleDeleteClient = async (clientId: string) => {
        if (!window.confirm('Are you sure you want to delete this client?')) return

        try {
            const token = await auth.currentUser?.getIdToken()
            if (!token) return

            await apiFetch(`/clients/${clientId}`, {
                method: 'DELETE',
                token
            })

            setClients(prev => prev.filter(c => c._id !== clientId))
            toast.success('Client deleted successfully')
        } catch (error) {
            console.error('Error deleting client:', error)
            toast.error('Failed to delete client')
        }
    }

    const handleAddClientClick = () => {
        const isValidId = selectedCompany?.id && (selectedCompany.id !== 'all') && /^[0-9a-fA-F]{24}$/.test(selectedCompany.id);

        if (!isValidId) {
            toast.error('Please select a specific, valid company before adding a client')
            return
        }
        setIsModalOpen(true)
    }

    return (
        <div className="p-6 min-h-screen">
            <Toaster />

            <div className="flex justify-between items-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
                    Active Clients
                </h1>
                <button
                    onClick={handleAddClientClick}
                    className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-lg
                     flex items-center gap-2 transition-all duration-300 font-semibold shadow-md"
                >
                    <span>+ Add Client</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {clients.map((client) => (
                        <motion.div
                            key={client._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md 
                         transition-all duration-300 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 flex-shrink-0 p-2 bg-gray-50 
                                dark:bg-gray-900 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-700">
                                        {client.logo ? (
                                            <Image
                                                src={client.logo}
                                                alt={client.name}
                                                width={64}
                                                height={64}
                                                className="rounded-lg object-contain"
                                            />
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-300">{client.name[0]}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
                                            {client.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {client.email || 'No email'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {client.contact || 'No contact'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedClient(client)
                                            setIsSidebarOpen(true)
                                        }}
                                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingClient(client)
                                            setIsEditModalOpen(true)
                                        }}
                                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClient(client._id)}
                                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Sidebar Details */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        className="absolute top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-8 overflow-y-auto"
                    >
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-2xl font-bold dark:text-white">Client Details</h2>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        {selectedClient && (
                            <div className="space-y-8">
                                <div className="w-24 h-24 mx-auto bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center p-4 border border-gray-100 dark:border-gray-700">
                                    {selectedClient.logo ? <img src={selectedClient.logo} className="max-w-full max-h-full object-contain" /> : <span className="text-4xl">{selectedClient.name[0]}</span>}
                                </div>
                                <div className="space-y-6">
                                    <DetailItem label="Client Name" value={selectedClient.name} />
                                    <DetailItem label="Email Address" value={selectedClient.email || 'N/A'} />
                                    <DetailItem label="Contact Number" value={selectedClient.contact || 'N/A'} />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 dark:text-white">Edit Client</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Name"
                                value={editingClient.name}
                                onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                            />
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Email"
                                value={editingClient.email}
                                onChange={e => setEditingClient({ ...editingClient, email: e.target.value })}
                            />
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Contact"
                                value={editingClient.contact}
                                onChange={e => setEditingClient({ ...editingClient, contact: e.target.value })}
                            />
                            <div className="flex items-center gap-4">
                                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                                    <span>Upload Logo</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleEditFileSelect} />
                                </label>
                                {editLogoPreview && (
                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                        <img src={editLogoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isEditUploading}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {isEditUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {isEditUploading ? 'Uploading...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 dark:text-white">Add New Client</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Name"
                                value={newClient.name}
                                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                            />
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Email"
                                value={newClient.email}
                                onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                            />
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                placeholder="Contact"
                                value={newClient.contact}
                                onChange={e => setNewClient({ ...newClient, contact: e.target.value })}
                            />
                            <div className="flex items-center gap-4">
                                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                                    <span>Upload Logo</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                                </label>
                                {logoPreview && (
                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                        <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isUploading}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {isUploading ? 'Uploading...' : 'Add Client'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    )
}

const DetailItem = ({ label, value }: { label: string, value: string }) => (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-gray-900 dark:text-white font-semibold">{value}</p>
    </div>
)

export default ClientsPage