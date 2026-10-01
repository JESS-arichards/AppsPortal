import sql from 'mssql';
import { config } from '../config.js';
import * as Types from './types.js';

let pool: sql.ConnectionPool | null = null;
let isConnected = false;

// In-memory store for fallback/dev/test mode
export class MemoryStore {
  staffUsers: Map<string, Types.StaffUser> = new Map();
  studentUsers: Map<string, Types.StudentUser> = new Map();
  parentUsers: Map<string, Types.ParentUser> = new Map();
  classes: Map<string, Types.ClassEntity> = new Map();
  lessonPeriods: Map<number, Types.LessonPeriod> = new Map();
  distanceLessons: Map<string, Types.DistanceLesson> = new Map(); // key: classCode_date_periodId
  parkingReleases: Map<number, Types.ParkingRelease> = new Map();
  absenceRequests: Map<number, Types.AbsenceRequest> = new Map();
  streams: Map<number, Types.StreamItem> = new Map();
  parentLoginCodes: Array<{ email: string; codeHash: string; attempts: number; expiresAt: Date; usedAt: Date | null }> = [];
  parentStudents: Array<{ parentId: string; studentId: string }> = [];
  pendingParentLinks: Map<number, Types.PendingParentLink> = new Map();
  impersonationAudit: Types.ImpersonationAudit[] = [];

  branding: Types.PortalBranding = {
    id: 1,
    mainColor: '#002B49',
    accentColor: '#BA9B37',
    textColor: '#212529',
    navBgColor: null,
    navTextColor: null,
    navAccentColor: null,
    heroBgColor: null,
    heroTextColor: null,
    heroAccentColor: null,
    navLogo: null,
    favicon: null,
    updatedAt: new Date().toISOString(),
  };

  homeContent: Types.PortalHomeContent = {
    id: 1,
    heroLabel: 'Welcome to JESS Dubai',
    heroHeadline: 'Excellence, Empowerment and Purpose',
    heroIntro: 'Empowering our community through innovative digital education and streamlined school services.',
    heroImage: null,
    heroImageAlt: 'JESS Dubai Campus',
    captionName: 'JESS Leadership Team',
    captionRole: 'Executive Office',
    welcomeLabel: 'Our Community',
    welcomeHeading: 'Welcome to the JESS Enterprise Portal',
    welcomeMessage: 'Welcome to the JESS Dubai Enterprise Portal.\n\nThis unified platform provides staff, students, and parents with secure, direct access to essential services including distance learning schedules, staff parking management, attendance tracking, and live school event streaming.\n\nPlease use the navigation menu above to access your authorised services.',
    updatedAt: new Date().toISOString(),
  };

  loginContent: Types.PortalLoginContent = {
    id: 1,
    welcomeLabel: 'JESS Dubai',
    welcomeHeadline: 'Welcome to the School Community Portal',
    valuesJson: JSON.stringify(['Empowering Students', 'Excellence in Teaching', 'Community Partnership', 'Integrity & Care']),
    signInHeading: 'Sign in to JESS Portal',
    signInIntro: 'Choose your login method below to access school services.',
    staffChoiceTitle: 'Staff & Students',
    staffChoiceDescription: 'Sign in with your official school Microsoft account.',
    parentChoiceTitle: 'Parents & Guardians',
    parentChoiceDescription: 'Access your parent account using a secure one-time verification code.',
    parentEmailLabel: 'Registered Parent Email Address',
    parentCodeLabel: '6-Digit One-Time Verification Code',
    sendCodeLabel: 'Send Verification Code',
    verifyCodeLabel: 'Verify and Continue',
    resendCodeLabel: 'Resend Code',
    helpPrompt: 'Need assistance accessing your account?',
    helpLinkText: 'Contact JESS IT Helpdesk',
    updatedAt: new Date().toISOString(),
  };

  nextPeriodId = 1;
  nextParkingId = 1;
  nextAbsenceId = 1;
  nextStreamId = 1;
  nextPendingLinkId = 1;
  nextAuditId = 1;

  constructor() {
    this.seedDefaultData();
  }

