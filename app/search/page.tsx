"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
import GlobalNavbar from '../_components/GlobalNavbar';
import { Search, Video, Users, MessageSquare, Download, Mic, Shield, Building2, GraduationCap, Briefcase, History, UserPlus, FileVideo, FileText, CheckCircle, Plus, X, DollarSign, Play, Trash2, RotateCcw, Trash, Edit3, Camera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllRecordings, deleteRecording, getTrashRecordings, restoreFromTrash, permanentlyDelete, emptyTrash, ZoomRecording } from '../zoom/_utils/recordingsDB';
import { saveChatSession, getAllChatSessions, deleteChatSession, ChatSession, ChatMessage, calculateChatSize } from '../zoom/_utils/chatDB';
import { mockSession } from '../../lib/mock-auth';
import { Sun, Moon, Send } from 'lucide-react';

// Types
type TabType = 'client' | 'freelancer' | 'student_agency' | 'industrial_agency' | 'join' | 'history';

interface Profile {
    id: string;
    userId: string; // To check ownership
    name: string;
    role: string;
    skills: string[];
    rating: number;
    hourlyRate?: string;
    image: string;
    type: Exclude<TabType, 'join' | 'history'>;
    verified: boolean;
    bio?: string;
}

// Unified History Item for UI
interface HistoryItem {
    id: string;
    type: 'video' | 'chat';
    partner: string;
    date: string;
    duration?: string; // Video only
    size: string;
    blob?: Blob; // Video only
    messages?: ChatMessage[]; // Chat only
    timestamp: number;
}

