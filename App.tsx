import React, { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import { BoundingBox, DatasetImage, ExternalModelPrediction, LabelClass } from './types';
import Editor from './components/Editor';
import Dashboard from './components/Dashboard';
import InferenceApiModal from './components/InferenceApiModal';
import ClassManagerModal from './components/ClassManagerModal';
import { detectObjectsWithGemini } from './services/geminiService';
import { LABEL_COLORS, DEFAULT_CLASSES } from './constants';
import { parseYoloFile } from './utils/yoloParser';

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
const generateId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
};
const App: React.FC = () => {
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [classes, setClasses] = useState<LabelClass[]>(DEFAULT_CLASSES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [view, setView] = useState<'editor' | 'dashboard'>('editor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'labeled' | 'unlabeled'>('all');
  
  // API Integration state
  const [isInferenceApiModalOpen, setIsInferenceApiModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);

  const selectedImage = images.find(img => img.id === selectedImageId);

  // Filter images based on selection
  const filteredImages = useMemo(() => {
    return images.filter(img => {
        // Search Filter
        const matchesSearch = img.file.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Status Filter
        if (filter === 'labeled') return img.boxes.length > 0;
        if (filter === 'unlabeled') return img.boxes.length === 0;
        return true;
    }).sort((a, b) => a.file.name.localeCompare(b.file.name));
  }, [images, filter, searchTerm]);

  // Helper to convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
           const base64 = reader.result.split(',')[1];
           resolve(base64);
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleUpdateBoxes = (imageId: string, boxes: BoundingBox[]) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, boxes } : img));
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
      
      // 1. Identify and add any missing classes from the predictions
      let updatedClasses = [...classes];
      let hasNewClasses = false;
      // Calculate next available ID
      let nextId = updatedClasses.length > 0 ? Math.max(...updatedClasses.map(c => c.id)) + 1 : 0;

      predictions.forEach(p => {
          const labelName = p.label.trim();
          // Check if class exists (case-sensitive)
          if (!updatedClasses.some(c => c.name === labelName)) {
              updatedClasses.push({ id: nextId, name: labelName });
              nextId++;
              hasNewClasses = true;
          }
      });

      if (hasNewClasses) {
          setClasses(updatedClasses);
      }

      // 2. Map predictions to boxes using the (potentially updated) class list
      const newBoxes: BoundingBox[] = predictions.map(p => {
         const labelName = p.label.trim();
         // Use updatedClasses here to ensure we find the new index/color
         const clsIndex = updatedClasses.findIndex(c => c.name === labelName);
         const color = clsIndex !== -1 
            ? LABEL_COLORS[clsIndex % LABEL_COLORS.length] 
            : '#999'; 

         return {
            id: generateId(),
            x: p.xmin,
            y: p.ymin,
            width: p.xmax - p.xmin,
            height: p.ymax - p.ymin,
            label: labelName,
            color
         };
      });

      handleUpdateBoxes(selectedImage.id, [...selectedImage.boxes, ...newBoxes]);
  };

  const handleGeminiAutoLabel = async () => {
    if (!selectedImage) return;
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(selectedImage.file);
      const predictions = await detectObjectsWithGemini(base64, selectedImage.file.type);
      applyPredictions(predictions);
    } catch (error) {
      alert("Failed to auto-label: " + (error as any).message);
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

  // Keyboard Navigation for Images & Action Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing or if modals are open
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (isInferenceApiModalOpen || isClassManagerOpen) return;
      
      if (view !== 'editor') return;

      // Navigation
      if (filteredImages.length > 0) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const currentIndex = filteredImages.findIndex(img => img.id === selectedImageId);
            if (currentIndex !== -1 && currentIndex < filteredImages.length - 1) {
                setSelectedImageId(filteredImages[currentIndex + 1].id);
            } else if (currentIndex === -1 && filteredImages.length > 0) {
                setSelectedImageId(filteredImages[0].id);
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const currentIndex = filteredImages.findIndex(img => img.id === selectedImageId);
            if (currentIndex > 0) {
                setSelectedImageId(filteredImages[currentIndex - 1].id);
            } else if (currentIndex === -1 && filteredImages.length > 0) {
                setSelectedImageId(filteredImages[0].id);
            }
        }
      }

      // Action Shortcuts (1 & 2)
      if (selectedImage) {
        if (e.key === '1') {
            e.preventDefault();
            openInferenceApiModal();
        }
        if (e.key === '2') {
            e.preventDefault();
            if (!isProcessing) {
                handleGeminiAutoLabel();
            }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
      selectedImageId, 
      filteredImages, 
      view, 
      isInferenceApiModalOpen, 
      isClassManagerOpen, 
      selectedImage, 
      isProcessing, 
      classes // Essential for applyPredictions to see current classes
    ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages: DatasetImage[] = (Array.from(e.target.files) as File[]).map(file => ({
        id: generateId(),
        file,
        url: URL.createObjectURL(file),
        width: 0,
        height: 0,
        boxes: []
      }));
      setImages(prev => [...prev, ...newImages]);
      if (!selectedImageId && newImages.length > 0) {
        setSelectedImageId(newImages[0].id);
      }
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files) as File[];
    
    // Separate images and txt files
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const txtFiles = files.filter(f => f.name.endsWith('.txt'));
    
    // Parse classes.txt if it exists
    const classesFile = txtFiles.find(f => f.name === 'classes.txt');
    
    // Temporary updated classes
    let updatedClasses = [...classes];

    if (classesFile) {
        const content = await classesFile.text();
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        
        // When importing classes.txt, we usually assume standard 0-indexed layout
        // But we check if these names already exist with IDs
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
            // Pass the CURRENT known classes to parser
            const parsedBoxes = parseYoloFile(content, updatedClasses);
            boxes = parsedBoxes.map(b => ({ ...b, id: generateId() })); // Assign unique IDs
        }

        newImages.push({
            id: generateId(),
            file: imgFile,
            url: URL.createObjectURL(imgFile),
            width: 0,
            height: 0,
            boxes
        });
    }

    setImages(prev => [...prev, ...newImages]);
    if (!selectedImageId && newImages.length > 0) {
        setSelectedImageId(newImages[0].id);
    }
  };

  const handleExportDataset = async (mode: 'flat' | 'split' = 'flat') => {
    if (images.length === 0) {
        alert("No images to export.");
        return;
    }

    const zip = new JSZip();
    
    const sortedClasses = [...classes].sort((a, b) => a.id - b.id);
    
    const root = zip.folder("dataset");
    if (!root) return;

    // Save classes.txt in root of dataset
    root.file("classes.txt", sortedClasses.map(c => c.name).join("\n"));

    const imagesFolder = mode === 'split' ? root.folder("images") : root;
    const labelsFolder = mode === 'split' ? root.folder("labels") : root;

    images.forEach(img => {
        // Always save image
        imagesFolder?.file(img.file.name, img.file);

        const nameParts = img.file.name.split('.');
        nameParts.pop(); 
        const baseName = nameParts.join('.');
        const txtName = `${baseName}.txt`;

        const lines = img.boxes.map(box => {
            const cls = classes.find(c => c.name === box.label);
            if (!cls) return null;

            const x_center = box.x + (box.width / 2);
            const y_center = box.y + (box.height / 2);
            
            const xc = Math.max(0, Math.min(1, x_center));
            const yc = Math.max(0, Math.min(1, y_center));
            const w = Math.max(0, Math.min(1, box.width));
            const h = Math.max(0, Math.min(1, box.height));

            return `${cls.id} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
        }).filter(l => l !== null);

        // For flat mode, only create txt if there are labels (traditional)
        // For split mode, it's safer to create empty txt files for unlabeled images (common for training)
        if (lines.length > 0 || mode === 'split') {
            labelsFolder?.file(txtName, lines.join("\n"));
        }
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === 'split' ? "neurolabel_dataset_split.zip" : "neurolabel_dataset_flat.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };

  const handleDeleteImage = (e: React.MouseEvent, id: string) => {
    // Crucial: stop propagation AND prevent default to avoid triggering the parent div onClick
    e.stopPropagation();
    e.preventDefault();
    
    if (window.confirm("Are you sure you want to delete this image?")) {
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) {
        setSelectedImageId(null);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-lg">N</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight">NeuroLabel</h1>
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
             <button 
                onClick={() => setIsClassManagerOpen(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:bg-gray-700 hover:text-white`}
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
                        <button 
                            onClick={() => handleExportDataset('flat')}
                            className="px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border-b border-gray-700 last:border-0"
                        >
                            <span className="font-bold block">Flat Structure</span>
                            <span className="text-[10px] text-gray-500">Img & Txt side-by-side</span>
                        </button>
                         <button 
                            onClick={() => handleExportDataset('split')}
                            className="px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            <span className="font-bold block">Split Structure</span>
                            <span className="text-[10px] text-gray-500">/images and /labels folders</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <SearchIcon />
                </div>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search images..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        <XCircleIcon />
                    </button>
                )}
            </div>

            {/* Filter Controls */}
            {images.length > 0 && (
                <div className="flex items-center gap-1 mb-2 bg-gray-900 p-1 rounded-lg border border-gray-700">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`flex-1 text-[10px] uppercase font-bold py-1 px-1 rounded transition-colors ${filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setFilter('labeled')}
                        className={`flex-1 text-[10px] uppercase font-bold py-1 px-1 rounded transition-colors ${filter === 'labeled' ? 'bg-green-900/50 text-green-400' : 'text-gray-500 hover:text-green-500/70'}`}
                    >
                        Done
                    </button>
                    <button 
                        onClick={() => setFilter('unlabeled')}
                        className={`flex-1 text-[10px] uppercase font-bold py-1 px-1 rounded transition-colors ${filter === 'unlabeled' ? 'bg-red-900/50 text-red-400' : 'text-gray-500 hover:text-red-500/70'}`}
                    >
                        Todo
                    </button>
                </div>
            )}

            {filteredImages.map(img => (
                <div 
                    key={img.id}
                    onClick={() => {
                        setSelectedImageId(img.id);
                        setView('editor');
                    }}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group relative pr-8 ${selectedImageId === img.id ? 'bg-gray-700 ring-1 ring-indigo-500' : 'hover:bg-gray-700/50'}`}
                >
                    <div className="w-10 h-10 rounded bg-gray-900 flex-shrink-0 overflow-hidden border border-gray-600 relative">
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                        {img.boxes.length > 0 ? (
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-bl-md" />
                        ) : (
                             <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-bl-md" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-200">{img.file.name}</p>
                        <p className={`text-xs ${img.boxes.length > 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                            {img.boxes.length > 0 ? `${img.boxes.length} objects` : 'No labels'}
                        </p>
                    </div>
                    
                    {/* Explicitly positioned and styled button to ensure clickability */}
                    <div 
                        onClick={(e) => handleDeleteImage(e, img.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                        title="Delete Image"
                    >
                        <TrashIcon />
                    </div>
                </div>
            ))}
            
            {images.length === 0 && (
                <div className="text-center p-4 text-gray-500 text-sm mt-10">
                    No images loaded.<br/>Import to start.
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
        {/* Toolbar */}
        {view === 'editor' && (
            <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
                <h2 className="font-medium text-gray-200 truncate max-w-xs">
                    {selectedImage ? selectedImage.file.name : 'No image selected'}
                </h2>
                
                <div className="flex items-center gap-2">
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
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <SparklesIcon />}
                        AI Auto-Label (2)
                    </button>
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
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <PhotoIcon />
                        <p className="mt-2">Select or import an image to start labeling</p>
                    </div>
                )
            ) : (
                <Dashboard images={images} />
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
    </div>
  );
};

export default App;
