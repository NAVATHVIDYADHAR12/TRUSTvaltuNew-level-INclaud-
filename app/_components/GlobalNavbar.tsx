"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, User, LogIn, LayoutDashboard, X, Video, Eye, EyeOff, Monitor, Lock, Unlock, VideoOff, Tv, Fingerprint, Activity } from 'lucide-react';

const GlobalNavbar = () => {
    const [isDRMModalOpen, setIsDRMModalOpen] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [scrolled, setScrolled] = useState(false);
    const [drmSettings, setDrmSettings] = useState({
        screenshotBlocking: true,
        tabFocusProtection: true,
        devToolsDetection: true,
        rightClickDisable: true,
        screenRecordingBlock: true,
        watermarkOverlay: true,
        forensicWatermark: true,
        mediaRecorderBlock: true,
        pipBlock: true,
        heartbeatProtection: true
    });

    // Load settings from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('drmSettings');
            if (saved) {
                setDrmSettings(JSON.parse(saved));
            }
        }
    }, []);

    // Save settings to localStorage
    const updateSetting = (key: keyof typeof drmSettings, value: boolean) => {
        const newSettings = { ...drmSettings, [key]: value };
        setDrmSettings(newSettings);
        localStorage.setItem('drmSettings', JSON.stringify(newSettings));
        localStorage.setItem('drmProtectionEnabled', newSettings.screenshotBlocking ? 'true' : 'false');

        // Dispatch custom event immediately so Zoom room updates in real-time
        window.dispatchEvent(new CustomEvent('drmSettingsChanged', { detail: newSettings }));
    };

    // Scroll tracking for hide/show and glassmorphism
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Update scrolled state for background
            setScrolled(currentScrollY > 20);

            // Hide navbar when scrolling down, show when scrolling up
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setVisible(true);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // Mouse tracking for liquid glass bubble
    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Close modal and dispatch event for immediate refresh in Zoom room
    const closeModal = () => {
        setIsDRMModalOpen(false);
        // Dispatch event to notify Zoom room to refresh settings
        window.dispatchEvent(new CustomEvent('drmSettingsChanged', { detail: drmSettings }));
    };

    return (
        <>
            <nav
                onMouseMove={handleMouseMove}
                className={`h-20 border-b flex items-center justify-between px-4 z-50 fixed w-full top-0 left-0 transition-all duration-500 ease-in-out ${scrolled
                    ? 'bg-[#0a0a0f]/80 backdrop-blur-xl border-white/5'
                    : 'bg-[#0a0a0f]/95 backdrop-blur-xl border-white/5'
                    } ${visible ? 'translate-y-0' : '-translate-y-full'}`}
            >
                {/* Liquid Glass Bubble Effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div
                        className="absolute bg-brand-cyan/20 rounded-full blur-[40px] mix-blend-screen"
                        animate={{
                            x: mousePos.x - 75,
                            y: mousePos.y - 75,
                            opacity: 1
                        }}
                        transition={{ type: "tween", ease: "backOut", duration: 0.5 }}
                        style={{ width: 150, height: 150 }}
                    />
                </div>
                {/* Left: Logo & Primary Nav */}
                <div className="flex items-center gap-8 relative z-10">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group py-2">
                        <img
                            src="/TheLOGO!.png"
                            alt="CreatorSecure"
                            className="w-auto h-[45px] object-contain hover:scale-105 transition-transform duration-500"
                        />
                    </Link>

                    {/* Divider */}
                    <div className="h-6 w-px bg-white/10 hidden md:block" />

                    {/* Primary Links */}
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
                        <Link href="/" className="hover:text-white transition-colors relative group">
                            Home
                            <span className="absolute -bottom-4 left-0 w-0 h-0.5 bg-brand-blue group-hover:w-full transition-all duration-300"></span>
                        </Link>
                        <Link href="/#features" className="hover:text-white transition-colors relative group">
                            Features
                            <span className="absolute -bottom-4 left-0 w-0 h-0.5 bg-brand-blue group-hover:w-full transition-all duration-300"></span>
                        </Link>
                        <Link href="/#drm" className="hover:text-white transition-colors relative group">
                            Security
                            <span className="absolute -bottom-4 left-0 w-0 h-0.5 bg-brand-blue group-hover:w-full transition-all duration-300"></span>
                        </Link>

                        <div className="h-4 w-px bg-white/10 mx-2" />

                        {/* Tools Links */}
                        <div className="flex items-center gap-4">
                            <Link href="/search" className="hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5">
                                Search Freelancers
                            </Link>
                            <Link href="/zoom" className="hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5">
                                <Video className="w-4 h-4 text-brand-blue" />
                                Secure Zoom
                            </Link>
                            <button
                                onClick={() => setIsDRMModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-xs font-semibold uppercase tracking-wide mr-[45px]"
                            >
                                <Shield className="w-3.5 h-3.5" />
                                DRM
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Role Switcher & User Actions */}
                <div className="flex items-center gap-6">
                    {/* Role Switcher */}
                    <div className="hidden xl:flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
                        <Link
                            href="/connect/client"
                            className="px-4 py-1.5 rounded-md text-xs font-semibold text-gray-400 hover:text-white hover:bg-brand-blue/10 hover:border-brand-blue/20 transition-all"
                        >
                            Client View
                        </Link>
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <Link
                            href="/connect/creator"
                            className="px-4 py-1.5 rounded-md text-xs font-semibold text-gray-400 hover:text-white hover:bg-brand-violet/10 hover:border-brand-violet/20 transition-all"
                        >
                            Creator View
                        </Link>
                    </div>

                    <div className="h-6 w-px bg-white/10 hidden xl:block" />

                    {/* User Actions */}
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                        <Link href="/profile" className="flex items-center gap-2 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full" title="Profile">
                            <User className="w-5 h-5" />
                        </Link>
                        <Link href="/auth/signin" className="flex items-center gap-2 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full" title="Sign In">
                            <LogIn className="w-5 h-5" />
                        </Link>
                        <Link href="/admin" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] hover:bg-white/10 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] hover:border-white/20 transition-all text-white text-xs font-bold uppercase tracking-wider group">
                            <LayoutDashboard className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                            Admin
                        </Link>
                    </div>
                </div>
            </nav>
            {/* Spacer for fixed navbar */}
            <div className="h-20" />

            {/* DRM Settings Modal */}
            {isDRMModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#111] w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col relative">
                        {/* Floating Close Button - Always Visible */}
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-gray-400 hover:text-white transition-all"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-600/10 to-blue-600/10 flex-shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white pr-10">
                                <Shield className="w-5 h-5 text-purple-500" />
                                DRM Protection Settings
                            </h2>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <p className="text-sm text-gray-400 mb-4">
                                Configure Netflix-like protection for your video calls and content. These settings apply to all Secure Zoom sessions.
                            </p>

                            {/* Screenshot Blocking */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.screenshotBlocking ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                        {drmSettings.screenshotBlocking ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">Screenshot Blocking</h3>
                                        <p className="text-xs text-gray-500">CSS-based capture prevention</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('screenshotBlocking', !drmSettings.screenshotBlocking)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.screenshotBlocking ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.screenshotBlocking ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Tab Focus Protection */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.tabFocusProtection ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                        {drmSettings.tabFocusProtection ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">Tab Focus Protection</h3>
                                        <p className="text-xs text-gray-500">Pause video when tab loses focus</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('tabFocusProtection', !drmSettings.tabFocusProtection)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.tabFocusProtection ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.tabFocusProtection ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* DevTools Detection */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.devToolsDetection ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                        <Monitor className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">DevTools Detection</h3>
                                        <p className="text-xs text-gray-500">Warn when developer tools open</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('devToolsDetection', !drmSettings.devToolsDetection)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.devToolsDetection ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.devToolsDetection ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Right-Click Disable */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.rightClickDisable ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">Right-Click Disable</h3>
                                        <p className="text-xs text-gray-500">Block context menu</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('rightClickDisable', !drmSettings.rightClickDisable)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.rightClickDisable ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.rightClickDisable ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Block Screen Recording - Netflix Style */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-600/10 to-purple-600/10 rounded-xl border border-red-500/20">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.screenRecordingBlock ? 'bg-red-600/30 text-red-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        <VideoOff className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Block Screen Recording
                                            <span className="text-[10px] px-1.5 py-0.5 bg-red-600/30 text-red-400 rounded-full">Netflix-Style</span>
                                        </h3>
                                        <p className="text-xs text-gray-500">Hardware-accelerated black frame on capture</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('screenRecordingBlock', !drmSettings.screenRecordingBlock)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.screenRecordingBlock ? 'bg-red-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.screenRecordingBlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Watermark Overlay - NEW */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 rounded-xl border border-yellow-500/20">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.watermarkOverlay ? 'bg-yellow-600/30 text-yellow-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        <Tv className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Enable Watermark Overlay
                                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-600/30 text-yellow-400 rounded-full">Real-time</span>
                                        </h3>
                                        <p className="text-xs text-gray-500">Show visible "PROTECTED" watermark on video</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('watermarkOverlay', !drmSettings.watermarkOverlay)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.watermarkOverlay ? 'bg-yellow-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.watermarkOverlay ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Advanced DRM Section Header */}
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Advanced DRM Protection (Netflix-Level)
                                </h3>
                            </div>

                            {/* Forensic Watermark */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-600/10 to-blue-600/10 rounded-xl border border-cyan-500/20">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.forensicWatermark ? 'bg-cyan-600/30 text-cyan-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        <Fingerprint className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Forensic Watermark
                                            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-600/30 text-cyan-400 rounded-full">Invisible</span>
                                        </h3>
                                        <p className="text-xs text-gray-500">Embed invisible user ID in video frames</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('forensicWatermark', !drmSettings.forensicWatermark)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.forensicWatermark ? 'bg-cyan-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.forensicWatermark ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* MediaRecorder Block */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-600/10 to-rose-600/10 rounded-xl border border-pink-500/20">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.mediaRecorderBlock ? 'bg-pink-600/30 text-pink-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        <VideoOff className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Block MediaRecorder API
                                            <span className="text-[10px] px-1.5 py-0.5 bg-pink-600/30 text-pink-400 rounded-full">Browser API</span>
                                        </h3>
                                        <p className="text-xs text-gray-500">Disable browser recording APIs</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('mediaRecorderBlock', !drmSettings.mediaRecorderBlock)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.mediaRecorderBlock ? 'bg-pink-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.mediaRecorderBlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* PiP Block */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.pipBlock ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                        <Tv className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">Block Picture-in-Picture</h3>
                                        <p className="text-xs text-gray-500">Prevent PiP mode for video capture</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('pipBlock', !drmSettings.pipBlock)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.pipBlock ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.pipBlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Heartbeat Protection */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 rounded-xl border border-emerald-500/20">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${drmSettings.heartbeatProtection ? 'bg-emerald-600/30 text-emerald-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Heartbeat Protection
                                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600/30 text-emerald-400 rounded-full">Anti-Tamper</span>
                                        </h3>
                                        <p className="text-xs text-gray-500">Detect debugging and tampering attempts</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('heartbeatProtection', !drmSettings.heartbeatProtection)}
                                    className={`w-12 h-6 rounded-full transition-all ${drmSettings.heartbeatProtection ? 'bg-emerald-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.heartbeatProtection ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-[#0a0a0f]">
                            <p className="text-xs text-gray-500 text-center">
                                🔒 Advanced DRM enabled! Session-level protection active with forensic tracking.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalNavbar;
