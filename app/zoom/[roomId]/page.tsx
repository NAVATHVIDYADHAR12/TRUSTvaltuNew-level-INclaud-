"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GlobalNavbar from '../../_components/GlobalNavbar';
import {
    Mic, MicOff, Camera, CameraOff, PhoneOff, Copy, Users, Shield, Circle, Square,
    Share2, Check, AlertTriangle, Loader2, Monitor, MonitorOff, MessageSquare,
    Heart, X, Send, BarChart2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveRecording, ZoomRecording } from '../_utils/recordingsDB';
import { saveChatSession, calculateChatSize, ChatMessage } from '../_utils/chatDB';
import {
    initAdvancedDRM,
    blockPictureInPicture,
    createProtectionOverlay,
    ForensicWatermark,
} from '../_utils/advancedDRM';

// ── Capture the REAL MediaRecorder at module load time ────────────────────────
// Must be at module scope — before React/DRM can replace window.MediaRecorder.
const REAL_MEDIA_RECORDER: (typeof MediaRecorder) | null =
    typeof window !== 'undefined' ? window.MediaRecorder : null;

// ── In-room message type ───────────────────────────────────────────────────────
interface InRoomMsg {
    id: string;
    text: string;
    sender: 'me' | 'remote';
    timestamp: number;
}

// ── Recording watermark config (mirrors GlobalNavbar export) ─────────────────
interface RecordingWmConfig {
    text: string; fontSize: number; color: string; opacity: number;
    bgColor: string; bgOpacity: number; rotation: number;
    repeat: boolean; spacingX: number; spacingY: number;
    offsetX: number; offsetY: number;
    // Logo layer — independent of text
    logoDataUrl: string; logoSize: number; logoOpacity: number;
    logoOffsetX: number; logoOffsetY: number;
    logoRepeat: boolean; logoSpacingX: number; logoSpacingY: number; logoRotation: number;
}
const DEFAULT_REC_WM: RecordingWmConfig = {
    text: '', fontSize: 20, color: '#ffffff', opacity: 0.85,
    bgColor: '#000000', bgOpacity: 0.65, rotation: -30,
    repeat: true, spacingX: 380, spacingY: 120, offsetX: 0, offsetY: 0,
    logoDataUrl: '', logoSize: 48, logoOpacity: 0.85,
    logoOffsetX: 0, logoOffsetY: 0,
    logoRepeat: false, logoSpacingX: 300, logoSpacingY: 200, logoRotation: 0,
};
const hexToRgbNums = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '').padEnd(6, '0');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};

// ── Reaction definitions ───────────────────────────────────────────────────────
type ReactionKey = 'agree' | 'thumbsup' | 'clap' | 'disagree' | 'heart' | 'hand';
const REACTION_EMOJIS: Record<ReactionKey, string> = {
    agree: '✅', thumbsup: '👍', clap: '👏', disagree: '❌', heart: '❤️', hand: '✋'
};
const REACTION_LABELS: Record<ReactionKey, string> = {
    agree: 'Agree', thumbsup: 'Thumbs Up', clap: 'Clap', disagree: 'Disagree', heart: 'Heart', hand: 'Raise Hand'
};

