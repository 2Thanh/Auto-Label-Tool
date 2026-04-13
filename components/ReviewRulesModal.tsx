import React, { useState, useEffect } from 'react';
import { LabelClass, ReviewRules } from '../types';

interface ReviewRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: ReviewRules;
  onSave: (rules: ReviewRules) => void;
  availableClasses: LabelClass[];
}

const ReviewRulesModal: React.FC<ReviewRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  onSave,
  availableClasses,
}) => {
  const [draft, setDraft] = useState<ReviewRules>(rules);

  // Sync draft when modal opens
  useEffect(() => {
    if (isOpen) setDraft(rules);
  }, [isOpen, rules]);

  if (!isOpen) return null;

  const toggleClass = (
    field: 'requiredClasses' | 'forbiddenClasses',
    name: string
  ) => {
    setDraft(prev => {
      const current = prev[field];
      const next = current.includes(name)
        ? current.filter(c => c !== name)
        : [...current, name];
      return { ...prev, [field]: next };
    });
  };

  const ClassChips = ({
    field,
    label,
    color,
  }: {
    field: 'requiredClasses' | 'forbiddenClasses';
    label: string;
    color: string;
  }) => (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {availableClasses.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No classes defined</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {availableClasses.map(cls => {
            const active = draft[field].includes(cls.name);
            return (
              <button
                key={cls.id}
                onClick={() => toggleClass(field, cls.name)}
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  active
                    ? `${color} text-white border-transparent`
                    : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-400'
                }`}
              >
                {cls.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="font-bold text-gray-100">Review Rules</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Box count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Min box count <span className="text-gray-600">(0 = none)</span>
              </label>
              <input
                type="number"
                min={0}
                value={draft.minBoxCount}
                onChange={e => setDraft(prev => ({ ...prev, minBoxCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Max box count <span className="text-gray-600">(0 = none)</span>
              </label>
              <input
                type="number"
                min={0}
                value={draft.maxBoxCount}
                onChange={e => setDraft(prev => ({ ...prev, maxBoxCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Confidence */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Min confidence score <span className="text-gray-600">(0 = skip check, applies only to AI boxes)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.minConfidenceScore}
                onChange={e => setDraft(prev => ({ ...prev, minConfidenceScore: parseFloat(e.target.value) }))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-mono text-gray-300 w-10 text-right">
                {draft.minConfidenceScore.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Required classes */}
          <ClassChips field="requiredClasses" label="Required classes (must appear)" color="bg-green-700" />

          {/* Forbidden classes */}
          <ClassChips field="forbiddenClasses" label="Forbidden classes (must NOT appear)" color="bg-red-700" />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors font-medium"
          >
            Save Rules
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewRulesModal;
