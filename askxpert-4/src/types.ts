export interface NotificationRegistration {
  name: string;
  email: string;
  phone: string;
  department: string;
  yearOfStudy: string;
}

export interface Registration {
  name: string;
  email: string;
  phone: string;
  language?: 'English' | 'Malayalam';
  ieeeStatus: 'member' | 'non-member';
  ieeeId?: string;
  college: string;
  department: string;
  yearOfStudy: string;
  expectations?: string;
  ticketId: string;
  createdAt: any; // Firestore timestamp or serverTimestamp
  transactionId?: string;
  screenshot?: string; // Base64 payment screenshot
  paymentStatus?: 'pending' | 'verified' | 'failed';
  roleType?: 'student' | 'professional';
  institutionName?: string;
  courseName?: string;
  otherCourseName?: string;
  organizationName?: string;
  currentRole?: string;
  designation?: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}
