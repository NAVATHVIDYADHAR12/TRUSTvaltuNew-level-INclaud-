"use client";

import { useSession, getLoginRecords, LoginRecord } from "../../lib/mock-auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Shield, Users, Copy, Check, Filter, MoreVertical, Activity, LogIn, Mail, Clock } from "lucide-react";

interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt?: string;
}

export default function Admin() {
    const { status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');
    const [loginRecords, setLoginRecords] = useState<LoginRecord[]>([]);
    const [activitySearch, setActivitySearch] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
            return;
        }

        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/users');
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data);
                }
            } catch (error) {
                console.error("Failed to fetch users", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (status === "authenticated") {
            fetchUsers();
            // Load login records from localStorage
            setLoginRecords(getLoginRecords());
        }
    }, [status, router]);

    // Refresh login records every 10s in case new logins happen
    useEffect(() => {
        const interval = setInterval(() => {
            setLoginRecords(getLoginRecords());
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.includes(searchTerm)
    );

    const filteredActivity = loginRecords.filter(r =>
        r.email.toLowerCase().includes(activitySearch.toLowerCase()) ||
        r.name.toLowerCase().includes(activitySearch.toLowerCase()) ||
        r.method.toLowerCase().includes(activitySearch.toLowerCase())
    );

    const methodIcon = (method: LoginRecord['method']) => {
        if (method === 'google') return (
            <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 22.6 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.07 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                Google
            </span>
        );
        if (method === 'zoho') return (
            <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#E42527" /><text x="12" y="17" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="13" fill="white">Z</text></svg>
                Zoho
            </span>
        );
        return (
            <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                Email
            </span>
        );
    };

    if (status === "loading" || isLoading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Admin Panel...</div>;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    router.push('/');
                                }
                            }}
                            className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                            title="Go Back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">TrustVault</span>
                            <span className="text-gray-500 font-medium">|</span>
                            <span className="text-white">Admin Panel</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            System Active
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={64} className="text-neon-blue" />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Total Users</h3>
                        <div className="text-3xl font-bold text-white">{users.length}</div>
                        <div className="mt-2 text-xs text-green-400 flex items-center gap-1">Onboarded Clients &amp; Creators</div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield size={64} className="text-neon-purple" />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Active Licenses</h3>
                        <div className="text-3xl font-bold text-white">24</div>
                        <div className="mt-2 text-xs text-neon-blue">Secured Assets</div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity size={64} className="text-green-500" />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Login Events</h3>
                        <div className="text-3xl font-bold text-white">{loginRecords.length}</div>
                        <div className="mt-2 text-xs text-green-400">Tracked auth sessions</div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-6 bg-black/30 border border-white/10 rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Users size={15} /> Registered Users
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'activity' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Activity size={15} /> Login Activity
                        {loginRecords.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-green-600/20 text-green-400 border border-green-500/20">
                                {loginRecords.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Users Table */}
                {activeTab === 'users' && (
                    <div className="bg-[#0f0f13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Users size={18} className="text-gray-400" />
                                Registered Users
                            </h2>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search by ID, Name, or Email..."
                                        className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-neon-blue outline-none placeholder:text-gray-600"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button className="p-2 border border-white/10 rounded-lg hover:bg-white/5 text-gray-400">
                                    <Filter size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/40 text-gray-500 border-b border-white/5 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Unique ID</th>
                                        <th className="px-6 py-4 font-medium">User Profile</th>
                                        <th className="px-6 py-4 font-medium">Role</th>
                                        <th className="px-6 py-4 font-medium">Joined Date</th>
                                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-black border border-white/10 rounded px-2 py-1 text-neon-cyan font-mono text-xs">
                                                        {user.id}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopy(user.id)}
                                                        className="text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Copy ID"
                                                    >
                                                        {copiedId === user.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-800 flex items-center justify-center font-bold text-xs border border-white/10">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{user.name}</div>
                                                        <div className="text-gray-500 text-xs">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs border ${user.role === 'client'
                                                    ? 'bg-blue-900/20 text-blue-400 border-blue-800/30'
                                                    : 'bg-purple-900/20 text-purple-400 border-purple-800/30'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-gray-500 hover:text-white">
                                                    <MoreVertical size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No users found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-white/10 bg-black/20 text-xs text-gray-500 flex justify-between items-center">
                            <span>Showing {filteredUsers.length} results</span>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-50" disabled>Previous</button>
                                <button className="px-3 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-50" disabled>Next</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Login Activity Table */}
                {activeTab === 'activity' && (
                    <div className="bg-[#0f0f13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <LogIn size={18} className="text-green-400" />
                                Login Activity &amp; Audit Log
                            </h2>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search by email, name, method..."
                                        className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-neon-blue outline-none placeholder:text-gray-600"
                                        value={activitySearch}
                                        onChange={e => setActivitySearch(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setLoginRecords(getLoginRecords())}
                                    className="px-3 py-2 border border-white/10 rounded-lg hover:bg-white/5 text-gray-400 text-xs"
                                    title="Refresh"
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/40 text-gray-500 border-b border-white/5 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">User</th>
                                        <th className="px-6 py-4 font-medium">Method</th>
                                        <th className="px-6 py-4 font-medium">IP Address</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Date &amp; Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredActivity.length > 0 ? filteredActivity.map((record) => (
                                        <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-900 to-purple-900 flex items-center justify-center font-bold text-xs border border-white/10">
                                                        {(record.name || record.email).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{record.name || '—'}</div>
                                                        <div className="text-gray-500 text-xs">{record.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-gray-300 flex items-center gap-1">
                                                    {methodIcon(record.method)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="text-xs text-gray-400 font-mono">{record.ip}</code>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs border ${record.status === 'success'
                                                    ? 'bg-green-900/20 text-green-400 border-green-800/30'
                                                    : 'bg-red-900/20 text-red-400 border-red-800/30'}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-gray-400 text-xs">
                                                    <Clock size={12} />
                                                    {record.date}
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>No login records yet.</p>
                                                <p className="text-xs mt-1 text-gray-700">Login events are recorded automatically each time a user signs in.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-white/10 bg-black/20 text-xs text-gray-500 flex justify-between items-center">
                            <span>Showing {filteredActivity.length} of {loginRecords.length} records</span>
                            <span className="text-gray-700">Records stored locally · Last 200 events</span>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