// ── DRM Protection Hook ────────────────────────────────────────────────────────
const useDRMProtection = () => {
    const [drmEnabled, setDrmEnabled] = useState(true);
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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedEnabled = localStorage.getItem('drmProtectionEnabled');
            setDrmEnabled(savedEnabled !== 'false');
            const savedSettings = localStorage.getItem('drmSettings');
            if (savedSettings) {
                try { setDrmSettings(JSON.parse(savedSettings)); } catch (_) { /* ignore */ }
            }
        }
    }, []);

    useEffect(() => {
        const handleSettingsChange = (e: Event) => {
            const ce = e as CustomEvent;
            if (ce.detail) setDrmSettings(ce.detail);
        };
        window.addEventListener('drmSettingsChanged', handleSettingsChange);
        return () => window.removeEventListener('drmSettingsChanged', handleSettingsChange);
    }, []);

    return { drmEnabled, drmSettings };
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function MeetingRoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomId = (params?.roomId as string) || '';

    // ── Video refs ────────────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // ── Recording refs ────────────────────────────────────────────────────────
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingStartTimeRef = useRef<number>(0);

    // ── Mixed-recording refs (canvas + AudioContext) ───────────────────────────
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const mixedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number>(0);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // ── WebRTC refs ───────────────────────────────────────────────────────────
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const webrtcSetupDoneRef = useRef(false);
    const webrtcIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const callerCandidatesAdded = useRef(0);
    const calleeCandidatesAdded = useRef(0);

    // ── Data channel ref ──────────────────────────────────────────────────────
    const dataChannelRef = useRef<RTCDataChannel | null>(null);

    // ── Screen-share refs ─────────────────────────────────────────────────────
    const screenShareStreamRef = useRef<MediaStream | null>(null);
    const screenShareSenderRef = useRef<RTCRtpSender | null>(null);

    // ── Misc refs ─────────────────────────────────────────────────────────────
    const isEndingCallRef = useRef(false);
    const recordingTimeRef = useRef(0);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // ── Watermark closure-control ref ────────────────────────────────────────
    const wmControlRef = useRef<((active: boolean, label: string, cfg: RecordingWmConfig) => void) | null>(null);
    const recWmConfigRef = useRef<RecordingWmConfig>(DEFAULT_REC_WM);

    // ── Core state ────────────────────────────────────────────────────────────
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<'waiting' | 'connecting' | 'connected' | 'disconnected'>('waiting');
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showDRMOverlay, setShowDRMOverlay] = useState(false);
    const [recordingSaved, setRecordingSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [autoRecordingStarted, setAutoRecordingStarted] = useState(false);
    const [sessionFingerprint, setSessionFingerprint] = useState('');
    const [drmViolationCount, setDrmViolationCount] = useState(0);
    const [advancedDRMActive, setAdvancedDRMActive] = useState(false);
    const [isEndingCall, setIsEndingCall] = useState(false);
    const [recWmConfig, setRecWmConfig] = useState<RecordingWmConfig>(DEFAULT_REC_WM);

    // ── Screen-share state ────────────────────────────────────────────────────
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
    const [screenSharePending, setScreenSharePending] = useState(false);
    const [screenShareRequest, setScreenShareRequest] = useState<string | null>(null);
    const [screenShareApproved, setScreenShareApproved] = useState(false);

    // ── In-room chat state ────────────────────────────────────────────────────
    const [showChatPanel, setShowChatPanel] = useState(false);
    const [chatTab, setChatTab] = useState<'group' | 'private' | 'poll'>('group');
    const [groupMessages, setGroupMessages] = useState<InRoomMsg[]>([]);
    const [privateMessages, setPrivateMessages] = useState<InRoomMsg[]>([]);
    const [roomChatInput, setRoomChatInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);

    // ── Reactions state — stores list of sender names per reaction key ────────
    const [reactionVotes, setReactionVotes] = useState<Record<ReactionKey, string[]>>({
        agree: [], thumbsup: [], clap: [], disagree: [], heart: [], hand: []
    });
    const [showReactionBar, setShowReactionBar] = useState(false);
    const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
    const [showReactionPoll, setShowReactionPoll] = useState(false);

    const { drmEnabled, drmSettings } = useDRMProtection();

    // ── Load recording watermark config from localStorage + listen for updates ─
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem('recWmConfig');
        if (saved) {
            try {
                const cfg = { ...DEFAULT_REC_WM, ...JSON.parse(saved) };
                setRecWmConfig(cfg);
                recWmConfigRef.current = cfg;
            } catch (_) {}
        }
        const handler = (e: Event) => {
            const cfg = { ...DEFAULT_REC_WM, ...(e as CustomEvent<RecordingWmConfig>).detail };
            setRecWmConfig(cfg);
            recWmConfigRef.current = cfg;
        };
        window.addEventListener('recWmConfigChanged', handler);
        return () => window.removeEventListener('recWmConfigChanged', handler);
    }, []);

    // ── Push watermark toggle + config into the recording canvas closure ───────
    useEffect(() => {
        recWmConfigRef.current = recWmConfig;
        const label = `🔒 ${sessionFingerprint || roomId} • ROOM-${roomId} • PROTECTED`;
        wmControlRef.current?.(drmSettings.watermarkOverlay, label, recWmConfig);
    }, [drmSettings.watermarkOverlay, recWmConfig, sessionFingerprint, roomId]);

    // ── Floating reaction animation ───────────────────────────────────────────
    const addFloatingReaction = useCallback((emoji: string) => {
        const id = Date.now() + Math.random();
        const x = 10 + Math.random() * 80;
        setFloatingReactions(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
    }, []);

    // ── Data channel message handler ──────────────────────────────────────────
    const setupDataChannel = useCallback((dc: RTCDataChannel) => {
        dc.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                switch (msg.type) {
                    case 'group-chat':
                        setGroupMessages(prev => [...prev, { id: msg.id, text: msg.text, sender: 'remote', timestamp: msg.timestamp }]);
                        setUnreadCount(prev => prev + 1);
                        break;
                    case 'private-chat':
                        setPrivateMessages(prev => [...prev, { id: msg.id, text: msg.text, sender: 'remote', timestamp: msg.timestamp }]);
                        setUnreadCount(prev => prev + 1);
                        break;
                    case 'reaction':
                        setReactionVotes(prev => ({ ...prev, [msg.emoji]: [...(prev[msg.emoji as ReactionKey] || []), 'Participant'] }));
                        addFloatingReaction(REACTION_EMOJIS[msg.emoji as ReactionKey] || msg.emoji);
                        break;
                    case 'screen-share-start':
                        setRemoteScreenSharing(true);
                        break;
                    case 'screen-share-stop':
                        setRemoteScreenSharing(false);
                        break;
                    case 'screen-share-request':
                        setScreenShareRequest(msg.sender || 'Remote peer');
                        break;
                    case 'screen-share-approve':
                        setScreenSharePending(false);
                        setScreenShareApproved(true);
                        break;
                    case 'screen-share-deny':
                        setScreenSharePending(false);
                        break;
                }
            } catch (_) { /* ignore malformed */ }
        };
        dc.onopen = () => console.log('📡 Data channel open');
        dc.onclose = () => console.log('📡 Data channel closed');
    }, [addFloatingReaction]);

    const sendDataMessage = useCallback((data: object) => {
        if (dataChannelRef.current?.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify(data));
        }
    }, []);

    // ── Effect 1: Initialize Advanced DRM ─────────────────────────────────────
    useEffect(() => {
        if (drmEnabled && !advancedDRMActive) {
            const { fingerprint, cleanup } = initAdvancedDRM({
                userId: `user-${roomId}`,
                sessionId: `session-${Date.now()}`,
                enableForensicWatermark: drmSettings.forensicWatermark,
                enableMediaRecorderBlock: false,
                enablePiPBlock: drmSettings.pipBlock,
                enableDevToolsDetection: drmSettings.devToolsDetection,
                enableCanvasProtection: drmSettings.screenshotBlocking,
                enableHeartbeat: drmSettings.heartbeatProtection
            });

            setSessionFingerprint(fingerprint);
            setAdvancedDRMActive(true);

            const handleViolation = () => {
                setDrmViolationCount(prev => prev + 1);
                setShowDRMOverlay(true);
                setTimeout(() => setShowDRMOverlay(false), 5000);
            };
            window.addEventListener('drmViolation', handleViolation);
            return () => {
                cleanup();
                window.removeEventListener('drmViolation', handleViolation);
            };
        }
    }, [drmEnabled, drmSettings, advancedDRMActive, roomId]);

    // ── Effect 2: Block Picture-in-Picture ─────────────────────────────────────
    useEffect(() => {
        if (localVideoRef.current && drmEnabled && drmSettings.pipBlock) {
            blockPictureInPicture(localVideoRef.current);
        }
    }, [stream, drmEnabled, drmSettings.pipBlock]);

    // ── Effect 3: Canvas protection overlay ────────────────────────────────────
    useEffect(() => {
        if (videoContainerRef.current && drmEnabled && drmSettings.screenshotBlocking) {
            const overlay = createProtectionOverlay(videoContainerRef.current);
            return () => overlay.remove();
        }
    }, [drmEnabled, drmSettings.screenshotBlocking]);

    // ── Effect 4: Forensic watermark ───────────────────────────────────────────
    useEffect(() => {
        if (videoContainerRef.current && drmEnabled && drmSettings.forensicWatermark && roomId) {
            const watermark = new ForensicWatermark(`user-${roomId}`);
            const { clientWidth, clientHeight } = videoContainerRef.current;
            if (clientWidth > 0 && clientHeight > 0) {
                const canvas = watermark.createWatermarkOverlay(clientWidth, clientHeight);
                canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:20;opacity:0.01;';
                videoContainerRef.current.appendChild(canvas);
                return () => canvas.remove();
            }
        }
    }, [drmEnabled, drmSettings.forensicWatermark, roomId]);

    // ── Effect 5: Start camera + mic ───────────────────────────────────────────
    useEffect(() => {
        const startMedia = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(mediaStream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = mediaStream;
                }
            } catch (_) {
                // Camera access denied
            }
        };
        startMedia();
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            stream?.getTracks().forEach(t => t.stop());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Effect 6: WebRTC Peer Connection ───────────────────────────────────────
    useEffect(() => {
        if (!stream || webrtcSetupDoneRef.current) return;
        webrtcSetupDoneRef.current = true;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });
        pcRef.current = pc;

        // Capture remote stream for mixed recording + play it
        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteStreamRef.current = event.streams[0];
                setConnectionState('connected');
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setConnectionState('disconnected');
            }
        };

        // Callee receives data channel
        pc.ondatachannel = (e) => {
            dataChannelRef.current = e.channel;
            setupDataChannel(e.channel);
        };

        // Add local tracks — capture video sender for screen-share replaceTrack
        stream.getTracks().forEach(track => {
            const sender = pc.addTrack(track, stream);
            if (track.kind === 'video') {
                screenShareSenderRef.current = sender;
            }
        });

        const setupSignaling = async () => {
            try {
                const res = await fetch(`/api/zoom/signal?roomId=${roomId}`);
                const roomData = await res.json();

                if (!roomData.offer) {
                    // ── CALLER ─────────────────────────────────────────────────
                    setConnectionState('waiting');

                    // Create data channel BEFORE offer so it's included in SDP
                    const dc = pc.createDataChannel('tvault', { ordered: true });
                    dataChannelRef.current = dc;
                    setupDataChannel(dc);

                    pc.onicecandidate = async (event) => {
                        if (event.candidate) {
                            await fetch('/api/zoom/signal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roomId, type: 'offerCandidate', data: event.candidate.toJSON() })
                            });
                        }
                    };

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await fetch('/api/zoom/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId, type: 'offer', data: { type: offer.type, sdp: offer.sdp } })
                    });

                    const interval = setInterval(async () => {
                        try {
                            const r = await fetch(`/api/zoom/signal?roomId=${roomId}`);
                            const d = await r.json();
                            if (d.answer && !pc.remoteDescription) {
                                await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
                                setConnectionState('connecting');
                            }
                            if (pc.remoteDescription) {
                                const candidates: RTCIceCandidateInit[] = d.answerCandidates || [];
                                while (calleeCandidatesAdded.current < candidates.length) {
                                    await pc.addIceCandidate(new RTCIceCandidate(candidates[calleeCandidatesAdded.current]));
                                    calleeCandidatesAdded.current++;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }, 2000);
                    webrtcIntervalRef.current = interval;

                } else {
                    // ── CALLEE ─────────────────────────────────────────────────
                    setConnectionState('connecting');
                    await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));

                    pc.onicecandidate = async (event) => {
                        if (event.candidate) {
                            await fetch('/api/zoom/signal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roomId, type: 'answerCandidate', data: event.candidate.toJSON() })
                            });
                        }
                    };

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await fetch('/api/zoom/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId, type: 'answer', data: { type: answer.type, sdp: answer.sdp } })
                    });

                    const existing: RTCIceCandidateInit[] = roomData.offerCandidates || [];
                    for (const c of existing) {
                        await pc.addIceCandidate(new RTCIceCandidate(c));
                        callerCandidatesAdded.current++;
                    }

                    const interval = setInterval(async () => {
                        try {
                            const r = await fetch(`/api/zoom/signal?roomId=${roomId}`);
                            const d = await r.json();
                            const candidates: RTCIceCandidateInit[] = d.offerCandidates || [];
                            while (callerCandidatesAdded.current < candidates.length) {
                                await pc.addIceCandidate(new RTCIceCandidate(candidates[callerCandidatesAdded.current]));
                                callerCandidatesAdded.current++;
                            }
                        } catch (_) { /* ignore */ }
                    }, 2000);
                    webrtcIntervalRef.current = interval;
                }
            } catch (_) {
                // Signaling unavailable — solo mode
            }
        };

        setupSignaling();
        return () => {
            if (webrtcIntervalRef.current) clearInterval(webrtcIntervalRef.current);
        };
    }, [stream, roomId, setupDataChannel]);

    // ── Effect 7: Recording timer ──────────────────────────────────────────────
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // ── Effect 8: Auto-recording ───────────────────────────────────────────────
    useEffect(() => {
        if (stream && !autoRecordingStarted && !isRecording) {
            const timer = setTimeout(() => {
                recordedChunksRef.current = [];
                recordingStartTimeRef.current = Date.now();
                const MR = REAL_MEDIA_RECORDER || MediaRecorder;
                const recordingStream = createMixedStream() || stream;

                const startWithMimeType = (mimeType: string) => {
                    try {
                        const mr = new MR(recordingStream, { mimeType });
                        mr.ondataavailable = (event) => {
                            if (event.data.size > 0) recordedChunksRef.current.push(event.data);
                        };
                        mr.onstop = async () => {
                            cleanupMixedStream();
                            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                            if (blob.size > 0) {
                                await handleSaveRecording(blob);
                            } else if (isEndingCallRef.current) {
                                router.push('/search?tab=history');
                            }
                        };
                        mr.start(1000);
                        mediaRecorderRef.current = mr;
                        setIsRecording(true);
                        setRecordingTime(0);
                        setAutoRecordingStarted(true);
                        return true;
                    } catch (_) {
                        return false;
                    }
                };

                if (!startWithMimeType('video/webm;codecs=vp9')) {
                    startWithMimeType('video/webm');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream, autoRecordingStarted, isRecording]);

    // ── Effect 9: DRM keyboard/context-menu/blur ───────────────────────────────
    useEffect(() => {
        if (!drmEnabled) return;
        let screenshotWarningTimeout: NodeJS.Timeout;

        const handleVisibilityChange = () => {
            if (document.hidden && drmSettings.tabFocusProtection) setShowDRMOverlay(true);
            else setShowDRMOverlay(false);
        };
        const handleContextMenu = (e: MouseEvent) => {
            if (drmSettings.rightClickDisable) e.preventDefault();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (drmSettings.devToolsDetection) {
                const isDevTools =
                    e.key === 'F12' ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                    (e.ctrlKey && e.key === 'U');
                if (isDevTools) {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDRMOverlay(true);
                    setTimeout(() => setShowDRMOverlay(false), 20000);
                    return;
                }
            }
            if (drmSettings.screenshotBlocking) {
                const isScreenshot =
                    e.key === 'PrintScreen' ||
                    (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'));
                if (isScreenshot) {
                    e.preventDefault();
                    setShowDRMOverlay(true);
                    screenshotWarningTimeout = setTimeout(() => setShowDRMOverlay(false), 3000);
                }
            }
        };
        const handleCopy = (e: ClipboardEvent) => {
            if (drmSettings.rightClickDisable) {
                e.preventDefault();
                e.clipboardData?.setData('text/plain', '');
            }
        };
        const handleBlur = () => {
            if (drmSettings.screenshotBlocking) {
                setShowDRMOverlay(true);
                setTimeout(() => { if (!document.hidden) setShowDRMOverlay(false); }, 100);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keyup', handleKeyDown, true);
        document.addEventListener('copy', handleCopy);
        window.addEventListener('blur', handleBlur);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('keyup', handleKeyDown, true);
            document.removeEventListener('copy', handleCopy);
            window.removeEventListener('blur', handleBlur);
            clearTimeout(screenshotWarningTimeout);
        };
    }, [drmEnabled, drmSettings]);

    // ── Effect 10: Sync refs ───────────────────────────────────────────────────
    useEffect(() => { isEndingCallRef.current = isEndingCall; }, [isEndingCall]);
    useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);

    // ── Effect 11: Auto-scroll chat ────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [groupMessages, privateMessages]);

    // ── Effect 12: Clear unread when panel opens ───────────────────────────────
    useEffect(() => {
        if (showChatPanel) setUnreadCount(0);
    }, [showChatPanel]);

    // ── Effect 13: Act on screen share approved by host ───────────────────────
    useEffect(() => {
        if (screenShareApproved) {
            setScreenShareApproved(false);
            startScreenShareActual();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenShareApproved]);

    // ── Mixed Recording: Canvas + AudioContext ────────────────────────────────
    const createMixedStream = (): MediaStream | null => {
        try {
            const localVid = localVideoRef.current;
            const remoteVid = remoteVideoRef.current;
            if (!localVid) return null;

            // ── Closure-local watermark state ────────────────────────────────
            let wmActive = drmSettings.watermarkOverlay;
            let wmLabel = `🔒 ${sessionFingerprint || roomId} • ROOM-${roomId} • PROTECTED`;
            let wmCfg: RecordingWmConfig = { ...recWmConfigRef.current };
            // Pre-load logo
            let logoImage: HTMLImageElement | null = null;
            let currentLogoSrc = '';
            const loadLogo = (src: string) => {
                if (src === currentLogoSrc) return;
                currentLogoSrc = src;
                if (!src) { logoImage = null; return; }
                const img = new Image();
                img.onload = () => { logoImage = img; };
                img.src = src;
            };
            if (wmCfg.logoDataUrl) loadLogo(wmCfg.logoDataUrl);
            wmControlRef.current = (active: boolean, label: string, cfg: RecordingWmConfig) => {
                wmActive = active;
                wmLabel = label;
                wmCfg = cfg;
                loadLogo(cfg.logoDataUrl);
            };

            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            mixedCanvasRef.current = canvas;

            const drawFrame = () => {
                ctx.fillStyle = '#0a0a0f';
                ctx.fillRect(0, 0, 1280, 720);
                if (localVid.readyState >= 2) ctx.drawImage(localVid, 0, 0, 640, 720);
                if (remoteVid && remoteVid.readyState >= 2) ctx.drawImage(remoteVid, 640, 0, 640, 720);

                // ── Recording watermark (fully config-driven) ────────────────
                if (wmActive) {
                    const cfg = wmCfg;
                    const displayText = cfg.text.trim() || wmLabel;
                    const [br, bg2, bb] = hexToRgbNums(cfg.bgColor);
                    const [tr, tg, tb] = hexToRgbNums(cfg.color);
                    const rotRad = (cfg.rotation * Math.PI) / 180;

                    // ── Text layer ──────────────────────────────────────────────
                    ctx.save();
                    ctx.font = `bold ${cfg.fontSize}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const drawTextOne = (cx: number, cy: number) => {
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.rotate(rotRad);
                        const metrics = ctx.measureText(displayText);
                        const pw = metrics.width + 18;
                        const ph = Math.max(cfg.fontSize + 10, 28);
                        if (cfg.bgOpacity > 0) {
                            ctx.globalAlpha = cfg.bgOpacity;
                            ctx.fillStyle = `rgb(${br},${bg2},${bb})`;
                            ctx.beginPath();
                            ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 6);
                            ctx.fill();
                        }
                        ctx.globalAlpha = cfg.opacity;
                        ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
                        ctx.fillText(displayText, 0, 0);
                        ctx.restore();
                    };

                    if (cfg.repeat) {
                        for (let row = -1; row <= 2; row++)
                            for (let col = -1; col <= 2; col++)
                                drawTextOne(col * cfg.spacingX, row * cfg.spacingY);
                    } else {
                        drawTextOne(640 + (cfg.offsetX / 100) * 1280, 360 + (cfg.offsetY / 100) * 720);
                    }
                    ctx.restore();

                    // ── Logo layer (independent) ────────────────────────────────
                    if (cfg.logoDataUrl && logoImage) {
                        const logoRotRad = (cfg.logoRotation * Math.PI) / 180;
                        const drawLogoOne = (cx: number, cy: number) => {
                            ctx.save();
                            ctx.translate(cx, cy);
                            ctx.rotate(logoRotRad);
                            ctx.globalAlpha = cfg.logoOpacity;
                            ctx.drawImage(logoImage!, -cfg.logoSize / 2, -cfg.logoSize / 2, cfg.logoSize, cfg.logoSize);
                            ctx.restore();
                        };
                        if (cfg.logoRepeat) {
                            for (let row = -1; row <= 2; row++)
                                for (let col = -1; col <= 2; col++)
                                    drawLogoOne(col * cfg.logoSpacingX, row * cfg.logoSpacingY);
                        } else {
                            drawLogoOne(640 + (cfg.logoOffsetX / 100) * 1280, 360 + (cfg.logoOffsetY / 100) * 720);
                        }
                    }

                    ctx.globalAlpha = 1;
                }

                rafRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();

            const canvasStream = canvas.captureStream(30);

            // Mix local mic + remote audio
            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            const dest = audioCtx.createMediaStreamDestination();

            if (stream) {
                const localAudio = stream.getAudioTracks();
                if (localAudio.length > 0) {
                    audioCtx.createMediaStreamSource(new MediaStream(localAudio)).connect(dest);
                }
            }
            if (remoteStreamRef.current) {
                const remoteAudio = remoteStreamRef.current.getAudioTracks();
                if (remoteAudio.length > 0) {
                    audioCtx.createMediaStreamSource(new MediaStream(remoteAudio)).connect(dest);
                }
            }

            return new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);
        } catch (_) {
            return null;
        }
    };

    const cleanupMixedStream = () => {
        cancelAnimationFrame(rafRef.current);
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        mixedCanvasRef.current = null;
        wmControlRef.current = null; // discard closure setter — canvas is gone
    };

    // ── Screen Sharing ────────────────────────────────────────────────────────
    const startScreenShareActual = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            screenShareStreamRef.current = screenStream;
            const videoTrack = screenStream.getVideoTracks()[0];

            if (screenShareSenderRef.current) {
                await screenShareSenderRef.current.replaceTrack(videoTrack);
            }
            if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

            setIsScreenSharing(true);
            sendDataMessage({ type: 'screen-share-start' });

            // User stops sharing via browser native button
            videoTrack.onended = () => stopScreenShare();
        } catch (err) {
            console.error('Screen share failed:', err);
            setScreenSharePending(false);
        }
    };

    const startScreenShare = async () => {
        if (isScreenSharing) return;
        if (remoteScreenSharing) {
            // Someone else is sharing — request host to hand over
            sendDataMessage({ type: 'screen-share-request', sender: 'Remote Peer' });
            setScreenSharePending(true);
            return;
        }
        await startScreenShareActual();
    };

    const stopScreenShare = () => {
        screenShareStreamRef.current?.getTracks().forEach(t => t.stop());
        screenShareStreamRef.current = null;

        const cameraTrack = stream?.getVideoTracks()[0];
        if (cameraTrack && screenShareSenderRef.current) {
            screenShareSenderRef.current.replaceTrack(cameraTrack).catch(() => {});
        }
        if (localVideoRef.current && stream) localVideoRef.current.srcObject = stream;

        setIsScreenSharing(false);
        sendDataMessage({ type: 'screen-share-stop' });
    };

    const approveScreenShare = () => {
        sendDataMessage({ type: 'screen-share-approve' });
        setScreenShareRequest(null);
    };

    const denyScreenShare = () => {
        sendDataMessage({ type: 'screen-share-deny' });
        setScreenShareRequest(null);
    };

    // ── In-room Chat ──────────────────────────────────────────────────────────
    const sendRoomChatMessage = () => {
        if (!roomChatInput.trim()) return;
        const msg: InRoomMsg = {
            id: Date.now().toString(),
            text: roomChatInput.trim(),
            sender: 'me',
            timestamp: Date.now()
        };
        if (chatTab === 'group') {
            setGroupMessages(prev => [...prev, msg]);
            sendDataMessage({ type: 'group-chat', id: msg.id, text: msg.text, timestamp: msg.timestamp });
        } else {
            setPrivateMessages(prev => [...prev, msg]);
            sendDataMessage({ type: 'private-chat', id: msg.id, text: msg.text, timestamp: msg.timestamp });
        }
        setRoomChatInput('');
    };

    // ── Reactions ─────────────────────────────────────────────────────────────
    const sendReaction = (key: ReactionKey) => {
        setReactionVotes(prev => ({ ...prev, [key]: [...prev[key], 'You'] }));
        addFloatingReaction(REACTION_EMOJIS[key]);
        sendDataMessage({ type: 'reaction', emoji: key });
    };

    const totalReactions = Object.values(reactionVotes).reduce((a, b) => a + b.length, 0);

    // ── Save zoom chat sessions to History on call end ─────────────────────────
    const saveZoomChats = async () => {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        try {
            if (groupMessages.length > 0) {
                const msgs: ChatMessage[] = groupMessages.map(m => ({
                    sender: m.sender === 'me' ? 'user' : 'partner',
                    text: m.text,
                    timestamp: m.timestamp,
                }));
                await saveChatSession({
                    id: `zoom-group-${roomId}-${Date.now()}`,
                    partnerId: roomId,
                    partnerName: `Group Chat Discussion — Room ${roomId}`,
                    date: dateStr,
                    timestamp: Date.now(),
                    messages: msgs,
                    size: calculateChatSize(msgs),
                });
            }
            if (privateMessages.length > 0) {
                const msgs: ChatMessage[] = privateMessages.map(m => ({
                    sender: m.sender === 'me' ? 'user' : 'partner',
                    text: m.text,
                    timestamp: m.timestamp,
                }));
                await saveChatSession({
                    id: `zoom-private-${roomId}-${Date.now()}`,
                    partnerId: roomId,
                    partnerName: `Private Chat Discussion — Room ${roomId}`,
                    date: dateStr,
                    timestamp: Date.now(),
                    messages: msgs,
                    size: calculateChatSize(msgs),
                });
            }
        } catch (err) {
            console.error('Failed to save zoom chats:', err);
        }
    };

    // ── Controls ───────────────────────────────────────────────────────────────
    const toggleMic = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
            setMicEnabled(prev => !prev);
        }
    };

    const toggleCamera = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
            setCameraEnabled(prev => !prev);
        }
    };

    const startRecording = () => {
        if (stream) {
            recordedChunksRef.current = [];
            recordingStartTimeRef.current = Date.now();
            const MR = REAL_MEDIA_RECORDER || MediaRecorder;
            const recordingStream = createMixedStream() || stream;
            const mr = new MR(recordingStream, { mimeType: 'video/webm' });
            mr.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksRef.current.push(event.data);
            };
            mr.onstop = async () => {
                cleanupMixedStream();
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                if (blob.size > 0) await handleSaveRecording(blob);
                else if (isEndingCallRef.current) router.push('/search?tab=history');
            };
            mr.start(1000);
            mediaRecorderRef.current = mr;
            setIsRecording(true);
            setRecordingTime(0);
        }
    };

    const stopRecording = () => {
        const mr = mediaRecorderRef.current;
        if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
            mr.requestData();
            mr.stop();
            setIsRecording(false);
        }
    };

    const handleSaveRecording = async (blob: Blob) => {
        const recording: ZoomRecording = {
            id: Date.now().toString(),
            roomId,
            date: new Date().toLocaleString(),
            duration: formatTime(recordingTimeRef.current),
            size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
            blob,
            timestamp: Date.now()
        };
        try {
            await saveRecording(recording);
            setRecordingSaved(true);
            if (isEndingCallRef.current) {
                setTimeout(() => router.push('/search?tab=history'), 1000);
            } else {
                setTimeout(() => setRecordingSaved(false), 3000);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('❌ saveRecording failed, falling back to download:', err);
            setSaveError(`Save failed: ${msg}. Recording downloaded instead.`);
            setTimeout(() => setSaveError(null), 8000);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meeting-${roomId}-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (isEndingCallRef.current) router.push('/search?tab=history');
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/zoom/${roomId}`);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const endCall = async () => {
        // 1. Stop recording first (while stream is alive)
        const wasRecording = isRecording || (mediaRecorderRef.current?.state === 'recording');
        if (wasRecording) {
            setIsEndingCall(true);
            isEndingCallRef.current = true;
            stopRecording();
        }

        // 2. Save zoom chats to History
        await saveZoomChats();

        // 3. Stop screen share
        if (isScreenSharing) stopScreenShare();

        // 4. Stop stream tracks (small delay so MediaRecorder can finish)
        setTimeout(() => {
            stream?.getTracks().forEach(t => t.stop());
        }, 400);

        // 5. Close WebRTC
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
        if (webrtcIntervalRef.current) clearInterval(webrtcIntervalRef.current);
        dataChannelRef.current?.close();
        fetch(`/api/zoom/signal?roomId=${roomId}`, { method: 'DELETE' }).catch(() => {});

        if (!wasRecording) {
            router.push('/search?tab=history');
        } else {
            setTimeout(() => {
                if (window.location.pathname.includes('/zoom/')) {
                    router.push('/search?tab=history');
                }
            }, 6000);
        }
    };

    const participantCount = connectionState === 'connected' ? 2 : 1;
    const activeMessages = chatTab === 'group' ? groupMessages : chatTab === 'private' ? privateMessages : [];

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-sans flex flex-col">
            <GlobalNavbar />

            {/* DRM Overlay */}
            <AnimatePresence>
                {showDRMOverlay && drmEnabled && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center"
                        style={{ background: 'repeating-linear-gradient(45deg, #000 0px, #000 10px, #111 10px, #111 20px)' }}
                    >
                        <div className="text-center p-8 bg-black/90 rounded-3xl border-4 border-red-600 shadow-2xl shadow-red-600/50">
                            <Shield className="w-20 h-20 text-red-600 mx-auto mb-4" />
                            <h2 className="text-3xl font-black text-red-500 mb-2">DRM PROTECTION ACTIVE</h2>
                            <p className="text-gray-400 max-w-sm">Screenshots, screen recording, DevTools, and clipboard capture are not permitted.</p>
                            <div className="mt-6 flex items-center justify-center gap-2 text-yellow-500">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-sm font-medium">Violation logged • {sessionFingerprint}</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toasts */}
            <AnimatePresence>
                {recordingSaved && (
                    <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-600/90 backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg">
                        <Check className="w-5 h-5" /><span className="font-medium">Recording saved to History!</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {saveError && (
                    <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg max-w-lg">
                        <AlertTriangle className="w-5 h-5 shrink-0" /><span className="font-medium text-sm">{saveError}</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {autoRecordingStarted && isRecording && recordingTime < 5 && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-purple-600/90 backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg border border-purple-400/30">
                        <Circle className="w-4 h-4 fill-red-500 animate-pulse" />
                        <span className="font-medium">🎬 Auto-Recording — both participants captured. Saved to History when call ends.</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Screen Share Request (host sees) */}
            <AnimatePresence>
                {screenShareRequest && (
                    <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
                        className="fixed top-24 right-6 z-[110] bg-[#1a1a2e] border border-purple-500/40 rounded-2xl p-4 shadow-2xl w-72">
                        <div className="flex items-center gap-2 mb-2">
                            <Monitor className="w-4 h-4 text-purple-400" />
                            <p className="text-sm font-semibold">Screen Share Request</p>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">{screenShareRequest} wants to share their screen</p>
                        <div className="flex gap-2">
                            <button onClick={approveScreenShare} className="flex-1 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm hover:bg-green-600/30 border border-green-500/20 transition-colors">✓ Allow</button>
                            <button onClick={denyScreenShare} className="flex-1 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 border border-red-500/20 transition-colors">✕ Deny</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Reactions */}
            <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden">
                {floatingReactions.map(r => (
                    <motion.div key={r.id}
                        initial={{ y: '88vh', opacity: 1, scale: 1 }}
                        animate={{ y: '-5vh', opacity: 0, scale: 1.6 }}
                        transition={{ duration: 3, ease: 'easeOut' }}
                        className="absolute text-3xl select-none"
                        style={{ left: `${r.x}%` }}>
                        {r.emoji}
                    </motion.div>
                ))}
            </div>

            {/* Main: video area + chat panel */}
            <div className="flex-1 flex overflow-hidden">

                {/* Video + Controls */}
                <main className="flex-1 flex flex-col p-4 min-w-0">

                    {/* Room Info Bar */}
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                <span className="text-sm text-gray-400">Room:</span>
                                <span className="font-mono font-bold tracking-widest">{roomId}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Users className="w-4 h-4" />
                                {participantCount} participant{participantCount > 1 ? 's' : ''}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isRecording && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30">
                                    <Circle className="w-3 h-3 fill-red-500 animate-pulse" />
                                    <span className="text-sm font-medium">
                                        {autoRecordingStarted && <span className="text-red-300 mr-1">AUTO</span>}
                                        REC {formatTime(recordingTime)}
                                    </span>
                                </motion.div>
                            )}
                            {drmEnabled && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-purple-600/20 text-purple-400 px-3 py-1.5 rounded-full border border-purple-500/30">
                                        <Shield className="w-4 h-4" />
                                        <span className="text-xs font-medium">{advancedDRMActive ? 'DRM+' : 'DRM'}</span>
                                    </div>
                                    {sessionFingerprint && (
                                        <div className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30 text-xs font-mono">
                                            {sessionFingerprint}
                                        </div>
                                    )}
                                    {drmViolationCount > 0 && (
                                        <div className="flex items-center gap-1 bg-red-600/30 text-red-400 px-2 py-1 rounded-full border border-red-500/30 text-xs animate-pulse">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span>{drmViolationCount} violation{drmViolationCount > 1 ? 's' : ''}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Video Grid */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                        {/* Local Video */}
                        <div ref={videoContainerRef}
                            className={`relative bg-[#111] rounded-2xl overflow-hidden border border-white/5
                                ${drmEnabled && drmSettings.screenshotBlocking ? 'drm-video-protected' : ''}
                                ${drmEnabled && drmSettings.screenRecordingBlock ? 'screen-recording-blocked' : ''}`}>
                            {cameraEnabled || isScreenSharing ? (
                                <video ref={localVideoRef} autoPlay playsInline muted
                                    className="w-full h-full object-cover min-h-[300px]"
                                    style={drmEnabled && drmSettings.screenshotBlocking ? { WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' } : {}} />
                            ) : (
                                <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                    <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold">Y</div>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-sm">
                                {isScreenSharing ? '🖥️ You (Screen Share)' : `You${!micEnabled ? ' (muted)' : ''}`}
                            </div>
                            {isScreenSharing && (
                                <div className="absolute top-3 right-3 bg-blue-600/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    <Monitor className="w-3 h-3" /> Sharing
                                </div>
                            )}
                            {drmSettings.watermarkOverlay && (
                                /* Live-meeting overlay: translucent blend — subtle during call but
                                   extremely hard to remove from phone recordings because the text
                                   colour shifts with the underlying video content (mix-blend-mode). */
                                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                                    {([
                                        [18, 12], [55, 8],  [88, 18],
                                        [10, 45], [48, 42], [82, 50],
                                        [22, 78], [60, 72], [90, 85],
                                    ] as [number, number][]).map(([left, top], i) => (
                                        <div key={i} style={{
                                            position: 'absolute',
                                            left: `${left}%`,
                                            top: `${top}%`,
                                            transform: 'translate(-50%, -50%) rotate(-18deg)',
                                            color: 'rgba(255, 60, 60, 0.22)',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'nowrap',
                                            userSelect: 'none',
                                            letterSpacing: '0.04em',
                                            mixBlendMode: 'overlay' as const,
                                        }}>
                                            🔒 {sessionFingerprint || roomId} • PROTECTED
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Remote Video */}
                        <div className="relative bg-[#111] rounded-2xl overflow-hidden border border-white/5">
                            <video ref={remoteVideoRef} autoPlay playsInline
                                className={`w-full h-full object-cover min-h-[300px] ${connectionState === 'connected' ? 'block' : 'hidden'}`} />
                            {connectionState !== 'connected' && (
                                <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-gradient-to-br from-gray-900 to-[#0a0a0f]">
                                    <div className="text-center px-6">
                                        {connectionState === 'waiting' && (<>
                                            <div className="w-20 h-20 rounded-full bg-purple-900/50 border-2 border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                                                <Users className="w-9 h-9 text-purple-400" />
                                            </div>
                                            <p className="text-gray-300 font-medium mb-1">Waiting for peer to join...</p>
                                            <p className="text-gray-600 text-xs mb-4">Share the room code or invite link</p>
                                            <button onClick={() => setShowInviteModal(true)}
                                                className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm rounded-lg hover:bg-purple-600/30 transition-all">
                                                📋 Copy Invite Link
                                            </button>
                                        </>)}
                                        {connectionState === 'connecting' && (<>
                                            <div className="w-20 h-20 rounded-full bg-blue-900/50 border-2 border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                                                <Loader2 className="w-9 h-9 text-blue-400 animate-spin" />
                                            </div>
                                            <p className="text-blue-300 font-medium mb-1">Connecting...</p>
                                            <p className="text-gray-600 text-xs">Establishing secure WebRTC connection</p>
                                        </>)}
                                        {connectionState === 'disconnected' && (<>
                                            <div className="w-20 h-20 rounded-full bg-red-900/50 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
                                                <AlertTriangle className="w-9 h-9 text-red-400" />
                                            </div>
                                            <p className="text-red-400 font-medium">Peer disconnected</p>
                                        </>)}
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-sm">
                                {connectionState === 'connected'
                                    ? remoteScreenSharing ? '🖥️ Remote (Screen Share)' : 'Remote Peer'
                                    : connectionState === 'connecting' ? 'Connecting...'
                                    : connectionState === 'disconnected' ? 'Disconnected'
                                    : 'Waiting for peer'}
                            </div>
                            <div className="absolute top-4 right-4">
                                <div className={`w-3 h-3 rounded-full ${
                                    connectionState === 'connected' ? 'bg-green-500 animate-pulse'
                                    : connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse'
                                    : connectionState === 'disconnected' ? 'bg-red-500' : 'bg-gray-500'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Reactions Poll (collapsible) */}
                    {totalReactions > 0 && (
                        <button onClick={() => setShowReactionPoll(p => !p)}
                            className="mb-3 w-full flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="w-4 h-4" /> Reactions Poll ({totalReactions} total)
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showReactionPoll ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                    <AnimatePresence>
                        {showReactionPoll && totalReactions > 0 && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="mb-3 overflow-hidden bg-[#111] rounded-xl border border-white/10 p-4">
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {(Object.entries(reactionVotes) as [ReactionKey, string[]][]).map(([key, voters]) => (
                                        <div key={key} className="flex flex-col items-center gap-1">
                                            <span className="text-xl">{REACTION_EMOJIS[key]}</span>
                                            <div className="w-full bg-white/10 rounded-full h-1.5">
                                                <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: totalReactions > 0 ? `${(voters.length / totalReactions) * 100}%` : '0%' }} />
                                            </div>
                                            <span className="text-xs text-gray-400 font-bold">{voters.length}</span>
                                            <span className="text-xs text-gray-600">{REACTION_LABELS[key]}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Controls Bar */}
                    <div className="flex items-center justify-center gap-3 py-4 bg-[#111] rounded-2xl border border-white/5 flex-wrap px-4">
                        <button onClick={toggleMic}
                            className={`p-4 rounded-full transition-all ${micEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600 hover:bg-red-700'}`}
                            title={micEnabled ? 'Mute' : 'Unmute'}>
                            {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        </button>

                        <button onClick={toggleCamera}
                            className={`p-4 rounded-full transition-all ${cameraEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600 hover:bg-red-700'}`}
                            title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}>
                            {cameraEnabled ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
                        </button>

                        {/* Screen Share */}
                        <button onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                            className={`p-4 rounded-full transition-all ${
                                isScreenSharing ? 'bg-blue-600 hover:bg-blue-700'
                                : screenSharePending ? 'bg-yellow-600 animate-pulse'
                                : 'bg-white/10 hover:bg-white/20'}`}
                            title={isScreenSharing ? 'Stop Screen Share' : screenSharePending ? 'Waiting for host approval…' : 'Share Screen'}>
                            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                        </button>

                        {/* Record */}
                        <button onClick={isRecording ? stopRecording : startRecording}
                            className={`p-4 rounded-full transition-all ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-white/10 hover:bg-white/20'}`}
                            title={isRecording ? 'Stop Recording' : 'Start Recording'}>
                            {isRecording ? <Square className="w-6 h-6 fill-white" /> : <Circle className="w-6 h-6" />}
                        </button>

                        {/* Chat */}
                        <button onClick={() => setShowChatPanel(p => !p)}
                            className={`p-4 rounded-full transition-all relative ${showChatPanel ? 'bg-purple-600 hover:bg-purple-700' : 'bg-white/10 hover:bg-white/20'}`}
                            title="Chat">
                            <MessageSquare className="w-6 h-6" />
                            {unreadCount > 0 && !showChatPanel && (
                                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Reactions — popup above button */}
                        <div className="relative">
                            <button onClick={() => setShowReactionBar(p => !p)}
                                className={`p-4 rounded-full transition-all ${showReactionBar ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-white/10 hover:bg-white/20'}`}
                                title="Reactions">
                                <Heart className="w-6 h-6" />
                            </button>

                            <AnimatePresence>
                                {showReactionBar && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl p-3 w-72"
                                    >
                                        {/* Caret pointer */}
                                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a2e] border-r border-b border-white/10 rotate-45" />

                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-2 px-1">
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Send a reaction</span>
                                            <button onClick={() => setShowReactionBar(false)} className="text-gray-600 hover:text-gray-300 transition-colors p-0.5">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* 3-column emoji grid */}
                                        <div className="grid grid-cols-3 gap-1">
                                            {(Object.entries(REACTION_EMOJIS) as [ReactionKey, string][]).map(([key, emoji]) => (
                                                <button key={key}
                                                    onClick={() => { sendReaction(key); setShowReactionBar(false); }}
                                                    className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors group"
                                                    title={REACTION_LABELS[key]}>
                                                    <span className="text-2xl group-hover:scale-125 transition-transform inline-block leading-none">{emoji}</span>
                                                    <span className="text-xs text-gray-400 leading-none">{REACTION_LABELS[key]}</span>
                                                    {reactionVotes[key].length > 0 && (
                                                        <span className="text-xs font-bold text-yellow-400 leading-none">{reactionVotes[key].length}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* View Poll shortcut */}
                                        <div className="mt-2 pt-2 border-t border-white/10">
                                            <button onClick={() => { setShowReactionPoll(p => !p); setShowReactionBar(false); }}
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-white/10 transition-colors text-purple-400 text-sm font-medium">
                                                <BarChart2 className="w-4 h-4" />
                                                View Poll {totalReactions > 0 && `(${totalReactions} total)`}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Invite */}
                        <button onClick={() => setShowInviteModal(true)}
                            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all" title="Invite">
                            <Share2 className="w-6 h-6" />
                        </button>

                        {/* End Call */}
                        <button onClick={endCall}
                            className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 transition-all" title="End Call">
                            <PhoneOff className="w-6 h-6" />
                        </button>
                    </div>

                </main>

                {/* Chat Side Panel */}
                <AnimatePresence>
                    {showChatPanel && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[#111] border-l border-white/10 flex flex-col overflow-hidden shrink-0">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                <div className="flex gap-1 bg-black/30 rounded-lg p-1">
                                    <button onClick={() => setChatTab('group')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${chatTab === 'group' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        👥 Group
                                    </button>
                                    <button onClick={() => setChatTab('private')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${chatTab === 'private' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        🔒 Private
                                    </button>
                                    <button onClick={() => setChatTab('poll')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${chatTab === 'poll' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        📊 Poll
                                        {totalReactions > 0 && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded px-1 leading-none py-0.5">{totalReactions}</span>
                                        )}
                                    </button>
                                </div>
                                <button onClick={() => setShowChatPanel(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Messages / Poll */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {chatTab === 'poll' ? (
                                    totalReactions === 0 ? (
                                        <div className="text-center text-gray-600 text-sm py-8">
                                            <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>No reactions yet.</p>
                                            <p className="text-xs mt-1 text-gray-700">Send a reaction to see results here.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(Object.entries(reactionVotes) as [ReactionKey, string[]][])
                                                .filter(([, voters]) => voters.length > 0)
                                                .sort(([, a], [, b]) => b.length - a.length)
                                                .map(([key, voters]) => (
                                                    <div key={key} className="bg-white/5 rounded-xl p-3 border border-white/10">
                                                        {/* Emoji + label + count */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl leading-none">{REACTION_EMOJIS[key]}</span>
                                                                <span className="text-sm font-medium text-gray-300">{REACTION_LABELS[key]}</span>
                                                            </div>
                                                            <span className="text-sm font-bold text-yellow-400">{voters.length}</span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div className="w-full bg-white/10 rounded-full h-2 mb-2.5">
                                                            <div className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                                                style={{ width: `${(voters.length / totalReactions) * 100}%` }} />
                                                        </div>
                                                        {/* Who voted — chips */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {voters.map((name, i) => (
                                                                <span key={i}
                                                                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                                                        name === 'You'
                                                                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                                                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                                    }`}>
                                                                    {name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )
                                ) : (
                                    activeMessages.length === 0 ? (
                                        <div className="text-center text-gray-600 text-sm py-8">
                                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>No messages yet.</p>
                                            <p className="text-xs mt-1 text-gray-700">
                                                {chatTab === 'group' ? 'Visible to all participants' : 'Only this peer sees it'}
                                            </p>
                                        </div>
                                    ) : activeMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                                                msg.sender === 'me' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white/10 text-gray-200 rounded-tl-sm'}`}>
                                                <p className="break-words">{msg.text}</p>
                                                <p className="text-xs opacity-50 mt-1 text-right">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input — hidden on Poll tab */}
                            {chatTab !== 'poll' && <div className="p-3 border-t border-white/10">
                                <form onSubmit={(e) => { e.preventDefault(); sendRoomChatMessage(); }} className="flex gap-2">
                                    <input type="text" value={roomChatInput} onChange={e => setRoomChatInput(e.target.value)}
                                        placeholder={chatTab === 'group' ? 'Message everyone…' : 'Private message…'}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
                                    <button type="submit" disabled={!roomChatInput.trim()}
                                        className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                                <p className="text-xs text-gray-700 mt-2 text-center">Chats are saved to History when the call ends</p>
                            </div>}
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>

            {/* Invite Modal */}
            <AnimatePresence>
                {showInviteModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#111] w-full max-w-md rounded-3xl border border-white/10 p-6">
                            <h2 className="text-xl font-bold mb-2">Invite to Meeting</h2>
                            <p className="text-gray-400 text-sm mb-6">Share the room code or link. The call connects automatically once they join.</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Room Code</label>
                                    <div className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-xl tracking-widest text-center">{roomId}</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Invite Link</label>
                                    <div className="flex gap-2">
                                        <input type="text" readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/zoom/${roomId}`}
                                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300" />
                                        <button onClick={copyInviteLink}
                                            className={`px-4 py-3 rounded-xl transition-all flex items-center gap-2 ${linkCopied ? 'bg-green-600' : 'bg-white/10 hover:bg-white/20'}`}>
                                            {linkCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowInviteModal(false)}
                                className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all">Close</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Netflix-style DRM CSS */}
            <style jsx global>{`
                .drm-video-protected { -webkit-user-select: none; user-select: none; }
                .drm-video-protected video { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-transform: translateZ(0); transform: translateZ(0); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                @media print { .drm-video-protected, .drm-video-protected video { visibility: hidden !important; display: none !important; } }
                .screen-recording-blocked { transform: translate3d(0,0,0); -webkit-transform: translate3d(0,0,0); isolation: isolate; contain: strict; will-change: transform; }
                .screen-recording-blocked video { transform: translateZ(0) scale(1.0001); -webkit-transform: translateZ(0) scale(1.0001); will-change: transform, opacity; object-fit: cover; }
                .screen-recording-blocked::after { content: ''; position: absolute; top:0; left:0; right:0; bottom:0; pointer-events: none; background: transparent; mix-blend-mode: difference; z-index: 1; }
                @keyframes flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
            `}</style>
        </div>
    );
}
