// IndexedDB helper for Chat History.
// Uses a DEDICATED database ('TVaultChats') so it never conflicts
// with other stores that may be at different versions or in bad states.

const DB_NAME = 'TVaultChats';
const DB_VERSION = 1;
const STORE = 'chatSessions';

export interface ChatMessage {
    sender: 'user' | 'partner';
    text: string;
    timestamp: number;
}

export interface ChatSession {
    id: string;
    partnerId: string;
    partnerName: string;
    date: string;
    timestamp: number;
    messages: ChatMessage[];
    size: string;
}

// ── DB open ────────────────────────────────────────────────────────────────────
const openDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
    });

// ── Save chat session ──────────────────────────────────────────────────────────
export const saveChatSession = async (session: ChatSession): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
            tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(session);
        } catch (e) { reject(e); return; }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Chat save failed'));
    });
};

// ── Get all chat sessions ──────────────────────────────────────────────────────
export const getAllChatSessions = async (): Promise<ChatSession[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () =>
            resolve((req.result ?? []).sort((a, b) => b.timestamp - a.timestamp));
        req.onerror = () => reject(req.error);
    });
};

// ── Delete chat session ────────────────────────────────────────────────────────
export const deleteChatSession = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// ── Utility ────────────────────────────────────────────────────────────────────
export const calculateChatSize = (messages: ChatMessage[]): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(messages)).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
};
