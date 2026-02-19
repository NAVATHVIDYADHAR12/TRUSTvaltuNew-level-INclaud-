"use client";

import { signIn } from "../../../lib/mock-auth";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PinterestAuthLayout from "../_components/PinterestLayout";
import PinterestInput from "../_components/PinterestInput";
import PinterestButton from "../_components/PinterestButton";

type SocialProvider = 'google' | 'zoho' | null;

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [age, setAge] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    // Social signup modal state
    const [socialModal, setSocialModal] = useState<SocialProvider>(null);
    const [socialEmail, setSocialEmail] = useState("");
    const [socialName, setSocialName] = useState("");
    const [socialLoading, setSocialLoading] = useState(false);
    const [socialError, setSocialError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role: 'client' }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push("/auth/signin");
            } else {
                setError(data.message || "Signup failed");
                setIsLoading(false);
            }
        } catch {
            setIsLoading(false);
            setError("Connection failed.");
        }
    };

    const openSocialModal = (provider: 'google' | 'zoho') => {
        setSocialModal(provider);
        setSocialEmail("");
        setSocialName("");
        setSocialError("");
    };

    const closeSocialModal = () => {
        setSocialModal(null);
        setSocialEmail("");
        setSocialName("");
        setSocialError("");
    };

    const handleSocialSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setSocialError("");

        const trimmedEmail = socialEmail.trim();
        const trimmedName = socialName.trim();

        if (!trimmedName) { setSocialError("Please enter your full name."); return; }
        if (!trimmedEmail) { setSocialError("Please enter your email address."); return; }

        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRx.test(trimmedEmail)) {
            setSocialError("Please enter a valid email address.");
            return;
        }
        if (socialModal === 'zoho' && !trimmedEmail.match(/@zoho\.(com|in|eu|com\.au)$/i)) {
            setSocialError("Zoho Mail sign-up requires a @zoho.com, @zoho.in or similar Zoho address.");
            return;
        }

        setSocialLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Sign in directly — creates session + login record
        const res = await signIn(socialModal!, {
            email: trimmedEmail,
            name: trimmedName,
            redirect: false,
        });

        if (res?.ok) {
            router.push("/profile");
        } else {
            setSocialError("Sign-up failed. Please try again.");
            setSocialLoading(false);
        }
    };

    const providerLabel = socialModal === 'zoho' ? 'Zoho Mail' : 'Google';
    const providerPlaceholder = socialModal === 'zoho' ? 'you@zoho.com' : 'you@gmail.com';

    return (
        <PinterestAuthLayout title="Sign up to find more" subtitle="Join the secure creative network">
            {error && (
                <div className="mb-4 p-3 bg-red-100 text-[#E60023] text-sm font-bold rounded-lg flex items-center gap-2">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    {error}
                </div>
            )}

            {/* Social Sign-up Modal */}
            {socialModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {socialModal === 'zoho' ? (
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <rect width="24" height="24" rx="4" fill="#E42527"/>
                                        <text x="12" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="white">Z</text>
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.07 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                )}
                                <span className="font-bold text-white">Sign up with {providerLabel}</span>
                            </div>
                            <button onClick={closeSocialModal} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                        </div>

                        <p className="text-gray-400 text-sm mb-4">
                            Enter your details to create your TrustVaultX account.
                            {socialModal === 'zoho' && <span className="block text-xs text-gray-500 mt-1">Accepted: @zoho.com, @zoho.in, @zoho.eu</span>}
                        </p>

                        <form onSubmit={handleSocialSignup} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Your full name"
                                value={socialName}
                                onChange={e => setSocialName(e.target.value)}
                                autoFocus
                                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/50 placeholder:text-gray-600"
                            />
                            <input
                                type="email"
                                placeholder={providerPlaceholder}
                                value={socialEmail}
                                onChange={e => setSocialEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/50 placeholder:text-gray-600"
                            />
                            {socialError && (
                                <p className="text-red-400 text-xs">{socialError}</p>
                            )}
                            <button
                                type="submit"
                                disabled={socialLoading}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-white text-black hover:bg-gray-100"
                            >
                                {socialLoading ? (
                                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : `Create account with ${providerLabel}`}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full max-w-[400px] mx-auto space-y-2">
                <PinterestInput
                    id="email"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <PinterestInput
                    id="password"
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <PinterestInput
                    id="age"
                    type="text"
                    label="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                />

                <div className="mt-4 pb-2">
                    <PinterestButton type="submit" isLoading={isLoading}>
                        Continue
                    </PinterestButton>
                </div>

                <div className="relative my-6 text-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/30"></div>
                    </div>
                    <span className="relative bg-transparent px-2 text-sm font-bold text-white drop-shadow-md">OR</span>
                </div>

                <div className="space-y-3">
                    <PinterestButton
                        type="button"
                        variant="social"
                        onClick={() => openSocialModal('zoho')}
                        icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#E42527"/><text x="12" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="white">Z</text></svg>}
                    >
                        Continue with Zoho Mail
                    </PinterestButton>
                    <PinterestButton
                        type="button"
                        variant="social"
                        onClick={() => openSocialModal('google')}
                        icon={<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 22.6 12 22 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.07 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>}
                    >
                        Continue with Google
                    </PinterestButton>
                </div>

                <div className="text-center mt-6 text-sm font-medium text-white drop-shadow-md">
                    Already a member? <Link href="/auth/signin" className="text-white hover:underline font-bold">Log in</Link>
                </div>
            </form>
        </PinterestAuthLayout>
    );
}
