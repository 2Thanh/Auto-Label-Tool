import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DatasetImage, BoundingBox, LabelClass } from '../types';
import { LABEL_COLORS } from '../constants';

interface EditorProps {
  image: DatasetImage;
  availableClasses: LabelClass[];
  onUpdateBoxes: (imageId: string, boxes: BoundingBox[]) => void;
  onAddClass: (id: number, name: string) => void;
}

type InteractionMode = 'none' | 'drawing' | 'moving' | 'resizing' | 'panning';
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null;

const generateId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
};

const Editor: React.FC<EditorProps> = ({ image, availableClasses, onUpdateBoxes, onAddClass }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Interaction State
  const [mode, setMode] = useState<InteractionMode>('none');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Coordinates for operations
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<BoundingBox | null>(null); // For move/resize reference

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastPanMousePos, setLastPanMousePos] = useState<{ x: number, y: number } | null>(null);

  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  
  // Track selected class by ID
  const [selectedClassId, setSelectedClassId] = useState<number>(
      availableClasses.length > 0 ? availableClasses[0].id : 0
  );
  
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassId, setNewClassId] = useState<string>('');

  // Helper to get current selected class object
  const activeClass = availableClasses.find(c => c.id === selectedClassId) || availableClasses[0];

  useEffect(() => {
    // If the currently selected ID doesn't exist, default to the first one
    if (!availableClasses.find(c => c.id === selectedClassId) && availableClasses.length > 0) {
        setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  // Set default next ID when opening add mode
  useEffect(() => {
    if (isAddingClass) {
        const maxId = availableClasses.length > 0 
            ? Math.max(...availableClasses.map(c => c.id)) 
            : -1;
        setNewClassId((maxId + 1).toString());
        setNewClassName('');
    }
  }, [isAddingClass, availableClasses]);

  // Sync selected class dropdown when a box is selected
  useEffect(() => {
    if (selectedBoxId) {
        const box = image.boxes.find(b => b.id === selectedBoxId);
        if (box) {
            const cls = availableClasses.find(c => c.name === box.label);
            if (cls) {
                setSelectedClassId(cls.id);
            }
        }
    }
  }, [selectedBoxId, image.boxes, availableClasses]);

  // Handle keyboard shortcuts (Delete, Space for Pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (selectedBoxId && (e.key === 'Delete' || e.key === 'Backspace')) {
        const newBoxes = image.boxes.filter(b => b.id !== selectedBoxId);
        onUpdateBoxes(image.id, newBoxes);
        setSelectedBoxId(null);
        setMode('none');
      }

      if (e.code === 'Space' && !e.repeat) {
          e.preventDefault(); // Prevent page scroll
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
  }, [selectedBoxId, image.id, image.boxes, onUpdateBoxes, mode]);

  // Centering Logic
  const fitToScreen = useCallback(() => {
      if (!viewportRef.current || !imgRef.current) return;
      
      const viewport = viewportRef.current.getBoundingClientRect();
      const img = imgRef.current;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      if (!imgW || !imgH) return;

      // Add some padding
      const padding = 64;
      const availW = viewport.width - padding;
      const availH = viewport.height - padding;

      const scaleX = availW / imgW;
      const scaleY = availH / imgH;
      
      // Fit completely visible, but max scale 1.0 (don't upscale pixel art etc by default)
      const newScale = Math.min(1, Math.min(scaleX, scaleY));
      
      // Calculate centered pan
      // Origin is top-left (0,0) of the transformed element.
      // We want: pan + (size * scale) / 2 = viewport / 2
      // => pan = (viewport - size * scale) / 2
      
      const panX = (viewport.width - imgW * newScale) / 2;
      const panY = (viewport.height - imgH * newScale) / 2;

      setScale(newScale);
      setPan({ x: panX, y: panY });
  }, []);

  // Reset zoom/pan when image changes
  useEffect(() => {
     // Hide image immediately when ID changes
     setIsImageLoaded(false);
     setPan({x: 0, y: 0});
     setScale(1);
  }, [image.id]);

  const handleImageLoad = () => {
      fitToScreen();
      // Show image after it has been centered
      setIsImageLoaded(true);
  };

  // --- Helpers ---

  const getNormalizedPos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    // getBoundingClientRect returns the visual rect (affected by transform)
    // This allows us to use standard logic regardless of zoom level
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const getHandleAt = (box: BoundingBox, x: number, y: number, tolerancePx = 8): ResizeHandle => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    
    const boxLeft = box.x * rect.width;
    const boxRight = (box.x + box.width) * rect.width;
    const boxTop = box.y * rect.height;
    const boxBottom = (box.y + box.height) * rect.height;
    
    const mouseX = x * rect.width;
    const mouseY = y * rect.height;

    const nearLeft = Math.abs(mouseX - boxLeft) <= tolerancePx;
    const nearRight = Math.abs(mouseX - boxRight) <= tolerancePx;
    const nearTop = Math.abs(mouseY - boxTop) <= tolerancePx;
    const nearBottom = Math.abs(mouseY - boxBottom) <= tolerancePx;

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

  // --- Viewport Handlers (Zoom/Pan) ---

  const handleWheel = (e: React.WheelEvent) => {
    // Prevent default not strictly needed on wrapper if overflow hidden, but good practice
    // e.preventDefault(); 
    
    if (!viewportRef.current) return;

    const wheelDelta = -e.deltaY;
    const factor = wheelDelta > 0 ? 1.1 : 0.9;
    
    const newScale = Math.min(20, Math.max(0.1, scale * factor));
    
    // Zoom toward cursor logic
    // We want the point under the mouse to remain stationary
    
    // 1. Mouse relative to viewport
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - viewportRect.left;
    const mouseY = e.clientY - viewportRect.top;

    // 2. Mouse relative to container (accounting for current pan/scale)
    // Formula: mouse_viewport = pan + mouse_local * scale
    // => mouse_local = (mouse_viewport - pan) / scale
    
    const mouseLocalX = (mouseX - pan.x) / scale;
    const mouseLocalY = (mouseY - pan.y) / scale;

    // 3. New Pan
    // We want: mouse_viewport = new_pan + mouse_local * new_scale
    // => new_pan = mouse_viewport - mouse_local * new_scale

    const newPanX = mouseX - mouseLocalX * newScale;
    const newPanY = mouseY - mouseLocalY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // --- Mouse Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 0. CHECK FOR PAN (Spacebar or Middle Mouse Button)
    if (isSpacePressed || e.button === 1) {
        setMode('panning');
        setLastPanMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    if (!containerRef.current) return;

    const pos = getNormalizedPos(e);
    setStartPos(pos);
    setCurrentPos(pos);

    // 1. Check for RESIZE (Shift + Click on Edge of Selected Box)
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

    // 2. Check for box selection / MOVE
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

    // 3. Else, DRAW
    setSelectedBoxId(null);
    setMode('drawing');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // PANNING LOGIC
    if (mode === 'panning' && lastPanMousePos) {
        const dx = e.clientX - lastPanMousePos.x;
        const dy = e.clientY - lastPanMousePos.y;
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        setLastPanMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    // CURSOR UPDATES
    const pos = getNormalizedPos(e);
    setCurrentPos(pos);

    if (mode === 'none' && !isSpacePressed) {
        if (selectedBoxId && containerRef.current) {
            const box = image.boxes.find(b => b.id === selectedBoxId);
            if (box && e.shiftKey) {
                const handle = getHandleAt(box, pos.x, pos.y);
                let cursorStyle = 'default';
                switch (handle) {
                    case 'n': case 's': cursorStyle = 'ns-resize'; break;
                    case 'e': case 'w': cursorStyle = 'ew-resize'; break;
                    case 'nw': case 'se': cursorStyle = 'nwse-resize'; break;
                    case 'ne': case 'sw': cursorStyle = 'nesw-resize'; break;
                    default: 
                        if (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height) {
                            cursorStyle = 'move'; 
                        } else {
                            cursorStyle = 'crosshair';
                        }
                }
                containerRef.current.style.cursor = cursorStyle;
            } else {
                 containerRef.current.style.cursor = 'crosshair';
            }
        } else if (containerRef.current) {
            containerRef.current.style.cursor = 'crosshair';
        }
    }

    if (mode === 'none') return;

    // --- INTERACTION LOGIC ---

    if (mode === 'drawing') {
        return;
    }

    if (mode === 'moving' && initialBox && startPos) {
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;

        const newX = initialBox.x + dx;
        const newY = initialBox.y + dy;

        const updatedBoxes = image.boxes.map(b => 
            b.id === initialBox.id 
            ? { ...b, x: newX, y: newY }
            : b
        );
        onUpdateBoxes(image.id, updatedBoxes);
    }

    if (mode === 'resizing' && initialBox && activeHandle) {
        let { x, y, width, height } = initialBox;
        
        if (activeHandle.includes('n')) {
            const oldBottom = initialBox.y + initialBox.height;
            const newY = Math.min(oldBottom - 0.005, pos.y);
            height = oldBottom - newY;
            y = newY;
        }
        if (activeHandle.includes('s')) {
            height = Math.max(0.005, pos.y - initialBox.y);
        }
        if (activeHandle.includes('w')) {
            const oldRight = initialBox.x + initialBox.width;
            const newX = Math.min(oldRight - 0.005, pos.x);
            width = oldRight - newX;
            x = newX;
        }
        if (activeHandle.includes('e')) {
            width = Math.max(0.005, pos.x - initialBox.x);
        }

        const updatedBoxes = image.boxes.map(b => 
            b.id === initialBox.id 
            ? { ...b, x, y, width, height }
            : b
        );
        onUpdateBoxes(image.id, updatedBoxes);
    }
  };

  const handleMouseUp = () => {
    if (mode === 'drawing' && startPos && currentPos && activeClass) {
        const width = Math.abs(currentPos.x - startPos.x);
        const height = Math.abs(currentPos.y - startPos.y);

        if (width > 0.01 && height > 0.01) {
            const colorIndex = availableClasses.findIndex(c => c.id === activeClass.id);
            const newBox: BoundingBox = {
                id: generateId(),
                x: Math.min(startPos.x, currentPos.x),
                y: Math.min(startPos.y, currentPos.y),
                width,
                height,
                label: activeClass.name,
                color: LABEL_COLORS[colorIndex % LABEL_COLORS.length],
            };
            onUpdateBoxes(image.id, [...image.boxes, newBox]);
            setSelectedBoxId(newBox.id);
        }
    }

    if (mode === 'panning') {
        setLastPanMousePos(null);
    }

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
             const updatedBoxes = image.boxes.map(box => 
                 box.id === selectedBoxId 
                 ? { ...box, label: newClass.name, color: LABEL_COLORS[colorIndex % LABEL_COLORS.length] } 
                 : box
             );
             onUpdateBoxes(image.id, updatedBoxes);
          }
      }
  };

  const getClassIdByName = (name: string) => {
      const cls = availableClasses.find(c => c.name === name);
      return cls ? cls.id : '?';
  };

  // Zoom controls
  const zoomIn = () => {
      setScale(s => Math.min(20, s * 1.2));
  };
  const zoomOut = () => {
      setScale(s => Math.max(0.1, s / 1.2));
  };
  const resetView = () => {
      fitToScreen();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
         <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-gray-900 rounded p-1 border border-gray-700 mr-2">
                <button onClick={zoomOut} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded">-</button>
                <span className="text-xs font-mono w-10 text-center text-gray-300">{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded">+</button>
                <button onClick={resetView} className="ml-1 text-xs px-2 py-1 text-gray-400 hover:text-white border-l border-gray-700" title="Reset View">R</button>
            </div>

            <span className="text-gray-400 text-sm">Active Class:</span>
            {!isAddingClass ? (
                <div className="flex items-center gap-2">
                    <select 
                        value={selectedClassId} 
                        onChange={(e) => handleClassChange(parseInt(e.target.value))}
                        className="bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    >
                        {availableClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.id}: {cls.name}
                            </option>
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
                        onChange={(e) => setNewClassId(e.target.value)}
                        className="bg-gray-900 text-white text-sm px-2 py-1 rounded border border-indigo-500 focus:outline-none w-16 font-mono text-center"
                        placeholder="ID"
                        autoFocus
                    />
                    <input 
                        type="text" 
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        className="bg-gray-900 text-white text-sm px-2 py-1 rounded border border-indigo-500 focus:outline-none w-32 font-mono"
                        placeholder="Name"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
                    />
                    <button onClick={handleCreateClass} className="text-green-500 hover:text-green-400">✓</button>
                    <button onClick={() => setIsAddingClass(false)} className="text-red-500 hover:text-red-400">✕</button>
                </div>
            )}
         </div>
         <div className="text-gray-400 text-xs hidden md:block">
            Shift+Resize • Space+Pan • Wheel:Zoom • &larr;&rarr;:Nav
         </div>
      </div>

      <div className="flex-1 overflow-hidden relative select-none bg-[#0d1117] flex items-center justify-center">
        {/* Viewport for Zoom/Pan */}
        <div 
            ref={viewportRef}
            className="w-full h-full overflow-hidden relative cursor-crosshair"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
                cursor: isSpacePressed || mode === 'panning' ? (mode === 'panning' ? 'grabbing' : 'grab') : undefined 
            }}
        >
            {/* Transformed Container */}
            <div 
                ref={containerRef}
                className="absolute shadow-2xl shadow-black ring-1 ring-gray-700 origin-top-left"
                style={{ 
                    width: 'fit-content', 
                    height: 'fit-content', 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    top: 0,
                    left: 0,
                    opacity: isImageLoaded ? 1 : 0
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
                                className="bg-black/50 select-none"
                                style={{ textShadow: '1px 1px 2px black' }}
                                pointerEvents="none"
                            >
                                {getClassIdByName(box.label)}: {box.label}
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

                    {mode === 'drawing' && startPos && currentPos && (
                        <rect
                            x={`${Math.min(startPos.x, currentPos.x) * 100}%`}
                            y={`${Math.min(startPos.y, currentPos.y) * 100}%`}
                            width={`${Math.abs(currentPos.x - startPos.x) * 100}%`}
                            height={`${Math.abs(currentPos.y - startPos.y) * 100}%`}
                            fill="rgba(255, 255, 255, 0.2)"
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