import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DatasetImage, BoundingBox, LabelClass } from '../types';
import { LABEL_COLORS } from '../constants';
import RejectionBanner from './RejectionBanner';

interface EditorProps {
  image: DatasetImage;
  availableClasses: LabelClass[];
  onUpdateBoxes: (imageId: string, boxes: BoundingBox[]) => void;
  onAddClass: (id: number, name: string) => void;
  isReadOnly?: boolean;
  onSubmitForReview?: () => void;
}

type InteractionMode = 'none' | 'drawing' | 'moving' | 'resizing' | 'panning';
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const Editor: React.FC<EditorProps> = ({
  image,
  availableClasses,
  onUpdateBoxes,
  onAddClass,
  isReadOnly = false,
  onSubmitForReview,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [mode, setMode] = useState<InteractionMode>('none');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<BoundingBox | null>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastPanMousePos, setLastPanMousePos] = useState<{ x: number; y: number } | null>(null);

  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<number>(
    availableClasses.length > 0 ? availableClasses[0].id : 0
  );

  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassId, setNewClassId] = useState<string>('');

  // Whether to show the rejection banner (dismissable per session)
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Reset banner dismissed state when image changes
  useEffect(() => {
    setBannerDismissed(false);
  }, [image.id]);

  const activeClass = availableClasses.find(c => c.id === selectedClassId) || availableClasses[0];

  useEffect(() => {
    if (!availableClasses.find(c => c.id === selectedClassId) && availableClasses.length > 0) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  useEffect(() => {
    if (isAddingClass) {
      const maxId = availableClasses.length > 0 ? Math.max(...availableClasses.map(c => c.id)) : -1;
      setNewClassId((maxId + 1).toString());
      setNewClassName('');
    }
  }, [isAddingClass, availableClasses]);

  useEffect(() => {
    if (selectedBoxId) {
      const box = image.boxes.find(b => b.id === selectedBoxId);
      if (box) {
        const cls = availableClasses.find(c => c.name === box.label);
        if (cls) setSelectedClassId(cls.id);
      }
    }
  }, [selectedBoxId, image.boxes, availableClasses]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (isReadOnly) {
        // Allow pan/zoom even in read-only mode
        if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsSpacePressed(true); }
        return;
      }

      if (selectedBoxId && (e.key === 'Delete' || e.key === 'Backspace')) {
        const newBoxes = image.boxes.filter(b => b.id !== selectedBoxId);
        onUpdateBoxes(image.id, newBoxes);
        setSelectedBoxId(null);
        setMode('none');
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (mode === 'panning') {
          setMode('none');
          setLastPanMousePos(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedBoxId, image.id, image.boxes, onUpdateBoxes, mode, isReadOnly]);

  const fitToScreen = useCallback(() => {
    if (!viewportRef.current || !imgRef.current) return;
    const viewport = viewportRef.current.getBoundingClientRect();
    const img = imgRef.current;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    if (!imgW || !imgH) return;

    const padding = 64;
    const availW = viewport.width - padding;
    const availH = viewport.height - padding;
    const newScale = Math.min(1, Math.min(availW / imgW, availH / imgH));
    const panX = (viewport.width - imgW * newScale) / 2;
    const panY = (viewport.height - imgH * newScale) / 2;
    setScale(newScale);
    setPan({ x: panX, y: panY });
  }, []);

  useEffect(() => {
    setIsImageLoaded(false);
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, [image.id]);

  const handleImageLoad = () => {
    fitToScreen();
    setIsImageLoaded(true);
  };

  const getNormalizedPos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const getHandleAt = (box: BoundingBox, x: number, y: number, tolerancePx = 8): ResizeHandle => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = x * rect.width;
    const mouseY = y * rect.height;
    const nearLeft = Math.abs(mouseX - box.x * rect.width) <= tolerancePx;
    const nearRight = Math.abs(mouseX - (box.x + box.width) * rect.width) <= tolerancePx;
    const nearTop = Math.abs(mouseY - box.y * rect.height) <= tolerancePx;
    const nearBottom = Math.abs(mouseY - (box.y + box.height) * rect.height) <= tolerancePx;
    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!viewportRef.current) return;
    const factor = -e.deltaY > 0 ? 1.1 : 0.9;
    const newScale = Math.min(20, Math.max(0.1, scale * factor));
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - viewportRect.left;
    const mouseY = e.clientY - viewportRect.top;
    const mouseLocalX = (mouseX - pan.x) / scale;
    const mouseLocalY = (mouseY - pan.y) / scale;
    setScale(newScale);
    setPan({ x: mouseX - mouseLocalX * newScale, y: mouseY - mouseLocalY * newScale });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    if (isSpacePressed || e.button === 1) {
      setMode('panning');
      setLastPanMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Read-only: no drawing/moving/resizing
    if (isReadOnly) return;

    const pos = getNormalizedPos(e);
    setStartPos(pos);
    setCurrentPos(pos);

    if (selectedBoxId && e.shiftKey) {
      const box = image.boxes.find(b => b.id === selectedBoxId);
      if (box) {
        const handle = getHandleAt(box, pos.x, pos.y);
        if (handle) {
          setMode('resizing');
          setActiveHandle(handle);
          setInitialBox(box);
          return;
        }
      }
    }

    let clickedBoxId: string | null = null;
    let clickedBox: BoundingBox | null = null;
    for (let i = image.boxes.length - 1; i >= 0; i--) {
      const b = image.boxes[i];
      if (pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) {
        clickedBoxId = b.id;
        clickedBox = b;
        break;
      }
    }

    if (clickedBoxId) {
      setSelectedBoxId(clickedBoxId);
      setMode('moving');
      setInitialBox(clickedBox);
      return;
    }

    setSelectedBoxId(null);
    setMode('drawing');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'panning' && lastPanMousePos) {
      const dx = e.clientX - lastPanMousePos.x;
      const dy = e.clientY - lastPanMousePos.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastPanMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = getNormalizedPos(e);
    setCurrentPos(pos);

    if (isReadOnly) return;

    if (mode === 'none' && !isSpacePressed && selectedBoxId && containerRef.current) {
      const box = image.boxes.find(b => b.id === selectedBoxId);
      if (box && e.shiftKey) {
        const handle = getHandleAt(box, pos.x, pos.y);
        let cursor = 'default';
        switch (handle) {
          case 'n': case 's': cursor = 'ns-resize'; break;
          case 'e': case 'w': cursor = 'ew-resize'; break;
          case 'nw': case 'se': cursor = 'nwse-resize'; break;
          case 'ne': case 'sw': cursor = 'nesw-resize'; break;
          default:
            cursor = (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height)
              ? 'move' : 'crosshair';
        }
        containerRef.current.style.cursor = cursor;
      } else {
        containerRef.current.style.cursor = 'crosshair';
      }
    }

    if (mode === 'none') return;
    if (mode === 'drawing') return;

    if (mode === 'moving' && initialBox && startPos) {
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      onUpdateBoxes(image.id, image.boxes.map(b =>
        b.id === initialBox.id ? { ...b, x: initialBox.x + dx, y: initialBox.y + dy } : b
      ));
    }

    if (mode === 'resizing' && initialBox && activeHandle) {
      let { x, y, width, height } = initialBox;
      if (activeHandle.includes('n')) {
        const bottom = initialBox.y + initialBox.height;
        const newY = Math.min(bottom - 0.005, pos.y);
        height = bottom - newY; y = newY;
      }
      if (activeHandle.includes('s')) height = Math.max(0.005, pos.y - initialBox.y);
      if (activeHandle.includes('w')) {
        const right = initialBox.x + initialBox.width;
        const newX = Math.min(right - 0.005, pos.x);
        width = right - newX; x = newX;
      }
      if (activeHandle.includes('e')) width = Math.max(0.005, pos.x - initialBox.x);
      onUpdateBoxes(image.id, image.boxes.map(b =>
        b.id === initialBox.id ? { ...b, x, y, width, height } : b
      ));
    }
  };

  const handleMouseUp = () => {
    if (!isReadOnly && mode === 'drawing' && startPos && currentPos && activeClass) {
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);
      if (width > 0.01 && height > 0.01) {
        const colorIndex = availableClasses.findIndex(c => c.id === activeClass.id);
        const newBox: BoundingBox = {
          id: generateId(),
          x: Math.min(startPos.x, currentPos.x),
          y: Math.min(startPos.y, currentPos.y),
          width, height,
          label: activeClass.name,
          color: LABEL_COLORS[colorIndex % LABEL_COLORS.length],
        };
        onUpdateBoxes(image.id, [...image.boxes, newBox]);
        setSelectedBoxId(newBox.id);
      }
    }

    if (mode === 'panning') setLastPanMousePos(null);

    setMode('none');
    setActiveHandle(null);
    setStartPos(null);
    setCurrentPos(null);
    setInitialBox(null);
  };

  const handleCreateClass = () => {
    const id = parseInt(newClassId);
    if (!isNaN(id) && newClassName.trim()) {
      onAddClass(id, newClassName.trim());
      setSelectedClassId(id);
      setIsAddingClass(false);
    }
  };

  const handleClassChange = (newId: number) => {
    setSelectedClassId(newId);
    if (selectedBoxId) {
      const newClass = availableClasses.find(c => c.id === newId);
      if (newClass) {
        const colorIndex = availableClasses.findIndex(c => c.id === newId);
        onUpdateBoxes(image.id, image.boxes.map(box =>
          box.id === selectedBoxId
            ? { ...box, label: newClass.name, color: LABEL_COLORS[colorIndex % LABEL_COLORS.length] }
            : box
        ));
      }
    }
  };

  const getClassIdByName = (name: string) => {
    const cls = availableClasses.find(c => c.name === name);
    return cls ? cls.id : '?';
  };

  const zoomIn = () => setScale(s => Math.min(20, s * 1.2));
  const zoomOut = () => setScale(s => Math.max(0.1, s / 1.2));
  const resetView = () => fitToScreen();

  const showRejectionBanner =
    !bannerDismissed &&
    image.status === 'rejected' &&
    image.rejectionFeedback !== undefined;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Rejection banner */}
      {showRejectionBanner && image.rejectionFeedback && (
        <RejectionBanner
          feedback={image.rejectionFeedback}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Read-only overlay bar */}
      {isReadOnly && (
        <div className="px-4 py-2 bg-green-950/60 border-b border-green-800 text-green-400 text-xs font-semibold flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          Approved — editing disabled
        </div>
      )}

      {/* Toolbar */}
      <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-gray-900 rounded p-1 border border-gray-700 mr-2">
            <button onClick={zoomOut} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded">-</button>
            <span className="text-xs font-mono w-10 text-center text-gray-300">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded">+</button>
            <button onClick={resetView} className="ml-1 text-xs px-2 py-1 text-gray-400 hover:text-white border-l border-gray-700" title="Reset View">R</button>
          </div>

          {!isReadOnly && (
            <>
              <span className="text-gray-400 text-sm">Active Class:</span>
              {!isAddingClass ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedClassId}
                    onChange={e => handleClassChange(parseInt(e.target.value))}
                    className="bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  >
                    {availableClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.id}: {cls.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIsAddingClass(true)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-gray-300 border border-gray-600"
                    title="Add new class"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newClassId}
                    onChange={e => setNewClassId(e.target.value)}
                    className="bg-gray-900 text-white text-sm px-2 py-1 rounded border border-indigo-500 focus:outline-none w-16 font-mono text-center"
                    placeholder="ID"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    className="bg-gray-900 text-white text-sm px-2 py-1 rounded border border-indigo-500 focus:outline-none w-32 font-mono"
                    placeholder="Name"
                    onKeyDown={e => e.key === 'Enter' && handleCreateClass()}
                  />
                  <button onClick={handleCreateClass} className="text-green-500 hover:text-green-400">✓</button>
                  <button onClick={() => setIsAddingClass(false)} className="text-red-500 hover:text-red-400">✕</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Submit for review button inside editor toolbar */}
          {onSubmitForReview && (
            <button
              onClick={onSubmitForReview}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Submit for Review
            </button>
          )}
          {!isReadOnly && (
            <div className="text-gray-400 text-xs hidden md:block">
              Shift+Resize • Space+Pan • Wheel:Zoom • ←→:Nav
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative select-none bg-[#0d1117] flex items-center justify-center">
        <div
          ref={viewportRef}
          className="w-full h-full overflow-hidden relative"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isSpacePressed || mode === 'panning'
              ? (mode === 'panning' ? 'grabbing' : 'grab')
              : isReadOnly ? 'default' : 'crosshair',
          }}
        >
          <div
            ref={containerRef}
            className="absolute shadow-2xl shadow-black ring-1 ring-gray-700 origin-top-left"
            style={{
              width: 'fit-content',
              height: 'fit-content',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              top: 0, left: 0,
              opacity: isImageLoaded ? 1 : 0,
            }}
          >
            <img
              ref={imgRef}
              src={image.url}
              alt="Workspace"
              className="max-h-none max-w-none block pointer-events-none select-none"
              draggable={false}
              onLoad={handleImageLoad}
            />

            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {image.boxes.map(box => (
                <g key={box.id}>
                  <rect
                    x={`${box.x * 100}%`}
                    y={`${box.y * 100}%`}
                    width={`${box.width * 100}%`}
                    height={`${box.height * 100}%`}
                    fill={box.color}
                    fillOpacity={selectedBoxId === box.id ? 0.3 : 0.15}
                    stroke={box.color}
                    strokeWidth={(selectedBoxId === box.id ? 3 : 2) / scale}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={`${box.x * 100}%`}
                    y={`${box.y * 100}%`}
                    dy={`-${4 / scale}px`}
                    fill={box.color}
                    fontWeight="bold"
                    fontSize={`${14 / scale}px`}
                    style={{ textShadow: '1px 1px 2px black' }}
                    pointerEvents="none"
                  >
                    {getClassIdByName(box.label)}: {box.label}
                    {box.score !== undefined && ` (${(box.score * 100).toFixed(0)}%)`}
                  </text>
                  {selectedBoxId === box.id && (
                    <rect
                      x={`${box.x * 100}%`}
                      y={`${box.y * 100}%`}
                      width={`${box.width * 100}%`}
                      height={`${box.height * 100}%`}
                      fill="none"
                      stroke="white"
                      strokeDasharray={`${4 / scale}`}
                      strokeWidth={`${1 / scale}`}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                </g>
              ))}

              {!isReadOnly && mode === 'drawing' && startPos && currentPos && (
                <rect
                  x={`${Math.min(startPos.x, currentPos.x) * 100}%`}
                  y={`${Math.min(startPos.y, currentPos.y) * 100}%`}
                  width={`${Math.abs(currentPos.x - startPos.x) * 100}%`}
                  height={`${Math.abs(currentPos.y - startPos.y) * 100}%`}
                  fill="rgba(255,255,255,0.2)"
                  stroke="white"
                  strokeDasharray={`${4 / scale}`}
                  strokeWidth={`${2 / scale}`}
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
