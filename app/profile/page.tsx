"use client";

import { useSession, signOut, generateProfileId } from "../../lib/mock-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
    Copy, Check, LogOut, Camera, Image as ImageIcon, Heart, MessageCircle,
    Plus, Users, Shield, ArrowLeft, Edit3, Award, Mic, Volume2, X,
    Github, Linkedin, Twitter, Globe, Youtube, Facebook, Instagram, Briefcase,
    MessageSquare, Send, Download, Trash2, UserMinus
} from "lucide-react";
import { User, Post, Certificate, Badge, SocialLink, Team, TeamMember, ChatMessage } from "./lib/types";
import GlobalNavbar from "../_components/GlobalNavbar";

export default function Profile() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState<'posts' | 'certificates' | 'badges' | 'teams'>('posts');

    // Modals
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showAddCert, setShowAddCert] = useState(false);
    const [showAddBadge, setShowAddBadge] = useState(false);

    // Form States - Profile
    const [editName, setEditName] = useState("");
    const [editBio, setEditBio] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const [editProfession, setEditProfession] = useState("Student");
    const [editSkills, setEditSkills] = useState("");
    const [editExperience, setEditExperience] = useState("");
    const [editPhotoPos, setEditPhotoPos] = useState("center");
    const [imgScale, setImgScale] = useState(1);
    const [imgPos, setImgPos] = useState({ x: 0, y: 0 });

    // Form States - Socials
    const [socials, setSocials] = useState<{ [key: string]: string }>({
        linkedin: "", github: "", twitter: "", instagram: "", facebook: "", youtube: "", website: ""
    });

    // Form States - Content
    const [newPostCaption, setNewPostCaption] = useState("");
    const [newPostImage, setNewPostImage] = useState<string | null>(null);

    const [newCertTitle, setNewCertTitle] = useState("");
    const [newCertIssuer, setNewCertIssuer] = useState("");
    const [newCertDate, setNewCertDate] = useState("");
    const [newCertFile, setNewCertFile] = useState<string | null>(null);

    const [newBadgeName, setNewBadgeName] = useState("");
    const [newBadgeImage, setNewBadgeImage] = useState<string | null>(null);

    // TTS
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // TEAMS & CHAT STATE
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [chatMode, setChatMode] = useState<'group' | 'dm'>('group');
    const [chatPartner, setChatPartner] = useState<TeamMember | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [showTeamManager, setShowTeamManager] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const fetchTeams = async () => {
        try {
            const res = await fetch('/api/teams');
            if (res.ok) setTeams(await res.json());
        } catch (e) { }
    };

    const fetchMessages = async () => {
        if (!selectedTeam) return;
        try {
            let url = `/api/teams/chat?teamId=${selectedTeam.id}&mode=${chatMode}`;
            if (chatMode === 'dm' && chatPartner) {
                url += `&partnerId=${chatPartner.userId}`;
            }
            const res = await fetch(url);
            if (res.ok) setMessages(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        if (activeTab === 'teams') fetchTeams();
    }, [activeTab]);

    useEffect(() => {
        if (showTeamManager) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 3000); // Poll for new messages
            return () => clearInterval(interval);
        }
    }, [selectedTeam, chatMode, chatPartner, showTeamManager]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTeam) return;
        try {
            await fetch('/api/teams/chat', {
                method: 'POST',
                body: JSON.stringify({
                    teamId: selectedTeam.id,
                    content: newMessage,
                    type: chatMode,
                    recipientId: chatPartner?.userId
                })
            });
            setNewMessage("");
            fetchMessages();
        } catch (e) { }
    };

    const handleExportChat = () => {
        const dataStr = JSON.stringify(messages, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTeam?.name}_chat_history.json`;
        a.click();
    };

    const handleDeleteTeam = async (id: string) => {
        if (!confirm("Are you sure? This will delete the team for everyone.")) return;
        await fetch(`/api/teams?id=${id}`, { method: 'DELETE' });
        fetchTeams();
    };

    const handleLeaveTeam = async (teamId: string) => {
        if (!confirm("Are you sure you want to leave this team?")) return;
        await fetch('/api/teams', {
            method: 'PUT',
            body: JSON.stringify({ id: teamId, action: 'leave' })
        });
        fetchTeams();
    };

    const openTeamManager = (team: Team) => {
        setSelectedTeam(team);
        setChatMode('group');
        setChatPartner(null);
        setShowTeamManager(true);
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        }
        if (session?.user) {
            fetchUserData();
        }
    }, [status, session]);

    const fetchUserData = async () => {
        try {
            // Try to load from localStorage first (preserves existing data)
            let storedData = loadFromLocalStorage();

            // If stored data has a stale/demo ID (not TVX format), regenerate it from session email.
            // This fixes the "demo-user-1" problem: localStorage had old data from before
            // generateProfileId was introduced, so we must upgrade it.
            if (storedData) {
                const tvxPattern = /^TVX-[A-Z0-9]{1,5}-[A-F0-9]{6}$/i;
                if (!tvxPattern.test(storedData._id)) {
                    const userEmail = (session?.user?.email || storedData.email || 'demo@example.com');
                    const freshId = generateProfileId(userEmail);
                    storedData = { ...storedData, _id: freshId, email: userEmail };
                    // Persist the upgraded ID immediately
                    localStorage.setItem('creatorSecureProfile', JSON.stringify(storedData));
                }
            }

            // If no stored data, create initial mock data
            if (!storedData) {
                const userEmail = session.user.email || 'demo@example.com';
                storedData = {
                    _id: generateProfileId(userEmail),
                    name: session.user.name || 'Demo User',
                    email: session.user.email || 'demo@example.com',
                    profilePic: session.user.image || session.user.profilePic || 'https://ui-avatars.com/api/?name=Demo+User&background=random',
                    bio: session.user.bio || 'Passionate developer and creator. Building amazing things with code!',
                    summary: 'An experienced professional with a strong background in software development, design, and collaboration. Skilled in modern technologies and frameworks, with a proven track record of delivering high-quality projects.',
                    role: session.user.role || 'Developer',
                    profession: 'Full Stack Developer',
                    skills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'TailwindCSS', 'Python'],
                    experience: '5+ years',
                    photoPosition: 'center',
                    socialLinks: [
                        { platform: 'github', url: 'https://github.com/demo' },
                        { platform: 'linkedin', url: 'https://linkedin.com/in/demo' },
                        { platform: 'twitter', url: 'https://twitter.com/demo' }
                    ],
                    posts: [
                        {
                            id: '1',
                            caption: 'Just deployed my latest project! 🚀',
                            imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=600&fit=crop',
                            createdAt: new Date().toISOString(),
                            likes: ['user1', 'user2'],
                            userId: 'demo-user-1'
                        },
                        {
                            id: '2',
                            caption: 'Learning new technologies every day 💻',
                            createdAt: new Date(Date.now() - 86400000).toISOString(),
                            likes: ['user3'],
                            userId: 'demo-user-1'
                        }
                    ],
                    certificates: [
                        {
                            id: '1',
                            title: 'React Advanced Patterns',
                            issuer: 'Udemy',
                            date: '2024',
                            fileUrl: 'https://ui-avatars.com/api/?name=React&background=61DAFB&color=000'
                        },
                        {
                            id: '2',
                            title: 'AWS Certified Developer',
                            issuer: 'Amazon Web Services',
                            date: '2023',
                            fileUrl: 'https://ui-avatars.com/api/?name=AWS&background=FF9900&color=fff'
                        }
                    ],
                    badges: [
                        {
                            id: '1',
                            name: 'Early Adopter',
                            imageUrl: 'https://ui-avatars.com/api/?name=🏆&background=FFD700&color=000',
                            date: new Date().toISOString()
                        },
                        {
                            id: '2',
                            name: 'Creator Pro',
                            imageUrl: 'https://ui-avatars.com/api/?name=⭐&background=9333EA&color=fff',
                            date: new Date().toISOString()
                        }
                    ],
                    teams: [],
                    followers: ['user1', 'user2', 'user3'],
                    following: ['user4', 'user5']
                };

                // Save initial data to localStorage
                saveToLocalStorage(storedData);
            }

            setUserData(storedData);

            // Init Edit Form
            setEditName(storedData.name || "");
            setEditBio(storedData.bio || "");
            setEditSummary(storedData.summary || "");
            setEditProfession(storedData.profession || "Student");
            setEditSkills(storedData.skills?.join(", ") || "");
            setEditExperience(storedData.experience || "");
            setEditPhotoPos(storedData.photoPosition || "center");

            // Init Socials
            const socialMap: any = { linkedin: "", github: "", twitter: "", instagram: "", facebook: "", youtube: "", website: "" };
            storedData.socialLinks?.forEach((link: SocialLink) => {
                socialMap[link.platform] = link.url;
            });
            setSocials(socialMap);
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setLoading(false);
        }
    };

    // Helper function to save to localStorage
    const saveToLocalStorage = (data: User) => {
        localStorage.setItem('creatorSecureProfile', JSON.stringify(data));
    };

    // Helper function to load from localStorage
    const loadFromLocalStorage = (): User | null => {
        const stored = localStorage.getItem('creatorSecureProfile');
        return stored ? JSON.parse(stored) : null;
    };


    const getCroppedImage = async (imageSrc: string): Promise<string> => {
        return new Promise((resolve) => {
            const image = new Image();
            image.src = imageSrc;
            image.crossOrigin = "anonymous";
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
                // Canvas is 256px, Preview is ~96px. Scale translation to match.
                // Note: In profile preview, size might vary, but assuming generic ratio for now or standardizing.
                // Let's use standard logic: user adjusts visual ratio.
                // If we assume preview is roughly size of canvas for logic, we use scaling.
                // Ideally we match the preview size in the edit modal.
                const ratio = size / 96; // Approximation if preview is small.
                // However, in Profile Edit, we don't have a live preview of the crop yet.
                // We should probably show a preview if Adjusted is selected.

                ctx.translate(centerX + (imgPos.x * ratio), centerY + (imgPos.y * ratio));
                ctx.scale(imgScale, imgScale);

                // Draw image centered at origin
                ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            image.onerror = () => resolve(imageSrc);
        });
    };

    const handleUpdateProfile = async () => {
        setSaving(true);
        setSaved(false);

        console.log('🔍 BEFORE UPDATE - editBio:', editBio);
        console.log('🔍 BEFORE UPDATE - userData.bio:', userData?.bio);

        // Construct social links array
        const socialLinks: SocialLink[] = Object.entries(socials)
            .filter(([_, url]) => url && url.length > 0)
            .map(([platform, url]) => ({ platform: platform as any, url }));

        let finalProfilePic = userData?.profilePic;

        if (editPhotoPos === 'custom' && userData?.profilePic) {
            try {
                finalProfilePic = await getCroppedImage(userData.profilePic);
            } catch (e) {
                console.error("Crop failed", e);
            }
        }

        const updates = {
            bio: editBio,
            summary: editSummary,
            profession: editProfession,
            skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
            experience: editExperience,
            photoPosition: editPhotoPos,
            socialLinks,
            profilePic: finalProfilePic
        };

        console.log('📝 Updates object:', updates);

        try {
            // Update userData with new values - set each property explicitly
            const updatedData = {
                ...userData,
                name: editName,
                bio: editBio,
                summary: editSummary,
                profession: editProfession,
                skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
                experience: editExperience,
                photoPosition: editPhotoPos,
                socialLinks,
                profilePic: finalProfilePic
            } as User;

            console.log('✅ AFTER UPDATE - updatedData.bio:', updatedData.bio);
            console.log('✅ Full updatedData:', updatedData);

            setUserData(updatedData);
            saveToLocalStorage(updatedData);

            // Verify localStorage
            const verified = loadFromLocalStorage();
            console.log('💾 Verified from localStorage - bio:', verified?.bio);

            console.log('💾 Saved to localStorage');

            // Also sync to database in background (optional)
            try {
                await fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: updatedData.name,
                        email: updatedData.email,
                        ...updates,
                        role: updatedData.role
                    })
                });
                console.log('🗄️ Synced to database');
            } catch (dbError) {
                console.log('Database sync failed (non-critical):', dbError);
            }

            setSaving(false);
            setSaved(true);

            // Re-enable auto-close
            setTimeout(() => {
                setShowEditProfile(false);
                setSaved(false);
            }, 1500);
        } catch (e) {
            console.error('❌ Error updating profile:', e);
            setSaving(false);
        }
    };

    const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const updatedData = { ...userData, profilePic: base64 } as User;
                setUserData(updatedData);
                saveToLocalStorage(updatedData);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreatePost = async () => {
        if (!newPostCaption && !newPostImage) return;
        try {
            const newPost: Post = {
                id: Date.now().toString(),
                caption: newPostCaption,
                imageUrl: newPostImage || undefined,
                createdAt: new Date().toISOString(),
                likes: [],
                userId: userData?._id || 'demo-user-1'
            };
            const updatedData = {
                ...userData!,
                posts: [...(userData?.posts || []), newPost]
            };
            setUserData(updatedData);
            saveToLocalStorage(updatedData);
            setNewPostCaption("");
            setNewPostImage(null);
        } catch (e) { console.error(e); }
    };

    const handleAddCertificate = async () => {
        try {
            const newCert: Certificate = {
                id: Date.now().toString(),
                title: newCertTitle,
                issuer: newCertIssuer,
                date: newCertDate,
                fileUrl: newCertFile || undefined
            };
            const updatedData = {
                ...userData!,
                certificates: [...(userData?.certificates || []), newCert]
            };
            setUserData(updatedData);
            saveToLocalStorage(updatedData);
            setShowAddCert(false);
            setNewCertTitle(""); setNewCertIssuer(""); setNewCertDate(""); setNewCertFile(null);
        } catch (e) { }
    };

    const handleDeleteCertificate = async (id: string) => {
        if (!confirm("Are you sure you want to delete this certificate?")) return;
        try {
            const updatedData = {
                ...userData!,
                certificates: userData?.certificates?.filter(c => c.id !== id) || []
            };
            setUserData(updatedData);
            saveToLocalStorage(updatedData);
        } catch (e) { }
    };

    const handleAddBadge = async () => {
        const img = newBadgeImage || "https://ui-avatars.com/api/?name=Badge&background=random";
        try {
            const newBadge: Badge = {
                id: Date.now().toString(),
                name: newBadgeName,
                imageUrl: img,
                date: new Date().toISOString()
            };
            const updatedData = {
                ...userData!,
                badges: [...(userData?.badges || []), newBadge]
            };
            setUserData(updatedData);
            saveToLocalStorage(updatedData);
            setShowAddBadge(false);
            setNewBadgeName(""); setNewBadgeImage(null);
        } catch (e) { }
    };

    const handleDeleteBadge = async (id: string) => {
        if (!confirm("Delete this badge?")) return;
        try {
            const updatedData = {
                ...userData!,
                badges: userData?.badges?.filter(b => b.id !== id) || []
            };
            setUserData(updatedData);
            saveToLocalStorage(updatedData);
        } catch (e) { }
    };

    const copyToClipboard = () => {
        if (!userData) return;
        navigator.clipboard.writeText(userData._id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const speakSummary = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const text = `Here is a summary for ${userData?.name}. ${userData?.summary || "No summary available."} Role: ${userData?.role}. Bio: ${userData?.bio}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };

    const [generating, setGenerating] = useState(false);

    const generateAiSummary = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/profile/generate-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: userData?.name,
                    bio: editBio,
                    profession: editProfession,
                    skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
                    experience: editExperience
                })
            });

            if (res.ok) {
                const data = await res.json();
                setEditSummary(data.summary);
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to generate summary. Please add your GROQ_API_KEY to .env.local');
            }
        } catch (e) {
            console.error("Failed to generate", e);
            alert('Failed to generate summary. Please check your Groq API configuration.');
        } finally {
            setGenerating(false);
        }
    };

    const getSocialIcon = (platform: string) => {
        switch (platform) {
            case 'github': return <Github size={18} />;
            case 'linkedin': return <Linkedin size={18} />;
            case 'twitter': return <Twitter size={18} />;
            case 'instagram': return <Instagram size={18} />;
            case 'facebook': return <Facebook size={18} />;
            case 'youtube': return <Youtube size={18} />;
            default: return <Globe size={18} />;
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Profile...</div>;

    if (!userData) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4">
                <div className="text-red-500 mb-4"><Shield size={48} /></div>
                <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
                <p className="text-gray-400 mb-6 text-center max-w-md">
                    We couldn't load your profile data. You might need to sign in again.
                </p>
                <button onClick={() => signOut()} className="px-6 py-2 bg-neon-blue text-black rounded-lg font-bold">Sign Out & Retry</button>
            </div>
        );
    }

    const objectPosClass = userData.photoPosition === 'top' ? 'object-top' : (userData.photoPosition === 'bottom' ? 'object-bottom' : 'object-center');

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-neon-purple/30">
            {/* Header */}
            <GlobalNavbar />

            <main className="max-w-4xl mx-auto pt-28 px-6 pb-20">
                {/* Profile Card */}
                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-neon-blue/10 to-neon-purple/10" />

                    <div className="relative flex flex-col md:flex-row gap-8 items-start">
                        {/* Avatar */}
                        <div className="group relative shrink-0 mx-auto md:mx-0">
                            <div className="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-[#111] shadow-2xl overflow-hidden bg-gray-800">
                                {userData.profilePic ? (
                                    <img src={userData.profilePic} alt="Profile" className={`w-full h-full object-contain ${objectPosClass}`} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        <Users size={48} />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-neon-blue text-black rounded-full cursor-pointer hover:bg-white transition-colors shadow-lg shadow-neon-blue/20">
                                <Camera size={18} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                            </label>
                        </div>

                        {/* Info */}
                        <div className="flex-1 w-full text-center md:text-left space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-2 justify-center md:justify-start">
                                        {userData.name}
                                        {userData.socialLinks && userData.socialLinks.length > 0 && (
                                            <div className="flex gap-2 ml-2">
                                                {userData.socialLinks.map((link, i) => (
                                                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-neon-blue transition-colors">
                                                        {getSocialIcon(link.platform)}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </h2>
                                    <div className="flex items-center justify-center md:justify-start gap-2 text-gray-400 text-sm flex-wrap">
                                        <span className="px-2 py-0.5 bg-white/5 rounded text-white">{userData.profession || "Student"}</span>
                                    </div>
                                    {userData.experience && (
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 justify-center md:justify-start">
                                            <Briefcase size={12} /> {userData.experience} Experience
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowEditProfile(true)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                >
                                    <Edit3 size={16} /> Edit Profile
                                </button>
                            </div>

                            {/* Profile ID Box — used for meeting join verification */}
                            <div
                                className="flex items-center gap-3 bg-gradient-to-r from-neon-blue/10 to-purple-600/10 border border-neon-blue/30 rounded-xl px-4 py-3 cursor-pointer group w-fit mx-auto md:mx-0 hover:border-neon-blue/60 transition-all"
                                onClick={copyToClipboard}
                                title="Click to copy your Platform Profile ID"
                            >
                                <Shield size={16} className="text-neon-blue shrink-0" />
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Platform Profile ID · Used for Secure Meetings</div>
                                    <code className="font-mono text-neon-cyan font-bold tracking-wide">{userData._id}</code>
                                </div>
                                {copied
                                    ? <Check size={14} className="text-green-400 shrink-0" />
                                    : <Copy size={14} className="text-gray-600 group-hover:text-neon-blue shrink-0 transition-colors" />
                                }
                            </div>

                            {/* Stats (REAL) */}
                            <div className="flex justify-center md:justify-start gap-8 pt-2">
                                <div className="text-center md:text-left">
                                    <div className="font-bold text-xl text-white">{userData.posts?.length || 0}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Posts</div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="font-bold text-xl text-white">{userData.followers?.length || 0}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Followers</div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="font-bold text-xl text-white">{userData.following?.length || 0}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Following</div>
                                </div>
                            </div>

                            {/* Bio & Skills */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-left">
                                <p className="text-gray-300 leading-relaxed text-sm mb-3">
                                    {userData.bio || "No bio added yet. Click 'Edit Profile' to introduce yourself!"}
                                </p>
                                {userData.skills && userData.skills.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {userData.skills.map((skill, i) => (
                                            <span key={i} className="px-2 py-1 bg-neon-blue/10 text-neon-blue border border-neon-blue/20 rounded-md text-xs font-medium">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="md:col-span-3 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Bot size={120} />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <h3 className="flex items-center gap-2 text-indigo-400 font-bold">
                                <span className="bg-indigo-500/10 p-1.5 rounded-lg"><Mic size={16} /></span>
                                AI Profile Summary
                            </h3>
                            <button
                                onClick={speakSummary}
                                className={`p-2 rounded-full transition-all ${isSpeaking ? 'bg-indigo-500 text-white animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                {isSpeaking ? <Volume2 size={20} /> : <Mic size={20} />}
                            </button>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed relative z-10 italic">
                            "{userData.summary || "No summary available yet. Open 'Edit Profile' and click 'Generate with AI'!"}"
                        </p>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-white/10 mb-8">
                    {['posts', 'certificates', 'badges', 'teams'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'border-neon-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[300px]">
                    {/* POSTS TAB */}
                    {activeTab === 'posts' && (
                        <div className="space-y-6">
                            {/* Create Post Box */}
                            <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0 overflow-hidden">
                                    {userData.profilePic && <img src={userData.profilePic} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="What's on your mind?"
                                        className="w-full bg-transparent border-none outline-none text-white placeholder:text-gray-600 mb-2 font-light"
                                        value={newPostCaption}
                                        onChange={e => setNewPostCaption(e.target.value)}
                                    />
                                    {newPostImage && (
                                        <div className="relative w-fit mb-2">
                                            <img src={newPostImage} className="h-32 rounded-lg border border-white/10" />
                                            <button onClick={() => setNewPostImage(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"><X size={12} /></button>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <label className="text-neon-blue text-xs font-bold cursor-pointer hover:underline flex items-center gap-1">
                                            <ImageIcon size={14} /> Add Photo
                                            <input
                                                type="file" className="hidden" accept="image/*"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        const r = new FileReader();
                                                        r.onload = () => setNewPostImage(r.result as string);
                                                        r.readAsDataURL(f);
                                                    }
                                                }}
                                            />
                                        </label>
                                        <button
                                            onClick={handleCreatePost}
                                            disabled={!newPostCaption && !newPostImage}
                                            className="px-4 py-1.5 bg-neon-blue text-black text-xs font-bold rounded-lg disabled:opacity-50"
                                        >
                                            Post
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Feed */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {userData.posts && userData.posts.length > 0 ? (
                                    userData.posts.map((post: Post) => (
                                        <div key={post.id} className="bg-[#111] border border-white/10 rounded-xl overflow-hidden group">
                                            {post.imageUrl && (
                                                <div className="h-48 bg-gray-900 overflow-hidden">
                                                    <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <p className="text-sm text-gray-200 mb-3">{post.caption}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1 hover:text-neon-pink cursor-pointer"><Heart size={14} /> {post.likes?.length || 0}</span>
                                                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-10 text-gray-500">No posts yet. Share something!</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CERTIFICATES TAB */}
                    {activeTab === 'certificates' && (
                        <div>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setShowAddCert(true)}
                                    className="px-4 py-2 bg-neon-purple/20 text-neon-purple border border-neon-purple/50 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-neon-purple/30"
                                >
                                    <Plus size={16} /> Add Certificate
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {userData.certificates && userData.certificates.length > 0 ? (
                                    userData.certificates.map((cert) => (
                                        <div key={cert.id} className="bg-[#111] border border-white/10 p-4 rounded-xl flex items-center gap-4 hover:border-neon-purple/30 transition-colors relative group">
                                            <button
                                                onClick={() => handleDeleteCertificate(cert.id)}
                                                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                                title="Delete"
                                            >
                                                <X size={14} />
                                            </button>

                                            <div className="w-16 h-16 shrink-0 bg-neon-purple/10 rounded-lg flex items-center justify-center text-neon-purple overflow-hidden border border-white/5">
                                                {cert.fileUrl ? (
                                                    <img src={cert.fileUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Shield size={24} />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{cert.title}</h3>
                                                <p className="text-xs text-gray-400">{cert.issuer}</p>
                                                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">{cert.date}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-10 text-gray-500">No certificates added.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TEAMS TAB */}
                    {activeTab === 'teams' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">
                                    My Teams & Agencies
                                </h3>
                                <button className="px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-600/30 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-600/20" onClick={() => router.push('/CreatorSecure/search')}>
                                    <Plus size={16} /> Join/Create Team
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {userData.teams && userData.teams.length > 0 ? (
                                    userData.teams.map((team) => (
                                        <div key={team.id} className="bg-[#111] border border-white/10 p-5 rounded-xl relative group hover:border-blue-500/30 transition-colors">
                                            {/* Team Lead Indicator */}
                                            <div className="absolute -top-3 left-4 bg-[#1a1a1a] px-3 py-1 rounded-full border border-white/10 text-[10px] text-gray-400 font-mono flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                Lead: {team.leaderName || "Unknown"}
                                            </div>

                                            <div className="mt-2">
                                                <h3 className="text-lg font-bold text-white mb-1">{team.name}</h3>
                                                <p className="text-xs text-gray-400 mb-4">{team.description || "No description provided."}</p>

                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="flex -space-x-2">
                                                        {team.members?.slice(0, 4).map((m, i) => (
                                                            <div key={i} className="w-8 h-8 rounded-full bg-gray-800 border-2 border-[#111] flex items-center justify-center text-xs overflow-hidden">
                                                                {m.profilePic ? <img src={m.profilePic} /> : m.name[0]}
                                                            </div>
                                                        ))}
                                                        {team.members && team.members.length > 4 && (
                                                            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-[#111] flex items-center justify-center text-[10px] text-gray-400">
                                                                +{team.members.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-500">{team.members?.length || 0} Members</span>
                                                </div>

                                                <div className="flex justify-end pt-2 border-t border-white/5">
                                                    {team.leaderId === userData._id ? (
                                                        <button className="text-xs text-blue-400 hover:text-blue-300 font-bold px-3 py-1 bg-blue-500/10 rounded-lg">
                                                            Manage Team
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleLeaveTeam(team.id)}
                                                            className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1 bg-red-500/10 rounded-lg flex items-center gap-1"
                                                        >
                                                            <LogOut size={12} /> Leave Team
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-10 text-center border border-dashed border-white/10 rounded-xl">
                                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-400 font-bold">No Teams Joined Yet</p>
                                        <p className="text-sm text-gray-600 mb-4">Join a team or create an agency to collaborate.</p>
                                        <button onClick={() => router.push('/CreatorSecure/search')} className="text-blue-400 text-sm hover:underline">Find Your Perfect Match &rarr;</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}



                    {/* BADGES TAB */}
                    {activeTab === 'badges' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">
                                    Collection ({userData.badges?.length || 0})
                                </h3>
                                <button
                                    onClick={() => setShowAddBadge(true)}
                                    className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-yellow-500/20"
                                >
                                    <Plus size={16} /> Add Badge
                                </button>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                                {userData.badges && userData.badges.length > 0 ? (
                                    userData.badges.map((badge) => (
                                        <div key={badge.id} className="bg-[#111] border border-white/10 p-4 rounded-xl flex flex-col items-center text-center gap-2 hover:bg-white/5 transition-colors group relative">
                                            <button
                                                onClick={() => handleDeleteBadge(badge.id)}
                                                className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            >
                                                <X size={12} />
                                            </button>

                                            {badge.imageUrl ? (
                                                <img src={badge.imageUrl} alt={badge.name} className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center"><Award size={32} className="text-yellow-500" /></div>
                                            )}
                                            <span className="text-xs font-bold text-gray-300 line-clamp-2">{badge.name}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-10 text-gray-500">No badges earned yet.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* EDIT PROFILE MODAL */}
            {showEditProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-[#111] w-full max-w-2xl rounded-2xl border border-white/10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                            <button onClick={() => setShowEditProfile(false)} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>

                        {/* Profile Picture Upload Section */}
                        <div className="mb-6 flex flex-col items-center gap-4">
                            <div className="relative">
                                <img
                                    src={userData?.profilePic || 'https://ui-avatars.com/api/?name=' + userData?.name}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-contain border-2 border-neon-blue/50"
                                />
                                <label
                                    htmlFor="profile-pic-upload"
                                    className="absolute bottom-0 right-0 p-2 bg-neon-blue hover:bg-neon-cyan text-black rounded-full cursor-pointer shadow-lg transition-all"
                                >
                                    <Camera size={16} />
                                    <input
                                        id="profile-pic-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfilePicUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-gray-500">Click camera to upload new photo</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-neon-blue uppercase tracking-wider border-b border-white/10 pb-2 mb-2">Identity</h3>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Display Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Your Name..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">About You (Bio)</label>
                                    <textarea
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                        rows={3}
                                        value={editBio}
                                        onChange={e => setEditBio(e.target.value)}
                                        placeholder="Bio..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Profession</label>
                                    <select
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                        value={editProfession}
                                        onChange={e => setEditProfession(e.target.value)}
                                    >
                                        <option value="Student">Student</option>
                                        <option value="Mentor">Mentor</option>
                                        <option value="Founder">Founder</option>
                                        <option value="Working Professional">Working Professional</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Experience</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                        value={editExperience}
                                        onChange={e => setEditExperience(e.target.value)}
                                        placeholder="e.g. 5 Years..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Skills (Comma separated)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                        value={editSkills}
                                        onChange={e => setEditSkills(e.target.value)}
                                        placeholder="React, NextJS, AI..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Photo Alignment</label>
                                    <div className="space-y-3">
                                        <select
                                            className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none"
                                            value={editPhotoPos}
                                            onChange={e => setEditPhotoPos(e.target.value)}
                                        >
                                            <option value="center">Center</option>
                                            <option value="top">Top</option>
                                            <option value="bottom">Bottom</option>
                                            <option value="custom">Adjusted (Zoom/Pan)</option>
                                        </select>

                                        {editPhotoPos === 'custom' && (
                                            <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                                                {/* Zoom */}
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                        <span>Zoom</span>
                                                        <span>{Math.round(imgScale * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="1" max="3" step="0.1"
                                                        value={imgScale}
                                                        onChange={e => setImgScale(parseFloat(e.target.value))}
                                                        className="w-full accent-neon-blue h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>

                                                {/* Pan X */}
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                        <span>Pan X</span>
                                                        <span>{imgPos.x}px</span>
                                                    </div>
                                                    <input
                                                        type="range" min="-100" max="100"
                                                        value={imgPos.x}
                                                        onChange={e => setImgPos({ ...imgPos, x: parseInt(e.target.value) })}
                                                        className="w-full accent-neon-purple h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>

                                                {/* Pan Y */}
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                        <span>Pan Y</span>
                                                        <span>{imgPos.y}px</span>
                                                    </div>
                                                    <input
                                                        type="range" min="-100" max="100"
                                                        value={imgPos.y}
                                                        onChange={e => setImgPos({ ...imgPos, y: parseInt(e.target.value) })}
                                                        className="w-full accent-neon-purple h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>

                                                {/* Live Preview */}
                                                <div className="mt-4 pt-4 border-t border-white/10">
                                                    <p className="text-xs text-gray-400 mb-3 text-center font-bold">Live Preview</p>
                                                    <div className="flex justify-center">
                                                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-neon-blue/50 bg-black">
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    transform: `translate(calc(-50% + ${imgPos.x}px), calc(-50% + ${imgPos.y}px)) scale(${imgScale})`,
                                                                    transformOrigin: 'center',
                                                                }}
                                                            >
                                                                <img
                                                                    src={userData?.profilePic || 'https://ui-avatars.com/api/?name=' + userData?.name}
                                                                    alt="Preview"
                                                                    className="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 italic text-center mt-2">
                                                        Adjust sliders to see changes
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Socials & AI */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-neon-purple uppercase tracking-wider border-b border-white/10 pb-2 mb-2">Connections</h3>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 no-scrollbar">
                                    {(['linkedin', 'github', 'twitter', 'instagram', 'facebook', 'youtube', 'website'] as const).map(platform => (
                                        <div key={platform} className="flex items-center gap-2">
                                            <div className="w-8 shrink-0 text-gray-500 capitalize text-xs font-bold">{platform}</div>
                                            <input
                                                type="text"
                                                className="flex-1 bg-black border border-white/10 rounded-lg p-2 text-white text-xs focus:border-neon-purple outline-none"
                                                value={socials[platform]}
                                                onChange={e => setSocials({ ...socials, [platform]: e.target.value })}
                                                placeholder={`URL for ${platform}...`}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">AI Summary (For Voice)</label>
                                    <button
                                        onClick={generateAiSummary}
                                        disabled={generating}
                                        className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                    >
                                        {generating ? <span className="animate-spin">⏳</span> : <span>✨ Generate with AI</span>}
                                    </button>
                                </div>
                                <div>
                                    <textarea
                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-indigo-400 outline-none"
                                        rows={2}
                                        value={editSummary}
                                        onChange={e => setEditSummary(e.target.value)}
                                        placeholder="Summary for AI voice..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8 pt-4 border-t border-white/10">
                            <button onClick={() => setShowEditProfile(false)} className="flex-1 py-3 text-sm font-bold text-gray-400 hover:bg-white/5 rounded-lg">Cancel</button>
                            <button
                                onClick={handleUpdateProfile}
                                disabled={saving}
                                className="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white rounded-lg hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : saved ? (
                                    <>
                                        <Check size={18} className="text-green-400" />
                                        Saved!
                                    </>
                                ) : (
                                    'Save Full Profile'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD CERTIFICATE MODAL */}
            {showAddCert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111] w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-4">Add Certificate</h2>
                        <div className="space-y-4">
                            <input type="text" placeholder="Title (e.g. React Native Expert)" className="w-full bg-black p-3 rounded-lg border border-white/10 text-sm outline-none focus:border-neon-purple" value={newCertTitle} onChange={e => setNewCertTitle(e.target.value)} />
                            <input type="text" placeholder="Issuer (e.g. Meta, Google)" className="w-full bg-black p-3 rounded-lg border border-white/10 text-sm outline-none focus:border-neon-purple" value={newCertIssuer} onChange={e => setNewCertIssuer(e.target.value)} />
                            <input type="text" placeholder="Date (e.g. Jan 2025)" className="w-full bg-black p-3 rounded-lg border border-white/10 text-sm outline-none focus:border-neon-purple" value={newCertDate} onChange={e => setNewCertDate(e.target.value)} />

                            {/* File Input for Certificate */}
                            <div className="border border-dashed border-white/20 rounded-lg p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept="image/*,.pdf"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            const r = new FileReader();
                                            r.onload = () => setNewCertFile(r.result as string);
                                            r.readAsDataURL(f);
                                        }
                                    }}
                                />
                                {newCertFile ? (
                                    <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                                        <Check size={16} /> File Selected
                                    </div>
                                ) : (
                                    <div className="text-gray-500 text-xs">
                                        <p className="font-bold mb-1">Upload Certificate</p>
                                        <p>Click or Drag file here</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowAddCert(false)} className="flex-1 py-2 text-sm text-gray-400">Cancel</button>
                                <button onClick={handleAddCertificate} className="flex-1 py-2 bg-neon-purple text-white rounded-lg text-sm font-bold">Add</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ADD BADGE MODAL */}
            {showAddBadge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111] w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-4">Add New Badge</h2>
                        <div className="space-y-4">
                            <input type="text" placeholder="Badge Name (e.g. Verified Creator)" className="w-full bg-black p-3 rounded-lg border border-white/10 text-sm outline-none focus:border-yellow-500" value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)} />

                            {/* Badge Image Input */}
                            <div className="border border-dashed border-white/20 rounded-lg p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            const r = new FileReader();
                                            r.onload = () => setNewBadgeImage(r.result as string);
                                            r.readAsDataURL(f);
                                        }
                                    }}
                                />
                                {newBadgeImage ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <img src={newBadgeImage} className="w-12 h-12 object-contain" />
                                        <span className="text-green-400 text-xs">Selected</span>
                                    </div>
                                ) : (
                                    <div className="text-gray-500 text-xs">
                                        <Award size={24} className="mx-auto mb-2 opacity-50" />
                                        <p>Upload Badge Icon</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowAddBadge(false)} className="flex-1 py-2 text-sm text-gray-400">Cancel</button>
                                <button onClick={handleAddBadge} className="flex-1 py-2 bg-yellow-500 text-black rounded-lg text-sm font-bold">Add</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* TEAM MANAGER MODAL */}
            {
                showTeamManager && selectedTeam && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <div className="bg-[#111] w-full max-w-5xl h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden">
                            {/* LEFT SIDEBAR */}
                            <div className="w-64 bg-[#0a0a0f] border-r border-white/10 flex flex-col">
                                <div className="p-4 border-b border-white/10">
                                    <h3 className="font-bold text-white truncate">{selectedTeam.name}</h3>
                                    <p className="text-xs text-gray-500 truncate">{selectedTeam.members.length} Members</p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                                    <div>
                                        <h4 className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Channels</h4>
                                        <button onClick={() => { setChatMode('group'); setChatPartner(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${chatMode === 'group' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-white/5'}`}>
                                            <div className="p-1 bg-white/10 rounded"><Users size={12} /></div> General Channel
                                        </button>
                                    </div>
                                    <div>
                                        <h4 className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Direct Messages</h4>
                                        <div className="space-y-1">
                                            {selectedTeam.members.filter(m => m.userId !== userData._id).map(member => (
                                                <button key={member.userId} onClick={() => { setChatMode('dm'); setChatPartner(member); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${chatMode === 'dm' && chatPartner?.userId === member.userId ? 'bg-purple-600/20 text-purple-400' : 'text-gray-400 hover:bg-white/5'}`}>
                                                    <div className="w-6 h-6 rounded-full bg-gray-800 overflow-hidden shrink-0">{member.profilePic ? <img src={member.profilePic} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-[9px]">{member.name[0]}</span>}</div>
                                                    <span className="truncate">{member.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 border-t border-white/10 bg-[#050508] space-y-2">
                                    <button onClick={handleExportChat} className="w-full py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 rounded-lg flex items-center justify-center gap-2"><Download size={12} /> Export Chat</button>
                                </div>
                            </div>

                            {/* RIGHT MAIN */}
                            <div className="flex-1 flex flex-col bg-[#111]">
                                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151515]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-full text-gray-400">{chatMode === 'group' ? <Users size={18} /> : <MessageCircle size={18} />}</div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{chatMode === 'group' ? 'General Team Chat' : chatPartner?.name}</h3>
                                            <p className="text-xs text-gray-500">{chatMode === 'group' ? `${selectedTeam.members.length} participants` : 'Private Conversation'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowTeamManager(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0a0a0f] relative no-scrollbar">
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                                    {messages.length > 0 ? (
                                        messages.map((msg, idx) => {
                                            const isMe = msg.senderId === userData._id;
                                            const showHeader = idx === 0 || messages[idx - 1].senderId !== msg.senderId || (new Date(msg.timestamp).getTime() - new Date(messages[idx - 1].timestamp).getTime() > 60000);
                                            return (
                                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    {!isMe && showHeader && <div className="flex items-center gap-2 mb-1 ml-1"><span className="text-[10px] text-gray-400 font-bold">{msg.senderName}</span></div>}
                                                    <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#222] text-gray-200 border border-white/10 rounded-bl-none'}`}>{msg.content}</div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500/30">
                                            <MessageSquare size={48} className="mb-4" />
                                            <p>No messages yet.</p>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="p-4 border-t border-white/10 bg-[#151515]">
                                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-4 bg-[#0a0a0f] border border-white/10 rounded-xl p-2 pl-4">
                                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none text-white text-sm" />
                                        <button type="submit" disabled={!newMessage.trim()} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"><Send size={16} /></button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Hidden Bot Icon import for layout if missing */}
            <div className="hidden"><span className="hidden">Placeholder</span></div>
        </div >
    );
}

// Bot Icon helper if not imported
function Bot(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>;
}
