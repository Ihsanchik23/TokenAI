export const assignmentFileTypes = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
] as const;

export const maxAssignmentFileSize = 10 * 1024 * 1024;
export const maxAssignmentFiles = 5;

export type AssignmentFile = {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  signedUrl?: string | null;
};

export type AssignmentSubmission = {
  id: string;
  attemptNumber: number;
  textAnswer: string | null;
  linkUrl: string | null;
  status: "submitted" | "approved" | "needs_revision";
  teacherComment: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  files: AssignmentFile[];
};

export type AssignmentLessonData = {
  assignmentId: string;
  instructions: string;
  allowText: boolean;
  allowLink: boolean;
  allowFile: boolean;
  allowResubmission: boolean;
  submissions: AssignmentSubmission[];
  approvedAttemptExists: boolean;
};

export type UploadedAssignmentFile = {
  path: string;
  name: string;
};
