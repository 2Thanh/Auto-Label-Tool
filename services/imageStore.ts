/**
 * IndexedDB persistence for DatasetImage records.
 * Stores image file data as ArrayBuffer so annotations survive page reloads
 * and are accessible across role switches (annotator → reviewer).
 *
 * Cross-tab real-time sync is done via BroadcastChannel('neurolabel_images'):
 * whenever an image is saved or removed, a message is broadcast so other tabs
 * (e.g. the reviewer's tab) can update their React state without a page refresh.
 */
import { AnnotationStatus, BoundingBox, DatasetImage, RejectionFeedback } from '../types';

const DB_NAME = 'neurolabel_db';
const DB_VERSION = 1;
const STORE = 'images';
const CHANNEL_NAME = 'neurolabel_images';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredRecord {
  id: string;
  ownerId?: string;
  ownerName?: string;
  fileName: string;
  fileType: string;
  fileData: ArrayBuffer;
  width: number;
  height: number;
  boxes: BoundingBox[];
  status: AnnotationStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectionFeedback?: RejectionFeedback;
}

/** Message broadcast to all other tabs when an image changes. */
export type ImageSyncMessage =
  | {
      type: 'image_saved';
      imageId: string;
      ownerId?: string;
      ownerName?: string;
      status: AnnotationStatus;
      boxes: BoundingBox[];
      submittedAt?: string;
      approvedAt?: string;
      rejectionFeedback?: RejectionFeedback;
    }
  | { type: 'image_removed'; imageId: string; ownerId?: string };

export interface LoadedImage {
  image: DatasetImage;
  fileData: ArrayBuffer;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = e => reject((e.target as IDBOpenDBRequest).error);
  });
}

// ─── BroadcastChannel (sender singleton) ─────────────────────────────────────

let _channel: BroadcastChannel | null = null;

function broadcast(msg: ImageSyncMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME);
  _channel.postMessage(msg);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordToLoaded(rec: StoredRecord): LoadedImage {
  const file = new File([rec.fileData], rec.fileName, { type: rec.fileType || 'image/jpeg' });
  const url = URL.createObjectURL(file);
  return {
    image: {
      id: rec.id,
      ownerId: rec.ownerId,
      ownerName: rec.ownerName,
      file,
      url,
      width: rec.width,
      height: rec.height,
      boxes: rec.boxes,
      status: rec.status,
      submittedAt: rec.submittedAt,
      approvedAt: rec.approvedAt,
      rejectionFeedback: rec.rejectionFeedback,
    },
    fileData: rec.fileData,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load all images from IndexedDB. Returns empty array on any failure. */
export async function loadAllImages(): Promise<LoadedImage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredRecord[]).map(recordToLoaded));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Load a single image by id. Returns null if not found or on error. */
export async function loadImageById(id: string): Promise<LoadedImage | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredRecord | undefined;
        resolve(rec ? recordToLoaded(rec) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Upsert an image record and broadcast the change to other tabs.
 * fileData is the pre-read ArrayBuffer of img.file (cached in App.tsx).
 */
export async function saveImageToStore(img: DatasetImage, fileData: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    const record: StoredRecord = {
      id: img.id,
      ownerId: img.ownerId,
      ownerName: img.ownerName,
      fileName: img.file.name,
      fileType: img.file.type || 'image/jpeg',
      fileData,
      width: img.width,
      height: img.height,
      boxes: img.boxes,
      status: img.status,
      submittedAt: img.submittedAt,
      approvedAt: img.approvedAt,
      rejectionFeedback: img.rejectionFeedback,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // Notify other tabs after the write is confirmed
    broadcast({
      type: 'image_saved',
      imageId: img.id,
      ownerId: img.ownerId,
      ownerName: img.ownerName,
      status: img.status,
      boxes: img.boxes,
      submittedAt: img.submittedAt,
      approvedAt: img.approvedAt,
      rejectionFeedback: img.rejectionFeedback,
    });
  } catch {
    // Persistence is best-effort; silently ignore if unavailable
  }
}

/** Remove a single image record from IndexedDB and notify other tabs. */
export async function removeImageFromStore(id: string, ownerId?: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    broadcast({ type: 'image_removed', imageId: id, ownerId });
  } catch {
    // Silently ignore
  }
}

/** The channel name — used by App.tsx to subscribe to incoming messages. */
export { CHANNEL_NAME };
