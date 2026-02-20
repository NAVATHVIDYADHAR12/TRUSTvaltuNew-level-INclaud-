"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, User, LogIn, LayoutDashboard, X, Video, Eye, EyeOff, Monitor, Lock, Unlock, VideoOff, Tv, Fingerprint, Activity } from 'lucide-react';

// ── Recording watermark config ────────────────────────────────────────────────
export interface RecordingWmConfig {
    // ── Text layer ───────────────────────────────────────────────────────
    text: string;        // custom text, '' = session fingerprint
    fontSize: number;    // 10-48 px
    color: string;       // hex
    opacity: number;     // 0.1 – 1.0
    bgColor: string;     // hex
    bgOpacity: number;   // 0 = transparent (no pill)
    rotation: number;    // -90 to 90 °
    repeat: boolean;
    spacingX: number;    // tile spacing X  (repeat mode)
    spacingY: number;    // tile spacing Y  (repeat mode)
    offsetX: number;     // % from centre   (single mode)
    offsetY: number;     // % from centre   (single mode)
    // ── Logo layer (independent of text) ────────────────────────────────
    logoDataUrl: string; // base64 data URL, '' = none
    logoSize: number;    // 16 – 120 px
    logoOpacity: number; // 0.1 – 1.0
    logoOffsetX: number; // % from centre X (single mode)
    logoOffsetY: number; // % from centre Y (single mode)
    logoRepeat: boolean;
    logoSpacingX: number;// tile spacing X  (logo repeat)
    logoSpacingY: number;// tile spacing Y  (logo repeat)
    logoRotation: number;// -90 to 90 ° (independent)
}
export const DEFAULT_REC_WM: RecordingWmConfig = {
    text: '', fontSize: 20, color: '#ffffff', opacity: 0.85,
    bgColor: '#000000', bgOpacity: 0.65, rotation: -30,
    repeat: true, spacingX: 380, spacingY: 120,
    offsetX: 0, offsetY: 0,
    logoDataUrl: '', logoSize: 48, logoOpacity: 0.85,
    logoOffsetX: 0, logoOffsetY: 0,
    logoRepeat: false, logoSpacingX: 300, logoSpacingY: 200, logoRotation: 0,
};

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
        screenMonitorBlock: false,
        blockAllKeys: false,
        // Per-key blockers (sub-options under screenRecordingBlock)
        blockShiftKey: false,
        blockWinKey: false,
        blockCtrlKey: false,
        blockAltKey: false,
        blockRKey: false,
        blockTabKey: false,
        watermarkOverlay: true,
        forensicWatermark: true,
        mediaRecorderBlock: true,
        pipBlock: true,
        heartbeatProtection: true
    });

    const [recWmConfig, setRecWmConfig] = useState<RecordingWmConfig>(DEFAULT_REC_WM);
    const [showRecWm, setShowRecWm] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('drmSettings');
            // Merge with current defaults so newly-added keys (blockShiftKey etc.) are
            // always present even if the saved object predates them.
            if (saved) setDrmSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            const savedRec = localStorage.getItem('recWmConfig');
            if (savedRec) {
                try { setRecWmConfig({ ...DEFAULT_REC_WM, ...JSON.parse(savedRec) }); } catch (_) {}
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

    const updateRecWm = (updates: Partial<RecordingWmConfig>) => {
        const newCfg = { ...recWmConfig, ...updates };
        setRecWmConfig(newCfg);
        try { localStorage.setItem('recWmConfig', JSON.stringify(newCfg)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('recWmConfigChanged', { detail: newCfg }));
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
                            <div className={`flex flex-col p-4 bg-gradient-to-r from-red-600/10 to-purple-600/10 rounded-xl border transition-all ${drmSettings.screenRecordingBlock ? 'border-red-500/40' : 'border-red-500/20'}`}>
                                {/* Main row */}
                                <div className="flex items-center justify-between">
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
                                        className={`w-12 h-6 rounded-full transition-all shrink-0 ${drmSettings.screenRecordingBlock ? 'bg-red-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.screenRecordingBlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>

                                {/* Per-key sub-options — only visible when main toggle is ON */}
                                {drmSettings.screenRecordingBlock && (
                                    <div className="mt-3 pt-3 border-t border-red-500/20">

                                        {/* ── MASTER: Block ALL keys for participants ── */}
                                        <button
                                            onClick={() => updateSetting('blockAllKeys', !drmSettings.blockAllKeys)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-3 transition-all ${
                                                drmSettings.blockAllKeys
                                                    ? 'bg-red-700/25 border-red-500/60 text-red-200'
                                                    : 'bg-white/4 border-white/10 text-gray-400 hover:border-red-500/30 hover:text-gray-300'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${drmSettings.blockAllKeys ? 'bg-red-600 border-red-400' : 'border-gray-500'}`}>
                                                {drmSettings.blockAllKeys && (
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[12px] font-bold leading-none">Block ALL Keys — Participants</span>
                                                    <span className="text-[8px] px-1.5 py-0.5 bg-red-800/60 text-red-300 rounded font-semibold">MASTER LOCK</span>
                                                </div>
                                                <p className="text-[9px] mt-0.5 leading-snug opacity-70">
                                                    {drmSettings.blockAllKeys
                                                        ? '🔒 ALL participant keyboard input blocked — only host can type'
                                                        : 'Enable to fully lock ALL keyboard keys for every participant'}
                                                </p>
                                            </div>
                                        </button>

                                        {/* Auto-active notice */}
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                            <p className="text-[10px] text-red-400/80 font-medium leading-snug">
                                                Recording combos auto-blocked. Check to <span className="text-red-300">also block standalone key press</span>:
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {([
                                                { key: 'blockShiftKey', label: 'Shift',        autoHint: 'Auto: Shift+Win/Alt blocked', warn: 'Blocks ALL Shift+key (no CAPS)' },
                                                { key: 'blockWinKey',   label: 'Windows / ⌘',  autoHint: 'Auto: Win+key blocked',       warn: 'Blocks Win+anything' },
                                                { key: 'blockCtrlKey',  label: 'Ctrl',          autoHint: 'Auto: Ctrl+Shift blocked',    warn: 'Blocks ALL Ctrl+key (no Ctrl+C)' },
                                                { key: 'blockAltKey',   label: 'Alt',           autoHint: 'Auto: Alt+Shift/Win blocked', warn: 'Blocks ALL Alt+key' },
                                                { key: 'blockRKey',     label: 'R key',         autoHint: 'Blocks R (Shift+Win+R)',      warn: 'R key fully blocked' },
                                                { key: 'blockTabKey',   label: 'Tab',           autoHint: 'Auto: Tab fully blocked',     warn: 'Tab already blocked by auto' },
                                            ] as { key: keyof typeof drmSettings; label: string; autoHint: string; warn: string }[]).map(({ key, label, autoHint, warn }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => updateSetting(key, !drmSettings[key])}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                                                        drmSettings[key]
                                                            ? 'bg-red-600/20 border-red-500/50 text-red-300'
                                                            : 'bg-white/3 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400'
                                                    }`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${drmSettings[key] ? 'bg-red-500 border-red-400' : 'border-gray-600'}`}>
                                                        {drmSettings[key] && (
                                                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <span className="text-[11px] font-semibold leading-none">{label}</span>
                                                            <span className="text-[8px] px-1 py-0.5 bg-red-900/50 text-red-400/80 rounded leading-none font-medium">AUTO</span>
                                                        </div>
                                                        <div className="text-[9px] text-gray-600 leading-none mt-0.5 truncate">{drmSettings[key] ? warn : autoHint}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-amber-700/80 mt-2.5 leading-relaxed">
                                            ⚠ Standalone blocking disables normal keyboard use (Shift = no CAPS, Ctrl = no copy/paste). Use only for max lockdown.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Screen Activity Monitor */}
                            <div className={`flex flex-col p-4 bg-gradient-to-r from-orange-600/10 to-amber-600/10 rounded-xl border transition-all ${drmSettings.screenMonitorBlock ? 'border-orange-500/40' : 'border-orange-500/20'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${drmSettings.screenMonitorBlock ? 'bg-orange-600/30 text-orange-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                            <Eye className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-white flex items-center gap-2">
                                                Screen Activity Monitor
                                                <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-400 rounded-full">Smart Detect</span>
                                            </h3>
                                            <p className="text-xs text-gray-500">Scans screen for recording indicators → auto black overlay</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => updateSetting('screenMonitorBlock', !drmSettings.screenMonitorBlock)}
                                        className={`w-12 h-6 rounded-full transition-all shrink-0 ${drmSettings.screenMonitorBlock ? 'bg-orange-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${drmSettings.screenMonitorBlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                {drmSettings.screenMonitorBlock && (
                                    <div className="mt-2.5 pt-2.5 border-t border-orange-500/20">
                                        <p className="text-[10px] text-orange-400/80 leading-relaxed">
                                            ⚡ Browser will ask you to <span className="text-orange-300 font-semibold">share your screen</span> — select your full display. The app scans for red recording-indicator dots (Xbox Game Bar, OBS, Bandicam). When detected, video blacks out automatically.
                                        </p>
                                    </div>
                                )}
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

                            {/* Recording Watermark Customisation Panel */}
                            {drmSettings.watermarkOverlay && (
                                <div className="bg-orange-950/20 border border-orange-500/10 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setShowRecWm(p => !p)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                                    >
                                        <span className="font-medium">🎬 Recording Watermark Settings</span>
                                        <span className="text-orange-600 text-xs">{showRecWm ? '▲ Hide' : '▼ Customize'}</span>
                                    </button>

                                    {showRecWm && (
                                        <div className="px-4 pb-4 space-y-4 border-t border-orange-500/10">
                                            {/* Custom text */}
                                            <div className="pt-3">
                                                <label className="text-xs text-gray-400 mb-1 block">Custom Text <span className="text-gray-600">(empty = session fingerprint)</span></label>
                                                <input type="text" value={recWmConfig.text}
                                                    onChange={e => updateRecWm({ text: e.target.value })}
                                                    placeholder="e.g. CONFIDENTIAL • My Company"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                                            </div>

                                            {/* Text color + opacity */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-2 block">Text Color</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={recWmConfig.color}
                                                            onChange={e => updateRecWm({ color: e.target.value })}
                                                            className="w-9 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                                                        <code className="text-xs text-gray-500">{recWmConfig.color}</code>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">Opacity: {Math.round(recWmConfig.opacity * 100)}%</label>
                                                    <input type="range" min="0.1" max="1" step="0.05" value={recWmConfig.opacity}
                                                        onChange={e => updateRecWm({ opacity: parseFloat(e.target.value) })}
                                                        className="w-full accent-orange-500 mt-2" />
                                                </div>
                                            </div>

                                            {/* Font size + rotation */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">Font Size: {recWmConfig.fontSize}px</label>
                                                    <input type="range" min="10" max="48" step="1" value={recWmConfig.fontSize}
                                                        onChange={e => updateRecWm({ fontSize: parseInt(e.target.value) })}
                                                        className="w-full accent-orange-500 mt-2" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">Rotation: {recWmConfig.rotation}°</label>
                                                    <input type="range" min="-90" max="90" step="5" value={recWmConfig.rotation}
                                                        onChange={e => updateRecWm({ rotation: parseInt(e.target.value) })}
                                                        className="w-full accent-orange-500 mt-2" />
                                                </div>
                                            </div>

                                            {/* Background */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-2 block">BG Color</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={recWmConfig.bgColor}
                                                            onChange={e => updateRecWm({ bgColor: e.target.value })}
                                                            className="w-9 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                                                        <code className="text-xs text-gray-500">{recWmConfig.bgColor}</code>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">BG Opacity: {Math.round(recWmConfig.bgOpacity * 100)}% {recWmConfig.bgOpacity === 0 && <span className="text-orange-600">(transparent)</span>}</label>
                                                    <input type="range" min="0" max="1" step="0.05" value={recWmConfig.bgOpacity}
                                                        onChange={e => updateRecWm({ bgOpacity: parseFloat(e.target.value) })}
                                                        className="w-full accent-orange-500 mt-2" />
                                                </div>
                                            </div>

                                            {/* Repeat toggle */}
                                            <div className="flex items-center justify-between py-1">
                                                <span className="text-xs text-gray-400 font-medium">Repeat Watermark (tile pattern)</span>
                                                <button onClick={() => updateRecWm({ repeat: !recWmConfig.repeat })}
                                                    className={`w-10 h-5 rounded-full transition-all ${recWmConfig.repeat ? 'bg-orange-500' : 'bg-gray-600'}`}>
                                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${recWmConfig.repeat ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {recWmConfig.repeat ? (
                                                /* Spacing controls */
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Spacing X: {recWmConfig.spacingX}px</label>
                                                        <input type="range" min="150" max="700" step="10" value={recWmConfig.spacingX}
                                                            onChange={e => updateRecWm({ spacingX: parseInt(e.target.value) })}
                                                            className="w-full accent-orange-500 mt-1" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Spacing Y: {recWmConfig.spacingY}px</label>
                                                        <input type="range" min="50" max="400" step="10" value={recWmConfig.spacingY}
                                                            onChange={e => updateRecWm({ spacingY: parseInt(e.target.value) })}
                                                            className="w-full accent-orange-500 mt-1" />
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Single-position offset */
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Position X: {recWmConfig.offsetX > 0 ? '+' : ''}{recWmConfig.offsetX}%</label>
                                                        <input type="range" min="-45" max="45" step="1" value={recWmConfig.offsetX}
                                                            onChange={e => updateRecWm({ offsetX: parseInt(e.target.value) })}
                                                            className="w-full accent-orange-500 mt-1" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Position Y: {recWmConfig.offsetY > 0 ? '+' : ''}{recWmConfig.offsetY}%</label>
                                                        <input type="range" min="-45" max="45" step="1" value={recWmConfig.offsetY}
                                                            onChange={e => updateRecWm({ offsetY: parseInt(e.target.value) })}
                                                            className="w-full accent-orange-500 mt-1" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Logo upload */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs text-gray-400 font-medium">Logo / Brand Image</label>
                                                    <div className="flex items-center gap-2">
                                                        <label className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 cursor-pointer hover:bg-white/10 transition-colors">
                                                            {recWmConfig.logoDataUrl ? '✓ Change' : '+ Upload'}
                                                            <input type="file" accept="image/*" className="hidden"
                                                                onChange={e => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;
                                                                    const reader = new FileReader();
                                                                    reader.onload = () => updateRecWm({ logoDataUrl: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }} />
                                                        </label>
                                                        {recWmConfig.logoDataUrl && (
                                                            <>
                                                                <img src={recWmConfig.logoDataUrl} alt="logo" className="w-7 h-7 object-contain rounded bg-white/5" />
                                                                <button onClick={() => updateRecWm({ logoDataUrl: '', logoSize: 48 })} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {recWmConfig.logoDataUrl && (
                                                    <div className="bg-white/5 rounded-xl p-3 space-y-3 border border-white/5">
                                                        {/* Size + Opacity */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs text-gray-400 mb-1 block">Size: {recWmConfig.logoSize}px</label>
                                                                <input type="range" min="16" max="120" step="4" value={recWmConfig.logoSize}
                                                                    onChange={e => updateRecWm({ logoSize: parseInt(e.target.value) })}
                                                                    className="w-full accent-orange-500" />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-gray-400 mb-1 block">Opacity: {Math.round(recWmConfig.logoOpacity * 100)}%</label>
                                                                <input type="range" min="0.1" max="1" step="0.05" value={recWmConfig.logoOpacity}
                                                                    onChange={e => updateRecWm({ logoOpacity: parseFloat(e.target.value) })}
                                                                    className="w-full accent-orange-500" />
                                                            </div>
                                                        </div>

                                                        {/* Rotation */}
                                                        <div>
                                                            <label className="text-xs text-gray-400 mb-1 block">Rotation: {recWmConfig.logoRotation}°</label>
                                                            <input type="range" min="-90" max="90" step="5" value={recWmConfig.logoRotation}
                                                                onChange={e => updateRecWm({ logoRotation: parseInt(e.target.value) })}
                                                                className="w-full accent-orange-500" />
                                                        </div>

                                                        {/* Repeat toggle */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-400 font-medium">Repeat Logo (tile pattern)</span>
                                                            <button onClick={() => updateRecWm({ logoRepeat: !recWmConfig.logoRepeat })}
                                                                className={`w-10 h-5 rounded-full transition-all ${recWmConfig.logoRepeat ? 'bg-orange-500' : 'bg-gray-600'}`}>
                                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${recWmConfig.logoRepeat ? 'translate-x-5' : 'translate-x-0'}`} />
                                                            </button>
                                                        </div>

                                                        {recWmConfig.logoRepeat ? (
                                                            /* Logo spacing */
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-xs text-gray-400 mb-1 block">Spacing X: {recWmConfig.logoSpacingX}px</label>
                                                                    <input type="range" min="80" max="600" step="10" value={recWmConfig.logoSpacingX}
                                                                        onChange={e => updateRecWm({ logoSpacingX: parseInt(e.target.value) })}
                                                                        className="w-full accent-orange-500 mt-1" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-gray-400 mb-1 block">Spacing Y: {recWmConfig.logoSpacingY}px</label>
                                                                    <input type="range" min="50" max="400" step="10" value={recWmConfig.logoSpacingY}
                                                                        onChange={e => updateRecWm({ logoSpacingY: parseInt(e.target.value) })}
                                                                        className="w-full accent-orange-500 mt-1" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Logo X/Y offset */
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-xs text-gray-400 mb-1 block">Position X: {recWmConfig.logoOffsetX > 0 ? '+' : ''}{recWmConfig.logoOffsetX}%</label>
                                                                    <input type="range" min="-45" max="45" step="1" value={recWmConfig.logoOffsetX}
                                                                        onChange={e => updateRecWm({ logoOffsetX: parseInt(e.target.value) })}
                                                                        className="w-full accent-orange-500 mt-1" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-gray-400 mb-1 block">Position Y: {recWmConfig.logoOffsetY > 0 ? '+' : ''}{recWmConfig.logoOffsetY}%</label>
                                                                    <input type="range" min="-45" max="45" step="1" value={recWmConfig.logoOffsetY}
                                                                        onChange={e => updateRecWm({ logoOffsetY: parseInt(e.target.value) })}
                                                                        className="w-full accent-orange-500 mt-1" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Reset */}
                                            <button onClick={() => updateRecWm(DEFAULT_REC_WM)}
                                                className="w-full py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors">
                                                Reset to Defaults
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

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