export default function SearchPage() {
    const session = mockSession; // Use mock session
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('client');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDayMode, setIsDayMode] = useState(false);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

    // Modal States
    const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

    // Data States
    const [zoomRecordings, setZoomRecordings] = useState<ZoomRecording[]>([]);
    const [trashRecordings, setTrashRecordings] = useState<ZoomRecording[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);

    const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');

    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const [historyView, setHistoryView] = useState<'recordings' | 'chats' | 'trash'>('recordings');
    const [historyToast, setHistoryToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Mock Profiles Data
    const MOCK_PROFILES: Profile[] = [
        // Clients
        {
            id: 'c1',
            userId: 'user1',
            name: 'TechCorp Inc.',
            role: 'Software Development',
            skills: ['React', 'Node.js', 'TypeScript'],
            rating: 4.8,
            hourlyRate: '$150/hr',
            image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&h=400',
            type: 'client',
            verified: true,
            bio: 'Leading tech company seeking talented developers'
        },
        {
            id: 'c2',
            userId: 'user2',
            name: 'Digital Solutions LLC',
            role: 'UI/UX Design',
            skills: ['Figma', 'Adobe XD', 'Prototyping'],
            rating: 4.9,
            hourlyRate: '$120/hr',
            image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&h=400',
            type: 'client',
            verified: true,
            bio: 'Design-first agency looking for creative minds'
        },
        {
            id: 'c3',
            userId: 'user3',
            name: 'StartupHub',
            role: 'Mobile Development',
            skills: ['Flutter', 'React Native', 'Swift'],
            rating: 4.7,
            hourlyRate: '$130/hr',
            image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=400&h=400',
            type: 'client',
            verified: true,
            bio: 'Fast-growing startup ecosystem'
        },

        // Freelancers
        {
            id: 'f1',
            userId: 'user4',
            name: 'Sarah Chen',
            role: 'Full Stack Developer',
            skills: ['React', 'Python', 'AWS', 'Docker'],
            rating: 4.9,
            hourlyRate: '$85/hr',
            image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400',
            type: 'freelancer',
            verified: true,
            bio: '8+ years building scalable web applications'
        },
        {
            id: 'f2',
            userId: 'user5',
            name: 'Alex Rivera',
            role: 'UI/UX Designer',
            skills: ['Figma', 'Sketch', 'Animation', 'Branding'],
            rating: 5.0,
            hourlyRate: '$75/hr',
            image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400',
            type: 'freelancer',
            verified: true,
            bio: 'Award-winning designer with 200+ projects'
        },
        {
            id: 'f3',
            userId: 'user6',
            name: 'Marcus Johnson',
            role: 'DevOps Engineer',
            skills: ['Kubernetes', 'CI/CD', 'Terraform', 'GCP'],
            rating: 4.8,
            hourlyRate: '$95/hr',
            image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400',
            type: 'freelancer',
            verified: true,
            bio: 'Infrastructure automation specialist'
        },
        {
            id: 'f4',
            userId: 'user7',
            name: 'Emily Zhang',
            role: 'Data Scientist',
            skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL'],
            rating: 4.9,
            hourlyRate: '$90/hr',
            image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=400',
            type: 'freelancer',
            verified: true,
            bio: 'AI/ML expert with PhD in Computer Science'
        },

        // Student Agencies
        {
            id: 'sa1',
            userId: 'user8',
            name: 'UniCode Academy',
            role: 'Student Development Team',
            skills: ['Web Dev', 'Mobile Apps', 'Game Dev', 'AI Projects'],
            rating: 4.6,
            hourlyRate: '$45/hr',
            image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&h=400',
            type: 'student_agency',
            verified: true,
            bio: 'Top CS students from MIT & Stanford collaborating on real projects'
        },
        {
            id: 'sa2',
            userId: 'user9',
            name: 'Campus Creators',
            role: 'Design & Marketing Collective',
            skills: ['Branding', 'Social Media', 'Content', 'Video Production'],
            rating: 4.7,
            hourlyRate: '$40/hr',
            image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&h=400',
            type: 'student_agency',
            verified: true,
            bio: 'Award-winning student agency from UC Berkeley'
        },
        {
            id: 'sa3',
            userId: 'user10',
            name: 'NextGen Devs',
            role: 'Full-Stack Student Team',
            skills: ['MERN Stack', 'Flutter', 'Firebase', 'Cloud'],
            rating: 4.5,
            hourlyRate: '$50/hr',
            image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=400&h=400',
            type: 'student_agency',
            verified: true,
            bio: 'Harvard & Yale students building the future'
        },

        // Industrial Agencies
        {
            id: 'ia1',
            userId: 'user11',
            name: 'TechFlow Solutions',
            role: 'Enterprise Software Development',
            skills: ['Enterprise Apps', 'Cloud Migration', 'Security', 'Consulting'],
            rating: 4.9,
            hourlyRate: '$180/hr',
            image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&h=400',
            type: 'industrial_agency',
            verified: true,
            bio: 'Fortune 500 trusted partner with 500+ employees worldwide'
        },
        {
            id: 'ia2',
            userId: 'user12',
            name: 'DigitalCraft Studios',
            role: 'Creative & Development Agency',
            skills: ['Branding', 'Web Design', 'App Development', '3D Animation'],
            rating: 5.0,
            hourlyRate: '$200/hr',
            image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=400&h=400',
            type: 'industrial_agency',
            verified: true,
            bio: 'Award-winning agency - 20 years of excellence'
        },
        {
            id: 'ia3',
            userId: 'user13',
            name: 'CloudMasters Inc.',
            role: 'Cloud Infrastructure & DevOps',
            skills: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Security'],
            rating: 4.8,
            hourlyRate: '$190/hr',
            image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&h=400',
            type: 'industrial_agency',
            verified: true,
            bio: 'Certified cloud experts serving enterprise clients'
        }
    ];

    // Initialize profiles with mock data instead of API call
    useEffect(() => {
        setProfiles(MOCK_PROFILES);
    }, []);

    const searchParams = useSearchParams();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setHistoryToast({ type, msg });
        setTimeout(() => setHistoryToast(null), 5000);
    };

    // Fetch Zoom recordings, trash, and chat history from IndexedDB
    const fetchData = async () => {
        try {
            console.log('Fetching history data...');
            const recordings = await getAllRecordings();
            console.log('Fetched recordings:', recordings.length);
            setZoomRecordings(recordings);

            const trash = await getTrashRecordings();
            setTrashRecordings(trash);

            const chats = await getAllChatSessions();
            setChatHistory(chats);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    };

    // Handle Tab Change via URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'history') {
            setActiveTab('history');
            fetchData();
        } else if (tab === 'client' || tab === 'freelancer' || tab === 'join') {
            // @ts-ignore
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Initial fetch if already on history tab
    useEffect(() => {
        if (activeTab === 'history') {
            fetchData();
        }
    }, [activeTab, historyView]);

    // Move to Recycle Bin
    const handleDeleteRecording = async (id: string) => {
        try {
            await deleteRecording(id);
            setZoomRecordings(prev => prev.filter(r => r.id !== id));
            const trash = await getTrashRecordings();
            setTrashRecordings(trash);
            showToast('success', 'Recording moved to Recycle Bin.');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Failed to delete recording:', err);
            showToast('error', `Delete failed: ${msg}`);
        }
    };

    // Restore from Recycle Bin
    const handleRestoreRecording = async (id: string) => {
        try {
            await restoreFromTrash(id);
            setTrashRecordings(prev => prev.filter(r => r.id !== id));
            const recordings = await getAllRecordings();
            setZoomRecordings(recordings);
            showToast('success', 'Recording restored!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Failed to restore recording:', err);
            showToast('error', `Restore failed: ${msg}`);
        }
    };

    // Permanently delete from Recycle Bin
    const handlePermanentDelete = async (id: string) => {
        if (confirm('Are you sure you want to permanently delete this recording? This cannot be undone.')) {
            try {
                await permanentlyDelete(id);
                setTrashRecordings(prev => prev.filter(r => r.id !== id));
                showToast('success', 'Recording permanently deleted.');
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('Failed to permanently delete recording:', err);
                showToast('error', `Permanent delete failed: ${msg}`);
            }
        }
    };

    // Empty entire Recycle Bin
    const handleEmptyTrash = async () => {
        if (confirm('Are you sure you want to permanently delete ALL recordings in the Recycle Bin? This cannot be undone.')) {
            try {
                await emptyTrash();
                setTrashRecordings([]);
                showToast('success', 'Recycle Bin emptied.');
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('Failed to empty trash:', err);
                showToast('error', `Empty trash failed: ${msg}`);
            }
        }
    };

    const handleDownloadRecording = (recording: ZoomRecording) => {
        const url = URL.createObjectURL(recording.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zoom-${recording.roomId}-${recording.id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Registration Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [regForm, setRegForm] = useState({
        name: '',
        role: '',
        skills: '',
        hourlyRate: '',
        type: 'freelancer' as Profile['type'],
        bio: '',
        profilePic: '',
        teamName: '',
        imageSource: 'profile' as 'profile' | 'upload' | 'custom'
    });

    // Image Adjustment State
    const [imgScale, setImgScale] = useState(1);
    const [imgPos, setImgPos] = useState({ x: 0, y: 0 });

    const getCroppedImage = async (imageSrc: string): Promise<string> => {
        return new Promise((resolve) => {
            const image = new Image();
            image.src = imageSrc;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(imageSrc);
                    return;
                }

                // Set canvas size to standard profile circle size (e.g. 256x256)
                const size = 256;
                canvas.width = size;
                canvas.height = size;

                // Clear background
                ctx.fillStyle = '#111';
                ctx.fillRect(0, 0, size, size);

                const centerX = size / 2;
                const centerY = size / 2;

                // Calculate scaled dimensions based on aspect ratio
                const aspect = image.width / image.height;
                let drawWidth, drawHeight;

                if (aspect > 1) {
                    drawWidth = size;
                    drawHeight = size / aspect;
                } else {
                    drawHeight = size;
                    drawWidth = size * aspect;
                }

                // Apply transforms
                // Canvas is 256px, Preview is 96px (w-24). Scale translation to match.
                const ratio = size / 96;
                ctx.translate(centerX + (imgPos.x * ratio), centerY + (imgPos.y * ratio));
                ctx.scale(imgScale, imgScale);

                // Draw image centered at origin
                ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            image.onerror = () => resolve(imageSrc);
        });
    };

    // Auto-fill form from session
    useEffect(() => {
        if (isRegistrationOpen && session.user) {
            // @ts-ignore
            const u = session.user;
            setRegForm(prev => ({
                ...prev,
                name: u.name || '',
                // @ts-ignore
                profilePic: u.profilePic || u.image || '',
                // @ts-ignore
                bio: u.bio || '',
                // @ts-ignore
                role: u.role || ''
            }));
        }
    }, [isRegistrationOpen, session]);

    const filteredProfiles = activeTab !== 'join' && activeTab !== 'history'
        ? profiles.filter(p =>
            p.type === activeTab &&
            (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))
        )
        : [];

    // Handlers
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        // Determine Image URL
        let finalImage = regForm.profilePic;
        if (regForm.imageSource === 'profile') {
            // First try regForm.profilePic (populated by button click), then session fallback
            if (regForm.profilePic) finalImage = regForm.profilePic;
            else if (session.user?.image) finalImage = session.user.image;
        } else if (regForm.imageSource === 'upload' && regForm.profilePic.startsWith('data:')) {
            // Apply cropping/adjustments
            try {
                finalImage = await getCroppedImage(regForm.profilePic);
            } catch (e) {
                console.error("Crop failed", e);
            }
        } else {
            // Fallback
            finalImage = `https://ui-avatars.com/api/?name=${regForm.name}&background=random`
        }

        const payload = {
            name: regForm.name,
            role: regForm.role,
            skills: regForm.skills.split(',').map(s => s.trim()),
            hourlyRate: regForm.hourlyRate ? `$${regForm.hourlyRate}/hr` : undefined,
            image: finalImage,
            type: regForm.type,
            bio: regForm.bio,
            verified: true // Auto-verify for demo
        };

        try {
            if (isEditing && editId) {
                // UPDATE
                const res = await fetch('/api/search', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editId, ...payload })
                });
                if (res.ok) {
                    const updated = await res.json();
                    setProfiles(prev => prev.map(p => p.id === editId ? updated : p));
                    alert("Profile Updated Successfully!");
                }
            } else {
                // CREATE (JOIN)
                const res = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const newProfile = await res.json();
                    setProfiles([newProfile, ...profiles]);

                    // Also create team if agency
                    if (regForm.type.includes('agency')) {
                        await fetch('/api/teams/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: regForm.name,
                                role: regForm.role,
                                category: regForm.type,
                                description: regForm.bio,
                                skills: regForm.skills.split(','),
                                leaderId: (session.user as any).id,
                                leaderName: session.user?.name
                            })
                        });
                    }

                    setActiveTab(regForm.type);
                    alert(`Successfully joined as ${regForm.type.replace('_', ' ')}!`);
                }
            }
        } catch (e) {
            console.error(e);
            alert("Operation failed");
        }

        setIsRegistrationOpen(false);
        setIsEditing(false);
        setEditId(null);
        resetForm();
    };

    const resetForm = () => {
        setRegForm({
            name: '', role: '', skills: '', hourlyRate: '', type: 'freelancer', bio: '', profilePic: '', teamName: '', imageSource: 'profile'
        });
    }

    const handleEditProfile = (profile: Profile) => {
        setRegForm({
            name: profile.name,
            role: profile.role,
            skills: profile.skills.join(', '),
            hourlyRate: profile.hourlyRate?.replace('$/hr', '').replace('$', '') || '',
            type: profile.type,
            bio: profile.bio || '',
            profilePic: profile.image,
            teamName: '',
            imageSource: 'custom' // Keep existing image as default
        });
        setEditId(profile.id);
        setIsEditing(true);
        setIsRegistrationOpen(true);
    };

    const handleDeleteProfile = async (id: string) => {
        if (!confirm("Are you sure you want to unjoin/delete this profile? This cannot be undone.")) return;
        try {
            const res = await fetch('/api/search', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setProfiles(prev => prev.filter(p => p.id !== id));
            }
        } catch (e) {
            console.error(e);
        }
    };



    const handleFetchProfilePic = async () => {
        try {
            const res = await fetch('/api/profile/me'); // Or generic user endpoint
            if (res.ok) {
                const data = await res.json();
                if (data.profilePic || data.image) {
                    setRegForm(prev => ({ ...prev, profilePic: data.profilePic || data.image, imageSource: 'profile' }));
                } else {
                    // Fallback to session image if API has nothing
                    if (session.user?.image) {
                        setRegForm(prev => ({ ...prev, profilePic: session.user.image!, imageSource: 'profile' }));
                    }
                }
            }
        } catch (e) {
            // Fallback
            if (session.user?.image) {
                setRegForm(prev => ({ ...prev, profilePic: session.user.image!, imageSource: 'profile' }));
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setRegForm(prev => ({ ...prev, profilePic: reader.result as string, imageSource: 'upload' }));
                // Reset adjustments
                setImgScale(1);
                setImgPos({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    // Handlers
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        const newUserMsg: ChatMessage = {
            sender: 'user',
            text: chatInput,
            timestamp: Date.now()
        };

        const updatedMessages = [...activeChatMessages, newUserMsg];
        setActiveChatMessages(updatedMessages);
        setChatInput('');

        // Simulate partner response
        setTimeout(() => {
            const partnerMsg: ChatMessage = {
                sender: 'partner',
                text: `Thanks for your message: "${newUserMsg.text}"! This is an automated response simulation.`,
                timestamp: Date.now()
            };
            setActiveChatMessages(prev => [...prev, partnerMsg]);
        }, 1500);
    };

    const handleChatClose = async () => {
        if (activeChatMessages.length > 0 && selectedProfile) {
            const chatSession: ChatSession = {
                id: Date.now().toString(),
                partnerId: selectedProfile.id,
                partnerName: selectedProfile.name,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                timestamp: Date.now(),
                messages: activeChatMessages,
                size: calculateChatSize(activeChatMessages)
            };
            try {
                await saveChatSession(chatSession);
                // Refresh history so it shows immediately when user switches to History tab
                const chats = await getAllChatSessions();
                setChatHistory(chats);
                showToast('success', 'Chat saved to History!');
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('Failed to save chat session:', err);
                showToast('error', `Chat save failed: ${msg}`);
            }
        }
        setIsChatOpen(false);
        setActiveChatMessages([]);
    };

    const handleExportChat = (sessionToExport?: ChatSession) => {
        // If exporting currently open chat
        let messages = activeChatMessages;
        let partnerName = selectedProfile?.name || 'User';
        let senderLabel = partnerName; // label shown in transcript for 'partner' messages

        // If exporting from history (sessionToExport provided)
        if (sessionToExport) {
            messages = sessionToExport.messages;
            partnerName = sessionToExport.partnerName;
            // Zoom chat sessions use "Participant" so the transcript isn't labelled
            // with the long session name ("Group Chat Discussion — Room XYZ")
            senderLabel = sessionToExport.id.startsWith('zoom-') ? 'Participant' : sessionToExport.partnerName;
        }

        if (messages.length === 0) {
            alert("No messages to export.");
            return;
        }

        const transcript = messages.map(m =>
            `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender === 'user' ? 'You' : senderLabel}: ${m.text}`
        ).join('\n\n');

        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${partnerName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const toggleRecording = () => setIsRecording(!isRecording);

    const renderContent = () => {
        if (activeTab === 'history') {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold">Interaction History</h2>
                            <button
                                onClick={fetchData}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                title="Refresh History"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Toggle: Recordings vs Chats vs Recycle Bin */}
                        <div className="flex items-center gap-2 bg-[#111] p-1 rounded-xl border border-white/10">
                            <button
                                onClick={() => setHistoryView('recordings')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${historyView === 'recordings'
                                    ? 'bg-gray-200 text-gray-900 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Video className="w-4 h-4" />
                                Recordings ({zoomRecordings.length})
                            </button>
                            <button
                                onClick={() => setHistoryView('chats')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${historyView === 'chats'
                                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <MessageSquare className="w-4 h-4" />
                                Chats ({chatHistory.length})
                            </button>
                            <button
                                onClick={() => setHistoryView('trash')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${historyView === 'trash'
                                    ? 'bg-red-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Trash className="w-4 h-4" />
                                Recycle Bin ({trashRecordings.length})
                            </button>
                        </div>
                    </div>

                    {/* Zoom Recordings Section */}
                    {historyView === 'recordings' && zoomRecordings.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                                <Video className="w-5 h-5" />
                                Zoom Recordings ({zoomRecordings.length})
                            </h3>
                            <div className="grid gap-4">
                                {zoomRecordings.map((rec) => (
                                    <motion.div
                                        key={rec.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-[#111] p-4 rounded-xl border border-purple-500/20 hover:bg-white/5 transition-colors"
                                    >
                                        {/* Video Player */}
                                        {playingVideo === rec.id && (
                                            <div className="mb-4 rounded-lg overflow-hidden bg-black">
                                                <video
                                                    src={URL.createObjectURL(rec.blob)}
                                                    controls
                                                    autoPlay
                                                    className="w-full max-h-[300px]"
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
                                                    <FileVideo className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white">Zoom Meeting: {rec.roomId}</h3>
                                                    <p className="text-sm text-gray-500">{rec.date} • {rec.duration} • {rec.size}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPlayingVideo(playingVideo === rec.id ? null : rec.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                                                >
                                                    <Play className="w-4 h-4" />
                                                    {playingVideo === rec.id ? 'Hide' : 'Play'}
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadRecording(rec)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 border border-white/10 transition-colors"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRecording(rec.id)}
                                                    className="p-2 bg-red-600/10 text-red-400 rounded-lg hover:bg-red-600/20 border border-red-500/20 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chat History Section */}
                    {historyView === 'chats' && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Chat Sessions ({chatHistory.length})
                            </h3>
                            {chatHistory.length > 0 ? (
                                <div className="grid gap-4">
                                    {chatHistory.map((chat) => (
                                        <motion.div
                                            key={chat.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-[#111] p-4 rounded-xl border border-blue-500/20 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-lg ${chat.id.startsWith('zoom-') ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                        {chat.id.startsWith('zoom-') ? <Video className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-bold text-white">
                                                                {chat.id.startsWith('zoom-') ? chat.partnerName : `Chat with ${chat.partnerName}`}
                                                            </h3>
                                                            {chat.id.startsWith('zoom-') && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">ZoomChat</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500">{chat.date} • {chat.messages.length} messages • {chat.size}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleExportChat(chat)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 border border-white/10 transition-colors"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Export
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Delete this chat history?')) {
                                                                try {
                                                                    await deleteChatSession(chat.id);
                                                                    setChatHistory(prev => prev.filter(c => c.id !== chat.id));
                                                                    showToast('success', 'Chat deleted.');
                                                                } catch (err) {
                                                                    const msg = err instanceof Error ? err.message : String(err);
                                                                    showToast('error', `Delete failed: ${msg}`);
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 bg-red-600/10 text-red-400 rounded-lg hover:bg-red-600/20 border border-red-500/20 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-[#111] rounded-2xl border border-white/5">
                                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                    <h3 className="text-xl font-bold text-gray-400 mb-2">No Chats Yet</h3>
                                    <p className="text-gray-500">Start a chat with a profile or end a Zoom call to save conversations here.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty Recordings State */}
                    {historyView === 'recordings' && zoomRecordings.length === 0 && (
                        <div className="text-center py-12 bg-[#111] rounded-2xl border border-white/5">
                            <Video className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                            <h3 className="text-xl font-bold text-gray-400 mb-2">No Recordings Yet</h3>
                            <p className="text-gray-500">Start a Zoom meeting and click Record to save your meetings here.</p>
                        </div>
                    )}

                    {/* Recycle Bin Section */}
                    {historyView === 'trash' && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                                    <Trash className="w-5 h-5" />
                                    Recycle Bin ({trashRecordings.length})
                                </h3>
                                {trashRecordings.length > 0 && (
                                    <button
                                        onClick={handleEmptyTrash}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600/10 text-red-400 rounded-lg text-sm hover:bg-red-600/20 border border-red-500/20 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Empty Recycle Bin
                                    </button>
                                )}
                            </div>

                            {trashRecordings.length > 0 ? (
                                <div className="grid gap-4">
                                    {trashRecordings.map((rec) => (
                                        <motion.div
                                            key={rec.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-[#111] p-4 rounded-xl border border-red-500/10 hover:border-red-500/20 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
                                                        <Trash className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-white">Meeting: {rec.roomId}</h3>
                                                        <p className="text-sm text-gray-500">
                                                            Deleted: {rec.deletedAt ? new Date(rec.deletedAt).toLocaleString() : 'Unknown'} •
                                                            Original: {rec.date} • {rec.duration} • {rec.size}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRestoreRecording(rec.id)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600/10 text-green-400 rounded-lg text-sm hover:bg-green-600/20 border border-green-500/20 transition-colors"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(rec.id)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-600/10 text-red-400 rounded-lg text-sm hover:bg-red-600/20 border border-red-500/20 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete Forever
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-[#111] rounded-2xl border border-white/5">
                                    <Trash className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                    <h3 className="text-xl font-bold text-gray-400 mb-2">Recycle Bin is Empty</h3>
                                    <p className="text-gray-500">Deleted recordings will appear here for recovery.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty Recordings State used to be here - removed duplicate */}
                </div>
            );
        }

        if (activeTab === 'join') {
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto bg-white/90 backdrop-blur-xl p-8 rounded-3xl border border-white/50 text-center relative overflow-hidden shadow-[0_0_35px_rgba(255,255,255,0.3)]"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-200 to-white" />

                    <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-6 text-black shadow-inner">
                        <Users className="w-10 h-10" />
                    </div>

                    <h2 className="text-3xl font-bold mb-4 text-black drop-shadow-sm">Join the Network</h2>
                    <p className="text-gray-700 mb-8 max-w-md mx-auto font-medium">
                        Become part of the Verified Network. Access premium clients, secure payment tools, and DRM protection for your work.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/50 p-4 rounded-xl border border-gray-200 text-left hover:bg-white/80 transition-colors shadow-sm">
                            <CheckCircle className="w-5 h-5 text-cyan-600 mb-2" />
                            <h3 className="font-bold mb-1 text-black">Verified Badge</h3>
                            <p className="text-xs text-gray-600">Stand out with verified skills.</p>
                        </div>
                        <div className="bg-white/50 p-4 rounded-xl border border-gray-200 text-left hover:bg-white/80 transition-colors shadow-sm">
                            <Shield className="w-5 h-5 text-cyan-600 mb-2" />
                            <h3 className="font-bold mb-1 text-black">DRM Protection</h3>
                            <p className="text-xs text-gray-600">Watermark and license your work.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsRegistrationOpen(true)}
                        className="w-full py-4 bg-cyan-400 text-black rounded-xl font-bold text-lg hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] transition-all active:scale-[0.98]"
                    >
                        Apply Now
                    </button>
                    <p className="mt-4 text-xs text-gray-500">Takes less than 5 minutes. No fees to join.</p>
                </motion.div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProfiles.length > 0 ? (
                    filteredProfiles.map((profile) => (
                        <motion.div
                            key={profile.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div
                                onClick={() => setSelectedProfile(profile)}
                                className={`h-full flex flex-col rounded-2xl border p-6 hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden ${isDayMode ? 'bg-white border-gray-200 shadow-sm hover:shadow-md' : 'bg-[#111] border-white/10'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDayMode ? 'mix-blend-multiply' : ''}`} />
                                <div className="relative z-10 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <img
                                            src={profile.image}
                                            alt={profile.name}
                                            className="w-16 h-16 rounded-xl object-cover border-2 border-white/10 cursor-pointer hover:border-blue-500 transition-colors"
                                            onClick={() => router.push(`/CreatorSecure/profile?id=${profile.id}`)}
                                        />
                                        {profile.verified && (
                                            <div className="bg-green-500/10 text-green-400 p-1.5 rounded-lg border border-green-500/20" title="Verified Secure">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    <h3 className={`font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors ${isDayMode ? 'text-gray-900' : 'text-white'}`}>{profile.name}</h3>
                                    <p className="text-blue-500 text-sm font-medium">{profile.role}</p>

                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {profile.skills.map((skill, i) => (
                                            <span key={i} className={`text-xs px-2 py-1 rounded-md border ${isDayMode ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-300 border-white/5'}`}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-auto">
                                        <button
                                            onClick={() => { setSelectedProfile(profile); setIsVideoCallOpen(true); }}
                                            className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl hover:bg-blue-600/20 hover:text-blue-400 transition-colors border border-white/5 group/btn"
                                            title="Video Call"
                                        >
                                            <Video className="w-5 h-5 mb-1 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px]">Call</span>
                                        </button>
                                        <button
                                            onClick={() => { setSelectedProfile(profile); setIsChatOpen(true); }}
                                            className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl hover:bg-purple-600/20 hover:text-purple-400 transition-colors border border-white/5 group/btn"
                                            title="Chat History"
                                        >
                                            <MessageSquare className="w-5 h-5 mb-1 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px]">Chat</span>
                                        </button>
                                        <button
                                            className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl hover:bg-green-600/20 hover:text-green-400 transition-colors border border-white/5 group/btn"
                                            title="Add to Team"
                                            onClick={() => alert(`Request sent to ${profile.name}!`)}
                                        >
                                            <Users className="w-5 h-5 mb-1 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px]">Team</span>
                                        </button>
                                    </div>

                                    {/* Edit/Delete Controls for Owner */}
                                    {(session.user as any)?.id === profile.userId && (
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-lg backdrop-blur-sm">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}
                                                className="p-1.5 text-blue-400 hover:bg-blue-600/20 rounded-md transition-colors"
                                                title="Edit Profile"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                                                className="p-1.5 text-red-400 hover:bg-red-600/20 rounded-md transition-colors"
                                                title="Unjoin / Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center text-gray-500">
                        <p>No matches found in this category.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`min-h-screen font-sans selection:bg-cyan-500/30 transition-colors duration-300 ${isDayMode ? 'bg-[#f0f2f5] text-gray-900' : 'bg-[#0a0a0f] text-white'}`}>
            <GlobalNavbar />

            {/* History Toast Notifications */}
            <AnimatePresence>
                {historyToast && (
                    <motion.div
                        key={historyToast.msg}
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg max-w-lg text-center text-white ${historyToast.type === 'success' ? 'bg-green-600/90' : 'bg-red-600/90'}`}
                    >
                        <span className="font-medium text-sm">{historyToast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full lg:w-64 shrink-0 space-y-4">
                    <div className={`rounded-2xl p-4 sticky top-24 border transition-colors duration-300 ${isDayMode ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#111] border-white/10'}`}>
                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 px-2 ${isDayMode ? 'text-gray-500' : 'text-gray-400'}`}>Menu</h3>
                        <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                            {[
                                { id: 'client', label: 'Search Client', icon: Users },
                                { id: 'freelancer', label: 'Search Freelancer', icon: Briefcase },
                                { id: 'student_agency', label: 'Student Agency', icon: GraduationCap },
                                { id: 'industrial_agency', label: 'Industrial Agency', icon: Building2 },
                                { id: 'join', label: 'Join / Register', icon: UserPlus },
                                { id: 'history', label: 'History', icon: History },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-[#5eff5e] text-black shadow-[0_0_20px_rgba(94,255,94,0.6)]'
                                        : 'text-gray-400 hover:text-cyan-400 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] hover:bg-white/5'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    {/* Header Section */}
                    <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-500 mb-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                                Find Your Perfect Match
                            </h1>
                            <p className={`text-sm max-w-xl font-medium transition-all duration-300 ${isDayMode ? 'text-cyan-600 drop-shadow-[0_0_3px_rgba(8,145,178,0.3)]' : 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]'}`}>
                                Connect with clients, freelancers, and agencies. Build your dream team.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={() => setIsDayMode(!isDayMode)}
                                className={`p-2 rounded-full transition-all duration-300 ${isDayMode ? 'bg-white text-orange-500 shadow-md hover:bg-orange-50' : 'bg-white/10 text-yellow-400 hover:bg-white/20'}`}
                                title={isDayMode ? "Switch to Night Mode" : "Switch to Day Mode"}
                            >
                                {isDayMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('join')}
                                className="hidden md:flex relative group transition-transform duration-300 transform hover:scale-105 active:scale-95 translate-y-[3px]"
                            >
                                {/* Glow Effect Container */}
                                <div className="absolute inset-0 rounded-full bg-[#ff00ff] blur-2xl opacity-0 group-hover:opacity-70 transition-opacity duration-300 animate-pulse scale-110"></div>

                                {/* Image Button */}
                                <img
                                    src="/loogoo.png"
                                    alt="Join Now"
                                    className={`h-[51px] w-auto object-contain relative z-10 transition-all duration-300 hover:drop-shadow-[0_0_35px_rgba(255,0,255,0.8)] ${isDayMode ? 'drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]' : 'drop-shadow-2xl'}`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    {activeTab !== 'join' && activeTab !== 'history' && (
                        <div className="relative w-full mb-8">
                            <input
                                type="text"
                                placeholder={`Search for ${activeTab.replace('_', ' ')}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-blue-500/50 transition-all shadow-sm border ${isDayMode ? 'bg-white text-gray-900 border-gray-200 placeholder:text-gray-400' : 'bg-[#111] text-white border-white/10'}`}
                            />
                            <Search className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 ${isDayMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                    )}

                    {/* Dynamic Content */}
                    {renderContent()}
                </div>

                {/* Registration Modal */}
                <AnimatePresence>
                    {isRegistrationOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[#111] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl relative flex flex-col max-h-[90vh]"
                            >
                                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#151515] shrink-0 sticky top-0 z-10">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <Users className="w-5 h-5 text-blue-500" />
                                        {isEditing ? 'Edit Profile' : 'Join the Network'}
                                    </h2>
                                    <button
                                        onClick={() => setIsRegistrationOpen(false)}
                                        className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition-all"
                                        title="Close"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto p-6 no-scrollbar">
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Company / Profile Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={regForm.name}
                                                onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                                                placeholder="e.g. Design Studio Inc."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Registration Type</label>
                                            <select
                                                value={regForm.type}
                                                onChange={e => setRegForm({ ...regForm, type: e.target.value as Profile['type'] })}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white appearance-none"
                                            >
                                                <option value="client">Client (Hiring)</option>
                                                <option value="freelancer">Freelancer (Working)</option>
                                                <option value="student_agency">Student Agency</option>
                                                <option value="industrial_agency">Industrial Agency</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Professional Role / Title</label>
                                            <input
                                                required
                                                type="text"
                                                value={regForm.role}
                                                onChange={e => setRegForm({ ...regForm, role: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                                                placeholder="e.g. Senior Product Designer"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Key Skills (Comma separated)</label>
                                            <input
                                                required
                                                type="text"
                                                value={regForm.skills}
                                                onChange={e => setRegForm({ ...regForm, skills: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                                                placeholder="e.g. UI/UX, Figma, React"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Hourly Rate (Optional)</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                                    <DollarSign className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="number"
                                                    value={regForm.hourlyRate}
                                                    onChange={e => setRegForm({ ...regForm, hourlyRate: e.target.value })}
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                                                    placeholder="e.g. 50"
                                                />
                                            </div>
                                        </div>

                                        {/* Image Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Profile Picture</label>
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <button
                                                    type="button"
                                                    onClick={handleFetchProfilePic}
                                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${regForm.imageSource === 'profile' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/50 border-white/10 text-gray-500 hover:bg-white/5'}`}
                                                >
                                                    <Users className="w-6 h-6" />
                                                    <span className="text-xs font-bold">Import from Profile</span>
                                                </button>

                                                <label className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${regForm.imageSource === 'upload' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/50 border-white/10 text-gray-500 hover:bg-white/5'}`}>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                    <Camera className="w-6 h-6" />
                                                    <span className="text-xs font-bold">Upload Custom</span>
                                                </label>
                                            </div>

                                            {/* Preview */}
                                            <div className="flex flex-col gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-white/10 shrink-0 shadow-lg">
                                                        {/* Visual helper for center */}
                                                        <div className="absolute inset-0 border border-white/10 rounded-full z-10 pointer-events-none opacity-20"></div>

                                                        {regForm.imageSource === 'profile' ? (
                                                            <img
                                                                src={regForm.profilePic || session.user?.image || `https://ui-avatars.com/api/?name=${regForm.name}`}
                                                                className="w-full h-full object-cover"
                                                                alt="Profile"
                                                            />
                                                        ) : regForm.imageSource === 'upload' && regForm.profilePic ? (
                                                            <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                                                                <img
                                                                    src={regForm.profilePic}
                                                                    className="max-w-none origin-center transition-transform duration-75"
                                                                    style={{
                                                                        transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${imgScale})`,
                                                                        // Ensure image acts as a texture centered
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain'
                                                                    }}
                                                                    alt="Upload"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-500 bg-[#222]">
                                                                <Users className="w-8 h-8 opacity-50" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 flex-1">
                                                        {regForm.imageSource === 'profile'
                                                            ? 'Using your main account photo.'
                                                            : regForm.imageSource === 'upload'
                                                                ? 'Adjust position and zoom below.'
                                                                : 'No photo selected.'}
                                                    </div>
                                                </div>

                                                {/* Controls for Upload */}
                                                {regForm.imageSource === 'upload' && regForm.profilePic && (
                                                    <div className="space-y-3 pt-2 border-t border-white/10">
                                                        {/* ZOOM */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                                <span>Zoom</span>
                                                                <span>{Math.round(imgScale * 100)}%</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="1" max="3" step="0.1"
                                                                value={imgScale}
                                                                onChange={e => setImgScale(parseFloat(e.target.value))}
                                                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                                                            />
                                                        </div>

                                                        {/* PAN X/Y */}
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Pan X</span><span>{Math.round(imgPos.x)}px</span></div>
                                                                <input
                                                                    type="range"
                                                                    min="-100" max="100"
                                                                    value={imgPos.x}
                                                                    onChange={e => setImgPos(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                                                                />
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Pan Y</span><span>{Math.round(imgPos.y)}px</span></div>
                                                                <input
                                                                    type="range"
                                                                    min="-100" max="100"
                                                                    value={imgPos.y}
                                                                    onChange={e => setImgPos(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-center pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setImgScale(1); setImgPos({ x: 0, y: 0 }); }}
                                                                className="text-[10px] text-blue-400 hover:text-blue-300"
                                                            >
                                                                Reset Position
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full relative group transition-transform duration-300 transform hover:scale-105 active:scale-95"
                                        >
                                            {/* Glow Effect Container */}
                                            <div className="absolute inset-0 rounded-full bg-magenta-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300 animate-pulse"></div>

                                            {/* Image Button */}
                                            <img
                                                src="/loogoo.png"
                                                alt="Join Now"
                                                className="w-full h-auto object-contain relative z-10 drop-shadow-xl hover:drop-shadow-[0_0_25px_rgba(255,0,255,0.6)] transition-all duration-300"
                                            />
                                        </button>
                                    </form>
                                </div>
                            </motion.div >
                        </div >
                    )
                    }
                </AnimatePresence >

                {/* Video Call Modal */}
                {
                    isVideoCallOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-[#111] w-full max-w-4xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
                                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#151515]">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <Video className="w-5 h-5 text-red-500" />
                                        Secure Video Meeting with {selectedProfile?.name}
                                    </h2>
                                    <button onClick={() => setIsVideoCallOpen(false)} className="text-gray-400 hover:text-white transition-colors">Close</button>
                                </div>
                                <div className="h-[500px] bg-black relative flex items-center justify-center group">
                                    <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black opacity-50" />
                                    <div className="z-10 text-center">
                                        <div className="w-24 h-24 rounded-full bg-gray-800 mx-auto mb-4 border-2 border-white/10 overflow-hidden">
                                            <img src={selectedProfile?.image} className="w-full h-full object-cover opacity-50" />
                                        </div>
                                        <p className="text-gray-500 group-hover:text-gray-400 transition-colors">Connecting to secure stream...</p>
                                    </div>
                                    {isRecording && (
                                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 border border-red-500/50 px-3 py-1 rounded-full animate-pulse z-20">
                                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                                            <span className="text-xs text-red-400 font-medium">REC Active</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-8 flex gap-4 z-20">
                                        <button className="p-4 bg-gray-600/50 rounded-full hover:bg-gray-600 transition-all border border-white/10 hover:scale-105">
                                            <Mic className="w-6 h-6 text-white" />
                                        </button>
                                        <button
                                            onClick={toggleRecording}
                                            className={`px-6 py-2 rounded-full border transition-all flex items-center gap-2 hover:scale-105 ${isRecording
                                                ? 'bg-red-600 text-white border-red-500 hover:bg-red-700 shadow-lg shadow-red-500/20'
                                                : 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                                            {isRecording ? 'Stop Recording' : 'Record Session'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Chat Modal */}
                {
                    isChatOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-[#111] w-full max-w-2xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl h-[600px] flex flex-col relative">
                                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#151515]">
                                    <h2 className="text-xl font-bold flex items-center gap-2 text-sky-300">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                        Chat with {selectedProfile?.name}
                                    </h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleExportChat()}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs border border-white/10 transition-colors text-sky-300"
                                        >
                                            <Download className="w-3 h-3" />
                                            Export History
                                        </button>
                                        <button onClick={handleChatClose} className="text-gray-400 hover:text-white transition-colors">Close</button>
                                    </div>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#0a0a0f]">
                                    {activeChatMessages.length > 0 ? (
                                        activeChatMessages.map((msg, idx) => (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div
                                                    className={`p-3 rounded-2xl max-w-[80%] border ${msg.sender === 'user'
                                                        ? 'bg-blue-600/20 text-blue-100 rounded-br-none self-end border-blue-600/20'
                                                        : 'bg-white/10 text-white rounded-bl-none self-start border-white/10'
                                                        }`}
                                                >
                                                    {msg.text}
                                                </div>
                                                <span className={`text-[10px] text-gray-500 ${msg.sender === 'user' ? 'self-end mr-2' : 'ml-2'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                                            <MessageSquare className="w-12 h-12 mb-2" />
                                            <p>Start a secure conversation...</p>
                                        </div>
                                    )}
                                </div>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }}
                                    className="p-4 border-t border-white/10 bg-[#151515] flex gap-2"
                                >
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a secure message..."
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!chatInput.trim()}
                                        className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors text-white"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
}
