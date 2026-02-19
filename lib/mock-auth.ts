// Mock authentication for standalone app
// This replaces next-auth functionality

export const mockSession = {
    user: {
        id: 'demo-user-1',
        name: 'Demo User',
        email: 'demo@example.com',
        image: 'https://ui-avatars.com/api/?name=Demo+User&background=random',
        profilePic: 'https://ui-avatars.com/api/?name=Demo+User&background=random',
        bio: 'Demo user for testing',
        role: 'Developer'
    }
};

export interface LoginRecord {
    id: string;
    email: string;
    name: string;
    method: 'email' | 'google' | 'zoho';
    timestamp: number;
    date: string;
    status: 'success' | 'failed';
    ip: string;
}

/** Generate a deterministic mock IP from email — same email always gets same IP */
function generateMockIP(email: string): string {
    let h = 5381;
    for (let i = 0; i < email.length; i++) {
        h = ((h << 5) + h) ^ email.charCodeAt(i);
    }
    const abs = Math.abs(h);
    const a = (abs % 200) + 10;       // 10–209
    const b = ((abs >> 8) % 200) + 10; // 10–209
    return `192.168.${a}.${b}`;
}

/** Save a login event to localStorage */
export function recordLogin(record: Omit<LoginRecord, 'id' | 'date' | 'ip'>): void {
    if (typeof window === 'undefined') return;
    try {
        const existing: LoginRecord[] = JSON.parse(localStorage.getItem('tvx_login_records') || '[]');
        const newRecord: LoginRecord = {
            ...record,
            id: `login-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: new Date(record.timestamp).toLocaleString(),
            // Deterministic mock IP — same email always shows same IP
            ip: generateMockIP(record.email),
        };
        existing.unshift(newRecord); // newest first
        // Keep last 200 records
        localStorage.setItem('tvx_login_records', JSON.stringify(existing.slice(0, 200)));
    } catch (_) { /* ignore */ }
}

/** Read all login records from localStorage */
export function getLoginRecords(): LoginRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem('tvx_login_records') || '[]');
    } catch (_) {
        return [];
    }
}

export function useSession() {
    // Read session from localStorage if available (set during signIn)
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('tvx_session');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { data: { user: parsed }, status: 'authenticated' as const };
            }
        } catch (_) { /* ignore */ }
    }
    return { data: mockSession, status: 'authenticated' as const };
}

export async function signIn(provider?: string, options?: Record<string, unknown>) {
    console.log('Mock signIn called:', provider, options);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const email = (options?.email as string) || 'demo@example.com';
    const name = (options?.name as string) || email.split('@')[0] || 'User';

    // Generate a stable profile ID based on email
    const profileId = generateProfileId(email);

    const sessionUser = {
        id: profileId,
        name,
        email,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        bio: '',
        role: 'User',
        profileId,
    };

    // Persist session so useSession() picks it up
    if (typeof window !== 'undefined') {
        localStorage.setItem('tvx_session', JSON.stringify(sessionUser));
    }

    // Record the login event
    recordLogin({
        email,
        name,
        method: provider === 'google' ? 'google' : provider === 'zoho' ? 'zoho' : 'email',
        timestamp: Date.now(),
        status: 'success',
    });

    return {
        ok: true,
        error: null,
        status: 200,
        url: null
    };
}

export function signOut() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('tvx_session');
    }
    console.log('Mock signOut called');
}

/** Generate a deterministic, human-readable profile ID from an email */
export function generateProfileId(email: string): string {
    // Simple hash — keeps same ID per email across page loads
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = (hash << 5) - hash + email.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
    const prefix = email.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    return `TVX-${prefix}-${hex}`;
}
