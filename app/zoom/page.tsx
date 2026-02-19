"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlobalNavbar from '../_components/GlobalNavbar';
import { Video, Plus, Users, ArrowRight, Camera, CameraOff, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

// Simple ID generator
const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function ZoomLobbyPage() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [roomCode, setRoomCode] = useState('');
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Camera preview
    const toggleCamera = async () => {
        if (cameraEnabled && stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setCameraEnabled(false);
        } else {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                setCameraEnabled(true);
            } catch (err) {
                console.error('Camera access denied:', err);
                alert('Camera access denied. Please enable camera permissions.');
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const handleCreateRoom = () => {
        const newRoomId = generateRoomId();
        // Mark this browser as the host for this room
        localStorage.setItem(`zoom_host_${newRoomId}`, 'true');
        router.push(`/zoom/${newRoomId}`);
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomCode.trim()) {
            router.push(`/zoom/${roomCode.trim().toUpperCase()}`);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
            <GlobalNavbar />

            <main className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 rounded-full text-sm font-medium mb-6 border border-blue-600/20"
                    >
                        <Shield className="w-4 h-4" />
                        DRM Protected Video Conferencing
                    </motion.div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
                        Secure Video Meetings
                    </h1>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        Start or join encrypted video calls with automatic recording, invite links, and Netflix-like DRM protection.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Camera Preview */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden"
                    >
                        <div className="relative aspect-video bg-black flex items-center justify-center">
                            {cameraEnabled ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p>Camera Preview Off</p>
                                </div>
                            )}
                            <button
                                onClick={toggleCamera}
                                className={`absolute bottom-4 right-4 p-3 rounded-full transition-all ${cameraEnabled
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-white/10 hover:bg-white/20'
                                    }`}
                            >
                                {cameraEnabled ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="p-4 text-center text-sm text-gray-400">
                            Check your camera before joining
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        {/* Create Room */}
                        <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-500" />
                                Start New Meeting
                            </h2>
                            <p className="text-gray-400 text-sm mb-6">
                                Create a new secure room and get a shareable invite link.
                            </p>
                            <button
                                onClick={handleCreateRoom}
                                className="w-full py-4 bg-gradient-to-r from-green-400 via-cyan-400 to-cyan-500 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-cyan-400/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Video className="w-5 h-5" />
                                Create Room
                            </button>
                        </div>

                        {/* Join Room */}
                        <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-green-500" />
                                Join Existing Meeting
                            </h2>
                            <form onSubmit={handleJoinRoom} className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Enter Room Code (e.g., ABC123)"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-white uppercase tracking-widest text-center text-lg"
                                    maxLength={6}
                                />
                                <button
                                    type="submit"
                                    disabled={!roomCode.trim()}
                                    className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                                >
                                    Join Room
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </form>
                        </div>

                        {/* DRM Notice */}
                        <div className="bg-purple-600/10 p-4 rounded-xl border border-purple-600/20 text-sm text-purple-300 flex items-start gap-3">
                            <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <strong>DRM Protection Active</strong>
                                <p className="text-purple-400/80 mt-1">
                                    All sessions are encrypted with screenshot/recording blocking. Configure in DRM Settings.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
