import React, { useState } from 'react';
import { DatasetImage, LabelClass, RejectionFeedback, ReviewRules, RuleViolation } from '../types';
import { checkRulesForImage } from '../utils/reviewRules';

interface ReviewQueueViewProps {
  images: DatasetImage[];
  classes: LabelClass[];
  reviewRules: ReviewRules;
  approvedOutputDirHandle: FileSystemDirectoryHandle | null;
  onApprove: (imageId: string) => void;
  onReject: (imageId: string, feedback: RejectionFeedback) => void;
  onOpenRulesModal: () => void;
  onSetOutputFolder: () => void;
}

const CheckIcon = () => (
  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const XIcon = () => (
  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RuleChecklist: React.FC<{ violations: RuleViolation[]; rules: ReviewRules }> = ({ violations, rules }) => {
  const ruleNames = ['Min box count', 'Max box count', 'Min confidence score', 'Required classes', 'Forbidden classes'];
  const activeRules = ruleNames.filter(name => {
    if (name === 'Min box count') return rules.minBoxCount > 0;
    if (name === 'Max box count') return rules.maxBoxCount > 0;
    if (name === 'Min confidence score') return rules.minConfidenceScore > 0;
    if (name === 'Required classes') return rules.requiredClasses.length > 0;
    if (name === 'Forbidden classes') return rules.forbiddenClasses.length > 0;
    return false;
  });

  if (activeRules.length === 0) {
    return <p className="text-xs text-gray-500 italic">No rules configured. <br/>All images will pass automatically.</p>;
  }

  return (
    <div className="space-y-1">
      {activeRules.map(name => {
        const violation = violations.find(v => v.rule === name);
        return (
          <div key={name} className="flex items-start gap-2">
            {violation ? <XIcon /> : <CheckIcon />}
            <div>
              <p className={`text-xs font-medium ${violation ? 'text-red-300' : 'text-green-300'}`}>{name}</p>
              {violation && <p className="text-xs text-red-400">{violation.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  images,
  classes,
  reviewRules,
  approvedOutputDirHandle,
  onApprove,
  onReject,
  onOpenRulesModal,
  onSetOutputFolder,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const pending = images.filter(img => img.status === 'pending_review');
  const approved = images.filter(img => img.status === 'approved');
  const rejected = images.filter(img => img.status === 'rejected');

  const selectedImage = images.find(img => img.id === selectedId) ?? (pending[0] ?? null);

  const violations: RuleViolation[] = selectedImage
    ? checkRulesForImage(selectedImage, reviewRules)
    : [];

  const handleApprove = () => {
    if (!selectedImage) return;
    onApprove(selectedImage.id);
    // Move to next pending
    const remaining = pending.filter(img => img.id !== selectedImage.id);
    setSelectedId(remaining[0]?.id ?? null);
    setIsRejecting(false);
  };

  const handleReject = () => {
    if (!selectedImage || !rejectComment.trim()) return;
    onReject(selectedImage.id, {
      comment: rejectComment.trim(),
      rejectedAt: new Date().toISOString(),
    });
    const remaining = pending.filter(img => img.id !== selectedImage.id);
    setSelectedId(remaining[0]?.id ?? null);
    setRejectComment('');
    setIsRejecting(false);
  };

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left panel — queue list */}
      <div className="w-64 border-r border-gray-700 flex flex-col bg-gray-800">
        {/* Toolbar */}
        <div className="p-3 border-b border-gray-700 space-y-2">
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs px-2 py-1 rounded bg-yellow-900/60 text-yellow-300 border border-yellow-700 font-bold">
              {pending.length} pending
            </span>
            <span className="text-xs px-2 py-1 rounded bg-green-900/60 text-green-300 border border-green-700 font-bold">
              {approved.length} approved
            </span>
            <span className="text-xs px-2 py-1 rounded bg-red-900/60 text-red-300 border border-red-700 font-bold">
              {rejected.length} rejected
            </span>
          </div>
          <button
            onClick={onOpenRulesModal}
            className="w-full text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors text-left flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            Configure Rules
          </button>
          <button
            onClick={onSetOutputFolder}
            className={`w-full text-xs px-3 py-1.5 rounded border transition-colors text-left flex items-center gap-2 ${
              approvedOutputDirHandle
                ? 'bg-green-900/40 text-green-300 border-green-700 hover:bg-green-900/60'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            {approvedOutputDirHandle ? `Folder: ${approvedOutputDirHandle.name}` : 'Set Output Folder'}
          </button>
        </div>

        {/* Pending list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pending.length === 0 ? (
            <div className="text-center text-gray-600 text-xs mt-8 px-4">
              No images pending review.
            </div>
          ) : (
            pending.map(img => {
              const v = checkRulesForImage(img, reviewRules);
              const isSelected = img.id === (selectedImage?.id);
              return (
                <div
                  key={img.id}
                  onClick={() => { setSelectedId(img.id); setIsRejecting(false); setRejectComment(''); }}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-gray-700 ring-1 ring-amber-500' : 'hover:bg-gray-700/50'}`}
                >
                  <div className="w-10 h-10 rounded bg-gray-900 flex-shrink-0 overflow-hidden border border-gray-600">
                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-gray-200">{img.file.name}</p>
                    <p className="text-xs text-gray-500">{img.boxes.length} boxes</p>
                    {img.ownerName && (
                      <p className="text-[10px] text-indigo-400 truncate">@{img.ownerName}</p>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} title={v.length === 0 ? 'Passes rules' : `${v.length} violation(s)`} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — image preview + actions */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedImage && selectedImage.status === 'pending_review' ? (
          <>
            {/* Image preview */}
            <div className="flex-1 relative bg-[#0d1117] flex items-center justify-center overflow-hidden min-h-0">
              <div className="relative max-w-full max-h-full" style={{ display: 'inline-block' }}>
                <img
                  src={selectedImage.url}
                  alt={selectedImage.file.name}
                  className="max-w-full max-h-full object-contain block"
                  style={{ maxHeight: 'calc(100vh - 280px)' }}
                />
                {/* Render bounding boxes as SVG overlay */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                >
                  {selectedImage.boxes.map(box => (
                    <g key={box.id}>
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        fill={box.color}
                        fillOpacity={0.15}
                        stroke={box.color}
                        strokeWidth={0.003}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Review panel */}
            <div className="border-t border-gray-700 bg-gray-800 p-4 space-y-4">
              <div className="flex items-start gap-6">
                {/* Image info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-200 truncate">{selectedImage.file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedImage.boxes.length} boxes
                    {selectedImage.ownerName && (
                      <span className="text-indigo-400"> · @{selectedImage.ownerName}</span>
                    )}
                    {selectedImage.submittedAt && ` · submitted ${new Date(selectedImage.submittedAt).toLocaleString()}`}
                  </p>
                  {/* Box labels summary */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Array.from(new Set(selectedImage.boxes.map(b => b.label))).map(label => {
                      const count = selectedImage.boxes.filter(b => b.label === label).length;
                      const box = selectedImage.boxes.find(b => b.label === label);
                      return (
                        <span
                          key={label}
                          className="text-xs px-2 py-0.5 rounded font-mono border"
                          style={{ borderColor: box?.color, color: box?.color, backgroundColor: `${box?.color}22` }}
                        >
                          {label} ×{count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Rule checklist */}
                <div className="w-56 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rule Check</p>
                  <RuleChecklist violations={violations} rules={reviewRules} />
                </div>
              </div>

              {/* Reject comment area */}
              {isRejecting && (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    placeholder="Describe what needs to be fixed..."
                    rows={2}
                    className="w-full bg-gray-900 border border-red-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={!rejectComment.trim()}
                      className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 font-medium"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setIsRejecting(false); setRejectComment(''); }}
                      className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isRejecting && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 text-sm bg-green-700 hover:bg-green-600 text-white rounded transition-colors font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Approve & Save
                  </button>
                  <button
                    onClick={() => setIsRejecting(true)}
                    className="px-5 py-2 text-sm bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-700 rounded transition-colors font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject
                  </button>
                  {violations.length > 0 && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                      {violations.length} rule violation{violations.length > 1 ? 's' : ''} — you can still approve
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
            <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-sm">
              {pending.length === 0 ? 'No images pending review' : 'Select an image from the queue'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewQueueView;
