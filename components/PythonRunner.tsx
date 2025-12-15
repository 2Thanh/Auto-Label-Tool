import React, { useState, useEffect, useRef } from 'react';
import { ExternalModelPrediction } from '../types';
import { PYODIDE_TEMPLATE } from '../constants';

interface PythonRunnerProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (predictions: ExternalModelPrediction[]) => void;
  imageBase64: string | null;
}

declare global {
  interface Window {
    loadPyodide: any;
  }
}

const PythonRunner: React.FC<PythonRunnerProps> = ({ isOpen, onClose, onRun, imageBase64 }) => {
  const [code, setCode] = useState(PYODIDE_TEMPLATE);
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodide, setPyodide] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    if (isOpen && !pyodide && !isInitializing) {
      const initPyodide = async () => {
        setIsInitializing(true);
        try {
          setOutput(prev => [...prev, "Initializing Python environment..."]);
          const py = await window.loadPyodide();
          await py.loadPackage("numpy");
          setPyodide(py);
          setOutput(prev => [...prev, "Python ready. NumPy loaded."]);
        } catch (e: any) {
          setOutput(prev => [...prev, `Error loading Pyodide: ${e.message}`]);
        } finally {
          setIsInitializing(false);
        }
      };
      initPyodide();
    }
  }, [isOpen, pyodide, isInitializing]);

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!pyodide || !imageBase64) return;
    setIsRunning(true);
    setOutput([]); // Clear previous output

    try {
      // Inject variables
      pyodide.globals.set("image_data", imageBase64);
      
      // Redirect stdout
      pyodide.setStdout({ batched: (msg: string) => setOutput(prev => [...prev, msg]) });

      await pyodide.runPythonAsync(code);

      // Extract results
      const resultsProxy = pyodide.globals.get("results");
      if (resultsProxy) {
        const results = resultsProxy.toJs();
        resultsProxy.destroy(); // Cleanup
        
        // Validate results
        if (Array.isArray(results)) {
            setOutput(prev => [...prev, `Success! Found ${results.length} objects.`]);
            // Small delay to read logs
            setTimeout(() => {
                onRun(results as ExternalModelPrediction[]);
                onClose();
            }, 1000);
        } else {
             setOutput(prev => [...prev, "Error: 'results' variable must be a list."]);
        }
      } else {
        setOutput(prev => [...prev, "Error: 'results' variable not found in script."]);
      }

    } catch (e: any) {
      setOutput(prev => [...prev, `Runtime Error: ${e.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl flex flex-col h-[85vh] shadow-2xl border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <h2 className="text-lg font-bold text-white font-mono">Python Environment</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* Editor */}
            <div className="flex-1 flex flex-col border-r border-gray-700">
                <div className="bg-gray-950 p-2 text-xs text-gray-500 flex justify-between">
                    <span>main.py</span>
                    <span>Env: Pyodide (WASM)</span>
                </div>
                <textarea 
                    className="flex-1 bg-gray-900 text-gray-300 font-mono p-4 text-sm focus:outline-none resize-none"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                />
            </div>

            {/* Console */}
            <div className="w-full md:w-1/3 bg-black flex flex-col">
                <div className="bg-gray-900 p-2 text-xs text-gray-500 border-b border-gray-800">
                    Console Output
                </div>
                <div className="flex-1 p-4 font-mono text-xs overflow-y-auto text-green-400">
                    {output.length === 0 && <span className="text-gray-600">Waiting for execution...</span>}
                    {output.map((line, i) => (
                        <div key={i} className="mb-1">{line}</div>
                    ))}
                    {isRunning && <div className="animate-pulse">_</div>}
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-850 flex justify-end gap-3 rounded-b-xl">
            <div className="flex-1 text-xs text-gray-500 flex items-center">
                Note: Heavy ML libraries (PyTorch/TensorFlow) are not available. Use NumPy or APIs.
            </div>
            <button 
                onClick={handleRun}
                disabled={isRunning || !pyodide}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-mono text-sm rounded transition-all flex items-center gap-2"
            >
                {isRunning ? 'Running...' : '▶ Run Script'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PythonRunner;
