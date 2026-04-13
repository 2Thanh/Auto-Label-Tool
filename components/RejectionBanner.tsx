import React from 'react';
import { RejectionFeedback } from '../types';

interface RejectionBannerProps {
  feedback: RejectionFeedback;
  onDismiss: () => void;
}

const RejectionBanner: React.FC<RejectionBannerProps> = ({ feedback, onDismiss }) => {
  const date = new Date(feedback.rejectedAt).toLocaleString();

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-950/80 border-b border-red-700 text-sm">
      <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-300">Rejected by reviewer</p>
        <p className="text-red-200 mt-0.5 break-words">{feedback.comment}</p>
        <p className="text-red-500 text-xs mt-1">{date}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-red-500 hover:text-red-300 flex-shrink-0 p-1 rounded hover:bg-red-900/50 transition-colors"
        title="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default RejectionBanner;
