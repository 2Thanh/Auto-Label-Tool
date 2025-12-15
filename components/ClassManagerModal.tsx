import React, { useState } from 'react';
import { LabelClass } from '../types';
import { LABEL_COLORS } from '../constants';

interface ClassManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: LabelClass[];
  setClasses: React.Dispatch<React.SetStateAction<LabelClass[]>>;
}

const ClassManagerModal: React.FC<ClassManagerModalProps> = ({ isOpen, onClose, classes, setClasses }) => {
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!newClassName.trim()) return;
    
    // Auto-generate ID (max + 1)
    const maxId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) : -1;
    const newId = maxId + 1;
    
    setClasses(prev => [...prev, { id: newId, name: newClassName.trim() }]);
    setNewClassName('');
  };

  const startEdit = (cls: LabelClass) => {
    setEditingId(cls.id);
    setEditName(cls.name);
  };

  const saveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    setClasses(prev => prev.map(c => c.id === editingId ? { ...c, name: editName.trim() } : c));
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm(`Delete class ID ${id}? Existing boxes with this label will behave as 'unknown' until remapped.`)) {
        setClasses(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Manage Classes</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {classes.map((cls, idx) => (
                <div key={cls.id} className="flex items-center gap-2 p-2 bg-gray-900/50 rounded border border-gray-700">
                    <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: LABEL_COLORS[idx % LABEL_COLORS.length] }}
                    />
                    
                    {editingId === cls.id ? (
                        <div className="flex-1 flex gap-2">
                             <input 
                                className="flex-1 bg-gray-800 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            />
                            <button onClick={saveEdit} className="text-green-500 hover:text-green-400 text-xs font-bold uppercase">Save</button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-between">
                            <span className="text-gray-200 font-mono text-sm">
                                <span className="text-gray-500 mr-2">#{cls.id}</span>
                                {cls.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => startEdit(cls)} 
                                    className="text-gray-500 hover:text-indigo-400 p-1"
                                    title="Edit Name"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button 
                                    onClick={() => handleDelete(cls.id)} 
                                    className="text-gray-500 hover:text-red-400 p-1"
                                    title="Delete Class"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {classes.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-4">No classes defined.</div>
            )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-xl">
             <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Add New Class</label>
             <div className="flex gap-2">
                <input 
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Class name (e.g., 'bicycle')"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button 
                    onClick={handleAdd}
                    disabled={!newClassName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded font-medium text-sm transition-colors"
                >
                    Add
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default ClassManagerModal;