import React, { useState, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  AnnotationStatus,
  BoundingBox,
  DatasetImage,
  ExternalModelPrediction,
  LabelClass,
  RejectionFeedback,
  ReviewRules,
  Session,
} from './types';
import Editor from './components/Editor';
import Dashboard from './components/Dashboard';
import InferenceApiModal from './components/InferenceApiModal';
import ClassManagerModal from './components/ClassManagerModal';
import ReviewQueueView from './components/ReviewQueueView';
import ReviewRulesModal from './components/ReviewRulesModal';
import LoginScreen from './components/LoginScreen';
import UserManagerModal from './components/UserManagerModal';
import { detectObjectsWithGemini } from './services/geminiService';
import { clearSession, loadSession, saveSession, toAppRole } from './services/authService';
import { LABEL_COLORS, DEFAULT_CLASSES } from './constants';
import { parseYoloFile } from './utils/yoloParser';
import { DEFAULT_REVIEW_RULES, exportApprovedImage } from './utils/reviewRules';
import {
  loadAllImages,
  loadImageById,
  saveImageToStore,
  removeImageFromStore,
  CHANNEL_NAME,
} from './services/imageStore';
import type { ImageSyncMessage } from './services/imageStore';

// Icons
const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const PhotoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const ChartIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const SparklesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 3.214L13 21l-2.286-6.857L5 12l5.714-3.214z" /></svg>;
const ServerIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>;
const FolderIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
const DownloadIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const TagIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
const SearchIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const XCircleIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const SendIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const ClipboardCheckIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// Status badge dot config
const STATUS_BADGE: Record<AnnotationStatus, { bg: string; title: string }> = {
  unannotated:    { bg: 'bg-gray-500',   title: 'Unannotated' },
  in_progress:    { bg: 'bg-orange-400', title: 'In Progress' },
  pending_review: { bg: 'bg-yellow-400', title: 'Pending Review' },
  approved:       { bg: 'bg-green-500',  title: 'Approved' },
  rejected:       { bg: 'bg-red-500',    title: 'Rejected' },
};

