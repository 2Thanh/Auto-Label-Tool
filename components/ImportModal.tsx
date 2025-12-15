import React, { useState } from 'react';
import { MOCK_PYTHON_SCRIPT } from '../constants';
import { ExternalModelPrediction } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (predictions: ExternalModelPrediction[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array");
      
      // Basic validation
      const valid = parsed.every(p => 
        'label' in p && 'xmin' in p && 'xmax' in p && 'ymin' in p && 'ymax' in p
      );
      
      if (!valid) throw new Error("Invalid format. Missing required keys (label, xmin, etc.)");

      onImport(parsed as ExternalModelPrediction[]);
      onClose();
      setJsonInput('');
      setError(null);
    } catch (err: any) {
        setError(err.message || "Invalid JSON");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Import Python Model Results</h2>
          <p className="text-gray-400 text-sm mt-1">
            Run your local Python model and paste the JSON output below.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Expected Python Script Output
                </label>
                <div className="bg-gray-950 p-4 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto border border-gray-700">
                    <pre>{MOCK_PYTHON_SCRIPT}</pre>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Paste JSON Output
                </label>
                <textarea 
                    className="w-full h-40 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder='[{"label": "car", "xmin": 0.1, ...}]'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                />
                {error && <p className="text-red-400 text-sm mt-2">Error: {error}</p>}
            </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-850 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
          >
            Apply Labels
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
