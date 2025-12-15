import React, { useState } from 'react';
import { ExternalModelPrediction } from '../types';
import { FASTAPI_TEMPLATE } from '../constants';

interface InferenceApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (predictions: ExternalModelPrediction[]) => void;
  imageBase64: string | null;
}

const InferenceApiModal: React.FC<InferenceApiModalProps> = ({ isOpen, onClose, onRun, imageBase64 }) => {
  const [url, setUrl] = useState('http://localhost:8000/predict');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!imageBase64) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("API response must be a JSON array of objects.");
      }

      onRun(data as ExternalModelPrediction[]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to connect to API");
    } finally {
      setIsLoading(false);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(FASTAPI_TEMPLATE);
    alert("Python server code copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-700">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">External Inference API</h2>
            <p className="text-gray-400 text-sm mt-1">Connect to your own model via HTTP</p>
          </div>
          <button 
            onClick={() => setShowCode(!showCode)}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-mono underline"
          >
            {showCode ? 'Hide Server Code' : 'Show Server Template'}
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {showCode && (
             <div className="mb-6 bg-gray-950 border border-gray-700 rounded-lg p-4 relative group">
                <button 
                    onClick={copyTemplate}
                    className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded border border-gray-600 transition-colors"
                >
                    Copy Code
                </button>
                <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                    {FASTAPI_TEMPLATE}
                </pre>
             </div>
          )}

          <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API Endpoint URL</label>
                <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="http://localhost:8000/predict"
                />
             </div>

             <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h4 className="text-blue-400 text-sm font-bold mb-1">Payload Format</h4>
                <p className="text-blue-200/70 text-xs font-mono">
                    POST {'{ "image": "base64_encoded_string" }'}
                </p>
                <h4 className="text-blue-400 text-sm font-bold mt-3 mb-1">Expected Response</h4>
                <p className="text-blue-200/70 text-xs font-mono">
                    [{'{ "label": "cat", "xmin": 0.1, "ymin": 0.1, "xmax": 0.5, "ymax": 0.5 }'}]
                </p>
             </div>

             {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-300 p-3 rounded-lg text-sm">
                    ⚠️ {error}
                </div>
             )}
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
            onClick={handleRun}
            disabled={isLoading || !imageBase64}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Running...
                </>
            ) : (
                'Run Inference'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InferenceApiModal;