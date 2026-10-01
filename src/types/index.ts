export interface User {
  id: string;
  email: string;
  displayName: string;
  forename?: string | null;
  surname?: string | null;
  userType: 'Staff' | 'Student' | 'Parent';
  authType: 'Entra' | 'Local';
  roles?: string[];
  classes?: string[];
  adminSections?: string[];
  parkingSpace?: number | null;
  extension?: number | null;
  department?: string | null;
  division?: string | null;
  jobTitle?: string | null;
  profilePicture?: string | null;
  createdAt?: string;
  updatedAt?: string;
  linkedStudents?: User[];
}

export interface ImpersonationState {
  active: boolean;
  actorId: string;
  actorEmail: string;
  actorName: string;
  targetId: string;
  targetType: 'Staff' | 'Student' | 'Parent';
  mode: 'view' | 'test';
}

export interface Branding {
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

export interface HomeContent {
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
}

export interface LoginContent {
  id: number;
  welcomeLabel: string;
  welcomeHeadline: string;
  valuesJson: string;
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
}

export interface ClassEntity {
  code: string;
  campus: 'ARP' | 'JJ' | 'ARS';
  name?: string | null;
}

export interface LessonPeriod {
  id: number;
  campus: 'ARP' | 'JJ' | 'ARS';
  weekday: number;
  periodName: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
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
  date: string;
  periodId: number;
  title: string;
  description?: string | null;
  teacherUserId: string;
  resources?: DistanceLessonResource[];
}

export interface ParkingRelease {
  id: number;
  ownerUserId: string;
  space: number;
  date: string;
  reserverUserId?: string | null;
  reservedAt?: string | null;
  ownerName?: string;
  reserverName?: string;
}

export interface AbsenceRequest {
  id: number;
  staffUserId: string;
  startDate: string;
  endDate: string;
  reason: string;
  releasedSpace?: number | null;
  parkingReleaseIds?: string | null;
  createdAt?: string;
}

export interface StreamItem {
  id: number;
  title: string;
  description?: string | null;
  categories: string;
  streamType: 'On Demand' | 'Live';
  accessType: 'Free to Air' | 'Pay Per View';
  videoUrl: string;
  thumbnailUrl?: string | null;
  active: boolean;
  createdBy?: string | null;
}

export interface PendingParentLink {
  id: number;
  parentId: string;
  studentEmail: string;
  createdAt: string;
  parentName?: string;
  parentEmail?: string;
}
