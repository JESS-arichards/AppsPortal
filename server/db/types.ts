export interface StaffUser {
  id: string;
  email: string;
  displayName: string;
  forename?: string | null;
  surname?: string | null;
  authType: 'Entra' | 'Local';
  jobTitle?: string | null;
  division?: string | null;
  department?: string | null;
  profilePicture?: string | null;
  parkingSpace?: number | null;
  extension?: number | null;
  misId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  roles?: string[]; // 'Admin' | 'Staff' | 'Onboarding' | 'Oasis'
  classes?: string[];
  adminSections?: string[]; // 'users' | 'classes' | 'periods' | 'parentLinks' | 'parking' | 'streaming' | 'branding'
}

export interface StudentUser {
  id: string;
  email: string;
  displayName: string;
  forename?: string | null;
  surname?: string | null;
  authType: 'Entra';
  division?: string | null;
  department?: string | null;
  profilePicture?: string | null;
  createdAt?: string;
  updatedAt?: string;
  classes?: string[];
}

export interface ParentUser {
  id: string;
  email: string;
  displayName: string;
  forename?: string | null;
  surname?: string | null;
  authType: 'Local';
  division?: string | null;
  profilePicture?: string | null;
  createdAt?: string;
  updatedAt?: string;
  linkedStudents?: StudentUser[];
}

export type AnyUser = (StaffUser & { userType: 'Staff' }) | (StudentUser & { userType: 'Student' }) | (ParentUser & { userType: 'Parent' });

export interface ClassEntity {
  code: string;
  campus: 'ARP' | 'JJ' | 'ARS';
  name?: string | null;
  createdAt?: string;
}

export interface LessonPeriod {
  id: number;
  campus: 'ARP' | 'JJ' | 'ARS';
  weekday: number; // 1-7
  periodName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  sortOrder: number;
  createdAt?: string;
}

export interface DistanceLessonResource {
  id?: number;
  lessonId?: number;
  label: string;
  url?: string | null;
  fileData?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sortOrder?: number;
}

export interface DistanceLesson {
  id: number;
  classCode: string;
  date: string; // YYYY-MM-DD
  periodId: number;
  title: string;
  description?: string | null;
  teacherUserId: string;
  createdAt?: string;
  updatedAt?: string;
  resources?: DistanceLessonResource[];
}

export interface ParkingRelease {
  id: number;
  ownerUserId: string;
  space: number;
  date: string; // YYYY-MM-DD
  reserverUserId?: string | null;
  reservedAt?: string | null;
  createdAt?: string;
  ownerName?: string;
  reserverName?: string;
}

export interface AbsenceRequest {
  id: number;
  staffUserId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  releasedSpace?: number | null;
  parkingReleaseIds?: string | null; // comma-separated
  createdAt?: string;
}

export interface StreamItem {
  id: number;
  title: string;
  description?: string | null;
  categories: string; // comma-separated
  streamType: 'On Demand' | 'Live';
  accessType: 'Free to Air' | 'Pay Per View';
  videoUrl: string;
  thumbnailUrl?: string | null;
  active: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortalBranding {
  id: number;
  mainColor: string;
  accentColor: string;
  textColor: string;
  navBgColor?: string | null;
  navTextColor?: string | null;
  navAccentColor?: string | null;
  heroBgColor?: string | null;
  heroTextColor?: string | null;
  heroAccentColor?: string | null;
  navLogo?: string | null;
  favicon?: string | null;
  updatedAt?: string;
}

export interface PortalHomeContent {
  id: number;
  heroLabel: string;
  heroHeadline: string;
  heroIntro: string;
  heroImage?: string | null;
  heroImageAlt: string;
  captionName: string;
  captionRole: string;
  welcomeLabel: string;
  welcomeHeading: string;
  welcomeMessage: string;
  updatedAt?: string;
}

export interface PortalLoginContent {
  id: number;
  welcomeLabel: string;
  welcomeHeadline: string;
  valuesJson: string; // JSON array of { text, icon } (legacy rows: string[])
  signInHeading: string;
  signInIntro: string;
  staffChoiceTitle: string;
  staffChoiceDescription: string;
  parentChoiceTitle: string;
  parentChoiceDescription: string;
  parentEmailLabel: string;
  parentCodeLabel: string;
  sendCodeLabel: string;
  verifyCodeLabel: string;
  resendCodeLabel: string;
  helpPrompt: string;
  helpLinkText: string;
  updatedAt?: string;
}

export interface ImpersonationAudit {
  id: number;
  sessionId: string;
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  targetType: 'Staff' | 'Student' | 'Parent';
  mode: 'view' | 'test';
  eventType: 'start' | 'stop' | 'action_allowed' | 'action_blocked';
  method?: string | null;
  path?: string | null;
  details?: string | null;
  createdAt?: string;
}

export interface PendingParentLink {
  id: number;
  parentId: string;
  studentEmail: string;
  createdAt: string;
  parentName?: string;
  parentEmail?: string;
}
