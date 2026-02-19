// IndexedDB helper for Zoom recordings with Recycle Bin support.
// Uses a DEDICATED database ('TVaultRecordings') so it never conflicts
// with other stores that may be at different versions or in bad states.

const DB_NAME = 'TVaultRecordings';
const DB_VERSION = 1;
const STORE = 'recordings';
const TRASH = 'trash';

export interface ZoomRecording {
    id: string;
    roomId: string;
    date: string;
    duration: string;
    size: string;
    blob: Blob;
    timestamp: number;
    deletedAt?: number;
}

// ── Internal stored format ─────────────────────────────────────────────────────
// Blobs can silently fail to persist in some browser/security contexts.
// ArrayBuffer is always structured-cloneable and universally reliable.
interface Stored extends Omit<ZoomRecording, 'blob'> {
    blobData: ArrayBuffer;
    blobType: string;
}

// Blob → ArrayBuffer via FileReader (widest browser support, avoids blob.arrayBuffer() quirks)
const blobToAB = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsArrayBuffer(blob);
    });

// ZoomRecording → Stored
const pack = async (r: ZoomRecording): Promise<Stored> => {
    const blobData = await blobToAB(r.blob);
    const { blob, ...rest } = r;
    return { ...rest, blobData, blobType: r.blob.type || 'video/webm' };
};

// Stored (or legacy Blob format) → ZoomRecording
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unpack = (s: any): ZoomRecording => {
    if (s && s.blobData instanceof ArrayBuffer) {
        const { blobData, blobType, ...rest } = s;
        return { ...rest, blob: new Blob([blobData], { type: blobType || 'video/webm' }) };
    }
    return s as ZoomRecording; // legacy: blob stored directly — return as-is
};

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
            if (!db.objectStoreNames.contains(TRASH)) {
                db.createObjectStore(TRASH, { keyPath: 'id' });
            }
        };
    });

// ── Save ───────────────────────────────────────────────────────────────────────
export const saveRecording = async (recording: ZoomRecording): Promise<void> => {
    // Convert blob FIRST — before opening DB, to surface any read errors early
    const stored = await pack(recording);
    const db = await openDB();

    return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
            tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(stored);
        } catch (e) {
            reject(e);
            return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IDB write error'));
        tx.onabort = () => reject(new Error('IDB transaction aborted: ' + (tx.error?.message ?? 'unknown')));
    });
};

// ── Read all recordings ────────────────────────────────────────────────────────
export const getAllRecordings = async (): Promise<ZoomRecording[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () =>
            resolve((req.result ?? []).map(unpack).sort((a, b) => b.timestamp - a.timestamp));
        req.onerror = () => reject(req.error);
    });
};

// ── Read by ID ─────────────────────────────────────────────────────────────────
export const getRecordingById = async (id: string): Promise<ZoomRecording | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result ? unpack(req.result) : undefined);
        req.onerror = () => reject(req.error);
    });
};

// ── Move to Recycle Bin ────────────────────────────────────────────────────────
// Reads the raw stored record (already ArrayBuffer) and copies directly to
// trash — no Blob conversion needed so no format mismatch can occur.
export const moveToTrash = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const readReq = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        readReq.onsuccess = () => {
            const record = readReq.result;
            if (!record) { resolve(); return; }

            let tx: IDBTransaction;
            try {
                tx = db.transaction([STORE, TRASH], 'readwrite');
                tx.objectStore(TRASH).put({ ...record, deletedAt: Date.now() });
                tx.objectStore(STORE).delete(id);
            } catch (e) { reject(e); return; }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };
        readReq.onerror = () => reject(readReq.error);
    });
};

// ── Get all trash recordings ───────────────────────────────────────────────────
export const getTrashRecordings = async (): Promise<ZoomRecording[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(TRASH, 'readonly').objectStore(TRASH).getAll();
        req.onsuccess = () =>
            resolve((req.result ?? []).map(unpack).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)));
        req.onerror = () => reject(req.error);
    });
};

// ── Restore from Recycle Bin ──────────────────────────────────────────────────
export const restoreFromTrash = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const readReq = db.transaction(TRASH, 'readonly').objectStore(TRASH).get(id);
        readReq.onsuccess = () => {
            const record = readReq.result;
            if (!record) { reject(new Error('Recording not found in trash')); return; }

            const { deletedAt: _removed, ...restored } = record;
            let tx: IDBTransaction;
            try {
                tx = db.transaction([STORE, TRASH], 'readwrite');
                tx.objectStore(STORE).put(restored);
                tx.objectStore(TRASH).delete(id);
            } catch (e) { reject(e); return; }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };
        readReq.onerror = () => reject(readReq.error);
    });
};

// ── Permanently delete from Recycle Bin ───────────────────────────────────────
export const permanentlyDelete = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(TRASH, 'readwrite').objectStore(TRASH).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// ── Empty entire Recycle Bin ───────────────────────────────────────────────────
export const emptyTrash = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(TRASH, 'readwrite').objectStore(TRASH).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// ── Legacy alias ───────────────────────────────────────────────────────────────
export const deleteRecording = moveToTrash;
