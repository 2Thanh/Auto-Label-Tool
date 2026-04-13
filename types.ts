export interface BoundingBox {
  id: string;
  x: number; // Percentage 0-1
  y: number; // Percentage 0-1
  width: number; // Percentage 0-1
  height: number; // Percentage 0-1
  label: string;
  color: string;
  score?: number; // Confidence score from AI predictions (0-1)
}

export interface LabelClass {
  id: number;
  name: string;
}

export type AnnotationStatus =
  | 'unannotated'     // No boxes drawn yet
  | 'in_progress'     // Has boxes but not submitted
  | 'pending_review'  // Submitted by annotator, awaiting reviewer
  | 'approved'        // Reviewer accepted
  | 'rejected';       // Reviewer rejected, returned with feedback

export interface RejectionFeedback {
  comment: string;
  rejectedAt: string; // ISO timestamp
}

export interface DatasetImage {
  id: string;
  /** userId of the annotator who uploaded this image. Undefined = legacy/pre-ownership data. */
  ownerId?: string;
  /** Display name of the annotator, shown in the reviewer queue. */
  ownerName?: string;
  file: File;
  url: string;
  width: number;
  height: number;
  boxes: BoundingBox[];
  status: AnnotationStatus;
  submittedAt?: string;  // ISO timestamp when annotator submitted
  approvedAt?: string;   // ISO timestamp when reviewer approved
  rejectionFeedback?: RejectionFeedback;
}

export interface ReviewRules {
  minBoxCount: number;         // 0 = no minimum
  maxBoxCount: number;         // 0 = no maximum
  minConfidenceScore: number;  // 0-1; only applied to boxes with a score field
  requiredClasses: string[];   // Class names that must appear at least once
  forbiddenClasses: string[];  // Class names that must NOT appear
}

export interface RuleViolation {
  rule: string;
  detail: string;
}

export type AppRole = 'annotator' | 'reviewer';

export type UserRole = 'annotator' | 'reviewer' | 'admin';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string; // hex-encoded SHA-256
  role: UserRole;
  createdAt: string;    // ISO timestamp
}

export interface Session {
  userId: string;
  username: string;
  role: UserRole;
}

export interface ClassStat {
  name: string;
  count: number;
  color: string;
  [key: string]: any;
}

// Format expected from external Python scripts or Gemini
export interface ExternalModelPrediction {
  label: string;
  ymin: number; // 0-1
  xmin: number; // 0-1
  ymax: number; // 0-1
  xmax: number; // 0-1
  score?: number;
}