const App: React.FC = () => {
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [classes, setClasses] = useState<LabelClass[]>(DEFAULT_CLASSES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [view, setView] = useState<'editor' | 'dashboard' | 'review_queue'>('editor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'labeled' | 'unlabeled' | AnnotationStatus>('all');

  // Session & auth
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const role = session ? toAppRole(session.role) : 'annotator';
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);

  // Persist session to sessionStorage
  useEffect(() => {
    if (session) saveSession(session); else clearSession();
  }, [session]);

  // Review state
  const [reviewRules, setReviewRules] = useState<ReviewRules>(() => {
    try {
      const stored = localStorage.getItem('neurolabel_review_rules');
      return stored ? JSON.parse(stored) : DEFAULT_REVIEW_RULES;
    } catch {
      return DEFAULT_REVIEW_RULES;
    }
  });
  const [approvedOutputDirHandle, setApprovedOutputDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isReviewRulesModalOpen, setIsReviewRulesModalOpen] = useState(false);

  // API Integration state
  const [isInferenceApiModalOpen, setIsInferenceApiModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);

  // Persistence: IndexedDB
  const [isDBLoading, setIsDBLoading] = useState(true);
  // Cache of ArrayBuffer per image id — avoids re-reading File on every save
  const imageFileDataRef = useRef<Map<string, ArrayBuffer>>(new Map());
  // Mirror of images state accessible in timeouts without stale closure
  const imagesRef = useRef<DatasetImage[]>([]);
  // Stable ref to session so the BroadcastChannel listener never closes over a stale value
  const sessionRef = useRef(session);
  // Debounce box-update saves (boxes change on every mouse-move during draw)
  const pendingBoxSavesRef = useRef<Set<string>>(new Set());
  const boxSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedImage = images.find(img => img.id === selectedImageId);

  // Persist review rules to localStorage
  useEffect(() => {
    localStorage.setItem('neurolabel_review_rules', JSON.stringify(reviewRules));
  }, [reviewRules]);

  // Load persisted images from IndexedDB on mount, filtered by role:
  //   annotator → only their own images (ownerId === userId)
  //   reviewer / admin → all images across every annotator
  useEffect(() => {
    const currentSession = sessionRef.current;
    const currentRole = currentSession ? toAppRole(currentSession.role) : 'annotator';
    const userId = currentSession?.userId;

    loadAllImages()
      .then(loaded => {
        const visible =
          currentRole === 'reviewer'
            ? loaded
            : loaded.filter(l => l.image.ownerId === userId);

        visible.forEach(({ image, fileData }) => {
          imageFileDataRef.current.set(image.id, fileData);
        });
        if (visible.length > 0) {
          const imgs = visible.map(l => l.image);
          setImages(imgs);
          setSelectedImageId(imgs[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setIsDBLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep imagesRef in sync so timeouts can access the latest state
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Keep sessionRef in sync so the BroadcastChannel listener has the current session
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Cross-tab real-time sync: listen for changes made by other tabs (e.g. annotator → reviewer)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (e: MessageEvent<ImageSyncMessage>) => {
      const msg = e.data;
      const currentSession = sessionRef.current;
      const currentRole = currentSession ? toAppRole(currentSession.role) : 'annotator';
      const isAnnotator = currentRole === 'annotator';

      if (msg.type === 'image_saved') {
        // Annotators only care about their own images
        if (isAnnotator && msg.ownerId && msg.ownerId !== currentSession?.userId) return;

        setImages(prev => {
          if (prev.some(img => img.id === msg.imageId)) {
            // Image already in state — just update mutable metadata
            return prev.map(img =>
              img.id === msg.imageId
                ? {
                    ...img,
                    status: msg.status,
                    boxes: msg.boxes,
                    submittedAt: msg.submittedAt,
                    approvedAt: msg.approvedAt,
                    rejectionFeedback: msg.rejectionFeedback,
                  }
                : img
            );
          }
          // Image is new to this tab — load file data from DB then add to state
          loadImageById(msg.imageId).then(loaded => {
            if (!loaded) return;
            // Double-check ownership before adding (handles race where session changed)
            if (isAnnotator && loaded.image.ownerId && loaded.image.ownerId !== currentSession?.userId) return;
            imageFileDataRef.current.set(loaded.image.id, loaded.fileData);
            setImages(prev2 =>
              prev2.some(i => i.id === loaded.image.id)
                ? prev2
                : [...prev2, loaded.image]
            );
          });
          return prev; // will update when async load completes
        });
      } else if (msg.type === 'image_removed') {
        // Annotators only care about their own images
        if (isAnnotator && msg.ownerId && msg.ownerId !== currentSession?.userId) return;
        imageFileDataRef.current.delete(msg.imageId);
        setImages(prev => prev.filter(img => img.id !== msg.imageId));
      }
    };

    return () => channel.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter images
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const matchesSearch = img.file.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'labeled') return img.boxes.length > 0;
      if (filter === 'unlabeled') return img.boxes.length === 0;
      if (filter === 'unannotated') return img.status === 'unannotated';
      if (filter === 'in_progress') return img.status === 'in_progress';
      if (filter === 'pending_review') return img.status === 'pending_review';
      if (filter === 'approved') return img.status === 'approved';
      if (filter === 'rejected') return img.status === 'rejected';
      return true;
    }).sort((a, b) => a.file.name.localeCompare(b.file.name));
  }, [images, filter, searchTerm]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  // Debounced DB save for box updates (called on every mouse-move during draw)
  const scheduleBoxSave = (imageId: string) => {
    pendingBoxSavesRef.current.add(imageId);
    if (boxSaveTimerRef.current) clearTimeout(boxSaveTimerRef.current);
    boxSaveTimerRef.current = setTimeout(() => {
      const toSave = new Set(pendingBoxSavesRef.current);
      pendingBoxSavesRef.current.clear();
      imagesRef.current.forEach(img => {
        if (!toSave.has(img.id)) return;
        const fileData = imageFileDataRef.current.get(img.id);
        if (fileData) saveImageToStore(img, fileData).catch(console.error);
      });
    }, 800);
  };

  const handleUpdateBoxes = (imageId: string, boxes: BoundingBox[]) => {
    setImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      // Auto-transition: unannotated → in_progress when first box is added
      let status = img.status;
      if (status === 'unannotated' && boxes.length > 0) status = 'in_progress';
      return { ...img, boxes, status };
    }));
    scheduleBoxSave(imageId);
  };

  const handleAddClass = (id: number, name: string) => {
    if (classes.some(c => c.id === id)) {
      alert(`Class ID ${id} already exists.`);
      return;
    }
    if (classes.some(c => c.name === name)) {
      alert(`Class Name '${name}' already exists.`);
      return;
    }
    setClasses(prev => [...prev, { id, name }].sort((a, b) => a.id - b.id));
  };

  const applyPredictions = (predictions: ExternalModelPrediction[]) => {
    if (!selectedImage) return;

    let updatedClasses = [...classes];
    let hasNewClasses = false;
    let nextId = updatedClasses.length > 0 ? Math.max(...updatedClasses.map(c => c.id)) + 1 : 0;

    predictions.forEach(p => {
      const labelName = p.label.trim();
      if (!updatedClasses.some(c => c.name === labelName)) {
        updatedClasses.push({ id: nextId, name: labelName });
        nextId++;
        hasNewClasses = true;
      }
    });

    if (hasNewClasses) setClasses(updatedClasses);

    const newBoxes: BoundingBox[] = predictions.map(p => {
      const labelName = p.label.trim();
      const clsIndex = updatedClasses.findIndex(c => c.name === labelName);
      const color = clsIndex !== -1 ? LABEL_COLORS[clsIndex % LABEL_COLORS.length] : '#999';
      return {
        id: generateId(),
        x: p.xmin,
        y: p.ymin,
        width: p.xmax - p.xmin,
        height: p.ymax - p.ymin,
        label: labelName,
        color,
        score: p.score,
      };
    });

    handleUpdateBoxes(selectedImage.id, [...selectedImage.boxes, ...newBoxes]);
  };

  // --- Review workflow handlers ---

  const handleSubmitForReview = (imageId: string) => {
    const submittedAt = new Date().toISOString();
    setImages(prev => prev.map(img =>
      img.id === imageId
        ? { ...img, status: 'pending_review', submittedAt, rejectionFeedback: undefined }
        : img
    ));
    const img = imagesRef.current.find(i => i.id === imageId);
    if (img) {
      const updated = { ...img, status: 'pending_review' as AnnotationStatus, submittedAt, rejectionFeedback: undefined };
      const fileData = imageFileDataRef.current.get(imageId);
      if (fileData) saveImageToStore(updated, fileData).catch(console.error);
    }
  };

  const handleApproveImage = async (imageId: string) => {
    if (role !== 'reviewer') return;
    const image = imagesRef.current.find(img => img.id === imageId);
    if (!image) return;

    const approvedAt = new Date().toISOString();
    const approvedImage = { ...image, status: 'approved' as AnnotationStatus, approvedAt };

    setImages(prev => prev.map(img =>
      img.id === imageId ? approvedImage : img
    ));

    const fileData = imageFileDataRef.current.get(imageId);
    if (fileData) saveImageToStore(approvedImage, fileData).catch(console.error);

    try {
      await exportApprovedImage(image, classes, approvedOutputDirHandle ?? undefined);
    } catch (err) {
      alert('Export failed: ' + (err as Error).message);
    }
  };

  const handleRejectImage = (imageId: string, feedback: RejectionFeedback) => {
    setImages(prev => prev.map(img =>
      img.id === imageId
        ? { ...img, status: 'rejected', rejectionFeedback: feedback }
        : img
    ));
    const img = imagesRef.current.find(i => i.id === imageId);
    if (img) {
      const updated = { ...img, status: 'rejected' as AnnotationStatus, rejectionFeedback: feedback };
      const fileData = imageFileDataRef.current.get(imageId);
      if (fileData) saveImageToStore(updated, fileData).catch(console.error);
    }
  };

  const handleSetOutputFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the File System Access API. Approved images will be downloaded as ZIP files instead.');
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setApprovedOutputDirHandle(handle);
    } catch {
      // User cancelled
    }
  };

  // --- Gemini & API ---

  const handleGeminiAutoLabel = async () => {
    if (!selectedImage) return;
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(selectedImage.file);
      const predictions = await detectObjectsWithGemini(base64, selectedImage.file.type);
      applyPredictions(predictions);
    } catch (error) {
      alert('Failed to auto-label: ' + (error as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openInferenceApiModal = async () => {
    if (!selectedImage) return;
    const base64 = await fileToBase64(selectedImage.file);
    setCurrentImageBase64(base64);
    setIsInferenceApiModalOpen(true);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (isInferenceApiModalOpen || isClassManagerOpen) return;
      if (view !== 'editor') return;

      if (filteredImages.length > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const idx = filteredImages.findIndex(img => img.id === selectedImageId);
          if (idx !== -1 && idx < filteredImages.length - 1) setSelectedImageId(filteredImages[idx + 1].id);
          else if (idx === -1 && filteredImages.length > 0) setSelectedImageId(filteredImages[0].id);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const idx = filteredImages.findIndex(img => img.id === selectedImageId);
          if (idx > 0) setSelectedImageId(filteredImages[idx - 1].id);
          else if (idx === -1 && filteredImages.length > 0) setSelectedImageId(filteredImages[0].id);
        }
      }

      if (selectedImage) {
        if (e.key === '1') { e.preventDefault(); openInferenceApiModal(); }
        if (e.key === '2') { e.preventDefault(); if (!isProcessing) handleGeminiAutoLabel(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, filteredImages, view, isInferenceApiModalOpen, isClassManagerOpen, selectedImage, isProcessing, classes]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages: DatasetImage[] = (Array.from(e.target.files) as File[]).map(file => ({
        id: generateId(),
        ownerId: session?.userId,
        ownerName: session?.username,
        file,
        url: URL.createObjectURL(file),
        width: 0,
        height: 0,
        boxes: [],
        status: 'unannotated',
      }));
      setImages(prev => [...prev, ...newImages]);
      if (!selectedImageId && newImages.length > 0) setSelectedImageId(newImages[0].id);
      // Cache file data and persist to IndexedDB
      newImages.forEach(img => {
        img.file.arrayBuffer().then(fileData => {
          imageFileDataRef.current.set(img.id, fileData);
          saveImageToStore(img, fileData).catch(console.error);
        });
      });
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files) as File[];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const txtFiles = files.filter(f => f.name.endsWith('.txt'));
    const classesFile = txtFiles.find(f => f.name === 'classes.txt');

    let updatedClasses = [...classes];

    if (classesFile) {
      const content = await classesFile.text();
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach((name, idx) => {
        if (!updatedClasses.some(c => c.name === name)) {
          updatedClasses.push({ id: idx, name });
        }
      });
      setClasses(updatedClasses);
    }

    const newImages: DatasetImage[] = [];

    for (const imgFile of imageFiles) {
      const basename = imgFile.name.substring(0, imgFile.name.lastIndexOf('.'));
      const txtFile = txtFiles.find(f => f.name === `${basename}.txt`);

      let boxes: BoundingBox[] = [];
      if (txtFile) {
        const content = await txtFile.text();
        const parsedBoxes = parseYoloFile(content, updatedClasses);
        boxes = parsedBoxes.map(b => ({ ...b, id: generateId() }));
      }

      newImages.push({
        id: generateId(),
        ownerId: session?.userId,
        ownerName: session?.username,
        file: imgFile,
        url: URL.createObjectURL(imgFile),
        width: 0,
        height: 0,
        boxes,
        status: boxes.length > 0 ? 'in_progress' : 'unannotated',
      });
    }

    setImages(prev => [...prev, ...newImages]);
    if (!selectedImageId && newImages.length > 0) setSelectedImageId(newImages[0].id);
    // Cache file data and persist to IndexedDB
    newImages.forEach(img => {
      img.file.arrayBuffer().then(fileData => {
        imageFileDataRef.current.set(img.id, fileData);
        saveImageToStore(img, fileData).catch(console.error);
      });
    });
  };

  const handleExportDataset = async (mode: 'flat' | 'split' = 'flat') => {
    if (images.length === 0) { alert('No images to export.'); return; }

    const zip = new JSZip();
    const sortedClasses = [...classes].sort((a, b) => a.id - b.id);
    const root = zip.folder('dataset');
    if (!root) return;

    root.file('classes.txt', sortedClasses.map(c => c.name).join('\n'));

    const imagesFolder = mode === 'split' ? root.folder('images') : root;
    const labelsFolder = mode === 'split' ? root.folder('labels') : root;

    images.forEach(img => {
      imagesFolder?.file(img.file.name, img.file);

      const baseName = img.file.name.split('.').slice(0, -1).join('.');
      const txtName = `${baseName}.txt`;

      const lines = img.boxes.map(box => {
        const cls = classes.find(c => c.name === box.label);
        if (!cls) return null;
        const xc = Math.max(0, Math.min(1, box.x + box.width / 2));
        const yc = Math.max(0, Math.min(1, box.y + box.height / 2));
        const w = Math.max(0, Math.min(1, box.width));
        const h = Math.max(0, Math.min(1, box.height));
        return `${cls.id} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
      }).filter((l): l is string => l !== null);

      if (lines.length > 0 || mode === 'split') {
        labelsFolder?.file(txtName, lines.join('\n'));
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'split' ? 'neurolabel_dataset_split.zip' : 'neurolabel_dataset_flat.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };

  const handleDeleteImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (role !== 'reviewer') return;
    if (window.confirm('Are you sure you want to delete this image?')) {
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
      const deletedImg = imagesRef.current.find(img => img.id === id);
      imageFileDataRef.current.delete(id);
      removeImageFromStore(id, deletedImg?.ownerId).catch(console.error);
    }
  };

  // Annotators can only edit images that are in_progress or rejected (not locked pending_review or approved)
  const canAnnotate = selectedImage &&
    selectedImage.status !== 'approved' &&
    selectedImage.status !== 'pending_review';

  if (isDBLoading) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen onLogin={(s: Session) => { setSession(s); setView(toAppRole(s.role) === 'reviewer' ? 'review_queue' : 'editor'); }} />;

  const ROLE_BADGE: Record<string, string> = {
    annotator: 'bg-indigo-900/60 text-indigo-300',
    reviewer:  'bg-amber-900/60 text-amber-300',
    admin:     'bg-red-900/60 text-red-300',
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header with user info */}
        <div className="p-3 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-sm">N</span>
            </div>
            <h1 className="font-bold text-base tracking-tight">NeuroLabel</h1>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-gray-300 font-mono truncate">{session.username}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold capitalize flex-shrink-0 ${ROLE_BADGE[session.role] ?? 'bg-gray-700 text-gray-300'}`}>
                {session.role}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {session.role === 'admin' && (
                <button
                  onClick={() => setIsUserManagerOpen(true)}
                  className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                  title="Manage Users"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </button>
              )}
              <button
                onClick={() => setSession(null)}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                title="Sign out"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex p-2 gap-1 border-b border-gray-700">
          <button
            onClick={() => setView('editor')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${view === 'editor' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Editor"
          >
            <PhotoIcon />
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Stats"
          >
            <ChartIcon />
          </button>
          {role === 'reviewer' && (
            <button
              onClick={() => setView('review_queue')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${view === 'review_queue' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
              title="Review Queue"
            >
              <ClipboardCheckIcon />
            </button>
          )}
          <button
            onClick={() => setIsClassManagerOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:bg-gray-700 hover:text-white"
            title="Manage Classes"
          >
            <TagIcon />
          </button>
        </div>

        {/* Image List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="flex flex-col items-center justify-center gap-1 p-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition cursor-pointer bg-gray-800/50">
              <PlusIcon />
              <span className="text-xs font-medium">Files</span>
              <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            <label className="flex flex-col items-center justify-center gap-1 p-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition cursor-pointer bg-gray-800/50">
              <FolderIcon />
              <span className="text-xs font-medium">YOLO Dir</span>
              {/* @ts-ignore: webkitdirectory is standard in Chrome/FF/Edge but not in React types yet */}
              <input type="file" multiple webkitdirectory="" directory="" onChange={handleFolderUpload} className="hidden" />
            </label>
          </div>

          {/* Export Dropdown */}
          <div className="relative mb-4">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-full flex items-center justify-center gap-2 p-2 bg-indigo-900/50 text-indigo-300 border border-indigo-700 rounded-lg hover:bg-indigo-900 transition-colors text-xs font-bold uppercase tracking-wider"
            >
              <DownloadIcon /> Export Dataset
              <svg className={`w-4 h-4 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isExportDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden flex flex-col">
                <button onClick={() => handleExportDataset('flat')} className="px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border-b border-gray-700">
                  <span className="font-bold block">Flat Structure</span>
                  <span className="text-[10px] text-gray-500">Img & Txt side-by-side</span>
                </button>
                <button onClick={() => handleExportDataset('split')} className="px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <span className="font-bold block">Split Structure</span>
                  <span className="text-[10px] text-gray-500">/images and /labels folders</span>
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search images..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-400 transition-colors">
                <XCircleIcon />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          {images.length > 0 && (
            <div className="flex items-center gap-1 mb-2 bg-gray-900 p-1 rounded-lg border border-gray-700 flex-wrap">
              {(['all', 'labeled', 'unlabeled'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 text-[10px] uppercase font-bold py-1 px-1 rounded transition-colors ${filter === f ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {f === 'labeled' ? 'Done' : f === 'unlabeled' ? 'Todo' : 'All'}
                </button>
              ))}
            </div>
          )}

          {/* Status filter row */}
          {images.length > 0 && (
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {(['pending_review', 'approved', 'rejected'] as AnnotationStatus[]).map(s => {
                const badge = STATUS_BADGE[s];
                const count = images.filter(img => img.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(filter === s ? 'all' : s)}
                    className={`flex items-center gap-1 text-[10px] font-bold py-1 px-2 rounded transition-colors border ${filter === s ? 'bg-gray-700 text-white border-gray-500' : 'text-gray-500 border-gray-700 hover:text-gray-300'}`}
                    title={badge.title}
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.bg} flex-shrink-0`} />
                    {s === 'pending_review' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1)}
                    {count > 0 && <span className="ml-0.5 opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Image list */}
          {filteredImages.map(img => {
            const badge = STATUS_BADGE[img.status];
            return (
              <div
                key={img.id}
                onClick={() => { setSelectedImageId(img.id); setView('editor'); }}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group relative pr-8 ${selectedImageId === img.id ? 'bg-gray-700 ring-1 ring-indigo-500' : 'hover:bg-gray-700/50'}`}
              >
                <div className="w-10 h-10 rounded bg-gray-900 flex-shrink-0 overflow-hidden border border-gray-600 relative">
                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                  <div className={`absolute top-0 right-0 w-2.5 h-2.5 ${badge.bg} rounded-bl-md`} title={badge.title} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-200">{img.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {img.boxes.length > 0 ? `${img.boxes.length} objects` : 'No labels'} · <span className="capitalize">{img.status.replace('_', ' ')}</span>
                  </p>
                </div>
                {role === 'reviewer' && (
                  <div
                    onClick={e => handleDeleteImage(e, img.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                    title="Delete Image"
                  >
                    <TrashIcon />
                  </div>
                )}
              </div>
            );
          })}

          {images.length === 0 && (
            <div className="text-center p-4 text-gray-500 text-sm mt-10">
              No images loaded.<br />Import to start.
            </div>
          )}

          {images.length > 0 && filteredImages.length === 0 && (
            <div className="text-center p-4 text-gray-500 text-xs mt-4">
              No images match filter.
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar — editor view */}
        {view === 'editor' && (
          <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
            <h2 className="font-medium text-gray-200 truncate max-w-xs">
              {selectedImage ? selectedImage.file.name : 'No image selected'}
            </h2>

            <div className="flex items-center gap-2">
              {/* Submit for review — only for annotator role, only when there's something to submit */}
              {role === 'annotator' && selectedImage && (selectedImage.status === 'in_progress' || selectedImage.status === 'rejected') && (
                <button
                  onClick={() => handleSubmitForReview(selectedImage.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm transition-colors shadow"
                >
                  <SendIcon /> Submit for Review
                </button>
              )}

              {canAnnotate && (
                <>
                  <button
                    onClick={openInferenceApiModal}
                    disabled={!selectedImage}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-indigo-400 hover:text-indigo-300 rounded text-sm transition-colors disabled:opacity-50 border border-gray-600 font-mono"
                  >
                    <ServerIcon />
                    Connect API (1)
                  </button>

                  <button
                    onClick={handleGeminiAutoLabel}
                    disabled={!selectedImage || isProcessing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded text-sm transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/20"
                  >
                    {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SparklesIcon />}
                    AI Auto-Label (2)
                  </button>
                </>
              )}

              {selectedImage?.status === 'pending_review' && (
                <span className="text-xs text-yellow-400 font-semibold border border-yellow-700 bg-yellow-900/30 px-3 py-1.5 rounded">
                  Under Review — read only
                </span>
              )}
              {selectedImage?.status === 'approved' && (
                <span className="text-xs text-green-400 font-semibold border border-green-700 bg-green-900/30 px-3 py-1.5 rounded">
                  Approved — read only
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {view === 'editor' ? (
            selectedImage ? (
              <Editor
                image={selectedImage}
                availableClasses={classes}
                onUpdateBoxes={handleUpdateBoxes}
                onAddClass={handleAddClass}
                isReadOnly={selectedImage.status === 'approved' || selectedImage.status === 'pending_review'}
                onSubmitForReview={
                  role === 'annotator' &&
                  (selectedImage.status === 'in_progress' || selectedImage.status === 'rejected')
                    ? () => handleSubmitForReview(selectedImage.id)
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <PhotoIcon />
                <p className="mt-2">Select or import an image to start labeling</p>
              </div>
            )
          ) : view === 'dashboard' ? (
            <Dashboard images={images} />
          ) : (
            <ReviewQueueView
              images={images}
              classes={classes}
              reviewRules={reviewRules}
              approvedOutputDirHandle={approvedOutputDirHandle}
              onApprove={handleApproveImage}
              onReject={handleRejectImage}
              onOpenRulesModal={() => setIsReviewRulesModalOpen(true)}
              onSetOutputFolder={handleSetOutputFolder}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <InferenceApiModal
        isOpen={isInferenceApiModalOpen}
        onClose={() => setIsInferenceApiModalOpen(false)}
        onRun={applyPredictions}
        imageBase64={currentImageBase64}
      />

      <ClassManagerModal
        isOpen={isClassManagerOpen}
        onClose={() => setIsClassManagerOpen(false)}
        classes={classes}
        setClasses={setClasses}
      />

      <ReviewRulesModal
        isOpen={isReviewRulesModalOpen}
        onClose={() => setIsReviewRulesModalOpen(false)}
        rules={reviewRules}
        onSave={rules => { setReviewRules(rules); setIsReviewRulesModalOpen(false); }}
        availableClasses={classes}
      />

      <UserManagerModal
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
        currentSession={session}
      />
    </div>
  );
};

export default App;