  seedDefaultData() {
    // Default Admin Staff User
    const adminId = 'staff-admin-1';
    this.staffUsers.set(adminId, {
      id: adminId,
      email: 'admin@jess.sch.ae',
      displayName: 'System Administrator',
      forename: 'System',
      surname: 'Administrator',
      authType: 'Entra',
      jobTitle: 'IT Director & Portal Administrator',
      division: 'Senior School',
      department: 'Information Technology',
      parkingSpace: 12,
      extension: 101,
      roles: ['Admin', 'Staff'],
      classes: ['10-CSC-1', '12-MAT-2'],
      adminSections: ['users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Default Teacher Staff User
    const teacherId = 'staff-teacher-1';
    this.staffUsers.set(teacherId, {
      id: teacherId,
      email: 'teacher@jess.sch.ae',
      displayName: 'Sarah Jenkins',
      forename: 'Sarah',
      surname: 'Jenkins',
      authType: 'Entra',
      jobTitle: 'Head of Mathematics',
      division: 'Senior School',
      department: 'Mathematics',
      parkingSpace: 45,
      extension: 204,
      roles: ['Staff'],
      classes: ['10-MAT-1', '12-MAT-2'],
      adminSections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Default Student User
    const studentId = 'student-1';
    this.studentUsers.set(studentId, {
      id: studentId,
      email: 'alex.smith@student.jess.sch.ae',
      displayName: 'Alex Smith',
      forename: 'Alex',
      surname: 'Smith',
      authType: 'Entra',
      division: 'Senior School',
      department: 'Student Year 10',
      classes: ['10-CSC-1', '10-MAT-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Default Parent User
    const parentId = 'parent-1';
    this.parentUsers.set(parentId, {
      id: parentId,
      email: 'parent@example.com',
      displayName: 'Robert Smith',
      forename: 'Robert',
      surname: 'Smith',
      authType: 'Local',
      division: 'Parent Community',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Parent link
    this.parentStudents.push({ parentId, studentId });

    // Classes
    this.classes.set('10-CSC-1', { code: '10-CSC-1', campus: 'ARP', name: 'Year 10 Computer Science 1' });
    this.classes.set('10-MAT-1', { code: '10-MAT-1', campus: 'ARP', name: 'Year 10 Mathematics Higher' });
    this.classes.set('12-MAT-2', { code: '12-MAT-2', campus: 'ARS', name: 'Year 12 Further Mathematics' });

    // Lesson Periods
    const weekdays = [1, 2, 3, 4, 5];
    weekdays.forEach(day => {
      this.lessonPeriods.set(this.nextPeriodId++, {
        id: this.nextPeriodId - 1,
        campus: 'ARP',
        weekday: day,
        periodName: 'Period 1: Morning Focus',
        startTime: '08:00',
        endTime: '08:50',
        sortOrder: 1,
      });
      this.lessonPeriods.set(this.nextPeriodId++, {
        id: this.nextPeriodId - 1,
        campus: 'ARP',
        weekday: day,
        periodName: 'Period 2: Academic Core',
        startTime: '09:00',
        endTime: '09:50',
        sortOrder: 2,
      });
      this.lessonPeriods.set(this.nextPeriodId++, {
        id: this.nextPeriodId - 1,
        campus: 'ARP',
        weekday: day,
        periodName: 'Period 3: Midday Lecture',
        startTime: '10:15',
        endTime: '11:05',
        sortOrder: 3,
      });
    });

    // Seed sample streams
    this.streams.set(this.nextStreamId++, {
      id: this.nextStreamId - 1,
      title: 'JESS Annual Sports Day 2026',
      description: 'Live broadcast of track and field events from the Arabian Ranches campus main stadium.',
      categories: 'Sports, Athletics, Live Broadcast',
      streamType: 'Live',
      accessType: 'Free to Air',
      videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      thumbnailUrl: null,
      active: true,
      createdBy: 'admin@jess.sch.ae',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.streams.set(this.nextStreamId++, {
      id: this.nextStreamId - 1,
      title: 'Spring Concert & Orchestra Highlights',
      description: 'Recording of the spectacular 2026 Spring Musical Showcase in the JESS Auditorium.',
      categories: 'Music, Arts, Concert',
      streamType: 'On Demand',
      accessType: 'Free to Air',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailUrl: null,
      active: true,
      createdBy: 'admin@jess.sch.ae',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Sample parking release for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    this.parkingReleases.set(this.nextParkingId++, {
      id: this.nextParkingId - 1,
      ownerUserId: adminId,
      space: 12,
      date: tomorrowStr,
      reserverUserId: null,
      reservedAt: null,
      createdAt: new Date().toISOString(),
      ownerName: 'System Administrator',
    });
  }
}

export const memoryStore = new MemoryStore();

export async function initDatabase(): Promise<void> {
  if (config.sqlConnectionString) {
    try {
      console.log('[Database] Connecting to Azure SQL Database...');
      pool = new sql.ConnectionPool(config.sqlConnectionString);
      await pool.connect();
      isConnected = true;
      console.log('[Database] Connected successfully to Azure SQL.');
    } catch (err) {
      console.error('[Database] Failed to connect to Azure SQL. Falling back to robust in-memory database:', err);
      isConnected = false;
    }
  } else {
    console.log('[Database] No SQL_CONNECTION_STRING provided. Running in memory store mode for local development/testing.');
  }
}

export function isAzureSqlConnected(): boolean {
  return isConnected && pool !== null;
}

export function getPool(): sql.ConnectionPool | null {
  return pool;
}
