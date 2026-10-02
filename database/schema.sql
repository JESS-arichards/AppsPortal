-- ============================================================================
-- JESS Dubai Community Portal - Database Schema
-- Target: Microsoft Azure SQL Database / Microsoft SQL Server 2019+
--
-- Single source of truth for the database structure. The server runs this
-- script on every start (database/schema.sql via ensureSchema), so every
-- statement must be idempotent. To rebuild an existing database from scratch
-- run `npm run db:reset`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Guard against the pre-consolidation schema (separate Staff/Student/Parent
--    user tables). It cannot be upgraded in place; rebuild with db:reset.
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.StaffUsers', 'U') IS NOT NULL
    THROW 50001, 'Legacy schema detected (StaffUsers table). Run "npm run db:reset" to rebuild the database.', 1;
GO

-- ----------------------------------------------------------------------------
-- 1. Users (staff, students and parents share one table)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        id NVARCHAR(128) PRIMARY KEY,
        userType NVARCHAR(10) NOT NULL, -- 'Staff' | 'Student' | 'Parent'
        email NVARCHAR(256) NOT NULL, -- always stored lower-case
        displayName NVARCHAR(256) NOT NULL,
        forename NVARCHAR(128) NULL,
        surname NVARCHAR(128) NULL,
        authType NVARCHAR(32) NOT NULL, -- 'Entra' | 'Local'
        jobTitle NVARCHAR(256) NULL, -- staff only
        division NVARCHAR(128) NULL,
        department NVARCHAR(128) NULL, -- staff & students
        profilePicture NVARCHAR(MAX) NULL, -- base64 data URL, served via /api/auth/users/:id/picture
        parkingSpace INT NULL, -- staff only
        extension INT NULL, -- staff only
        misId NVARCHAR(64) NULL, -- staff only (Entra employeeId)
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Users_UserType CHECK (userType IN ('Staff', 'Student', 'Parent')),
        -- The same address may exist once per user type (e.g. a staff member who is also a parent).
        CONSTRAINT UQ_Users_Type_Email UNIQUE (userType, email)
    );
    CREATE INDEX IX_Users_Type_DisplayName ON Users(userType, displayName);
END;
GO

-- ----------------------------------------------------------------------------
-- 2. Staff roles & delegated admin sections
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    CREATE TABLE UserRoles (
        userId NVARCHAR(128) NOT NULL,
        role NVARCHAR(64) NOT NULL, -- 'Admin', 'Staff', 'Onboarding', 'Oasis'
        PRIMARY KEY (userId, role),
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserAdminSections')
BEGIN
    CREATE TABLE UserAdminSections (
        userId NVARCHAR(128) NOT NULL,
        section NVARCHAR(50) NOT NULL, -- 'users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'
        PRIMARY KEY (userId, section),
        CONSTRAINT FK_UserAdminSections_Users FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
    );
END;
GO

-- ----------------------------------------------------------------------------
-- 3. Parent sign-in codes & parent/student links
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParentLoginCodes')
BEGIN
    CREATE TABLE ParentLoginCodes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(256) NOT NULL,
        codeHash NVARCHAR(256) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expiresAt DATETIME2 NOT NULL,
        usedAt DATETIME2 NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ParentLoginCodes_Email_ExpiresAt ON ParentLoginCodes(email, expiresAt);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParentStudents')
BEGIN
    CREATE TABLE ParentStudents (
        parentId NVARCHAR(128) NOT NULL,
        studentId NVARCHAR(128) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PRIMARY KEY (parentId, studentId),
        CONSTRAINT FK_ParentStudents_Parent FOREIGN KEY (parentId) REFERENCES Users(id) ON DELETE CASCADE,
        -- SQL Server allows only one cascade path from Users, so the student side is NO ACTION.
        CONSTRAINT FK_ParentStudents_Student FOREIGN KEY (studentId) REFERENCES Users(id)
    );
    CREATE INDEX IX_ParentStudents_Student ON ParentStudents(studentId);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PendingParentStudentLinks')
BEGIN
    CREATE TABLE PendingParentStudentLinks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        parentId NVARCHAR(128) NOT NULL,
        studentEmail NVARCHAR(256) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_PendingParentStudentLinks UNIQUE (parentId, studentEmail),
        CONSTRAINT FK_PendingParentLinks_Parent FOREIGN KEY (parentId) REFERENCES Users(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PendingParentLinks_StudentEmail ON PendingParentStudentLinks(studentEmail);
END;
GO

-- ----------------------------------------------------------------------------
-- 4. Classes, class membership & lesson periods
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Classes')
BEGIN
    CREATE TABLE Classes (
        code NVARCHAR(20) PRIMARY KEY, -- [A-Z0-9-]{1,20}
        campus NVARCHAR(10) NOT NULL, -- 'ARP', 'JJ', 'ARS'
        name NVARCHAR(100) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserClasses')
BEGIN
    CREATE TABLE UserClasses (
        userId NVARCHAR(128) NOT NULL, -- staff teaching or student enrolled
        classCode NVARCHAR(20) NOT NULL,
        PRIMARY KEY (userId, classCode),
        CONSTRAINT FK_UserClasses_Users FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
        CONSTRAINT FK_UserClasses_Classes FOREIGN KEY (classCode) REFERENCES Classes(code) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LessonPeriods')
BEGIN
    CREATE TABLE LessonPeriods (
        id INT IDENTITY(1,1) PRIMARY KEY,
        campus NVARCHAR(10) NOT NULL, -- 'ARP', 'JJ', 'ARS'
        weekday INT NOT NULL, -- 1 (Monday) to 7 (Sunday)
        periodName NVARCHAR(50) NOT NULL,
        startTime NVARCHAR(5) NOT NULL, -- 'HH:MM'
        endTime NVARCHAR(5) NOT NULL, -- 'HH:MM'
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_LessonPeriods_Campus_Weekday ON LessonPeriods(campus, weekday, sortOrder);
END;
GO

-- ----------------------------------------------------------------------------
-- 5. Distance learning
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DistanceLessons')
BEGIN
    CREATE TABLE DistanceLessons (
        id INT IDENTITY(1,1) PRIMARY KEY,
        classCode NVARCHAR(20) NOT NULL,
        date NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        periodId INT NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(4000) NULL,
        teacherUserId NVARCHAR(128) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_DistanceLessons_Class_Date_Period UNIQUE (classCode, date, periodId),
        CONSTRAINT FK_DistanceLessons_Classes FOREIGN KEY (classCode) REFERENCES Classes(code) ON DELETE CASCADE,
        CONSTRAINT FK_DistanceLessons_LessonPeriods FOREIGN KEY (periodId) REFERENCES LessonPeriods(id) ON DELETE CASCADE,
        CONSTRAINT FK_DistanceLessons_Teacher FOREIGN KEY (teacherUserId) REFERENCES Users(id)
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DistanceLessonResources')
BEGIN
    CREATE TABLE DistanceLessonResources (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lessonId INT NOT NULL,
        label NVARCHAR(200) NOT NULL,
        url NVARCHAR(1000) NULL,
        fileData NVARCHAR(MAX) NULL, -- base64 data URL, served via /api/distance-learning/resources/:id/file
        fileName NVARCHAR(255) NULL,
        mimeType NVARCHAR(100) NULL,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_DistanceLessonResources_Lesson FOREIGN KEY (lessonId) REFERENCES DistanceLessons(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_DistanceLessonResources_LessonId ON DistanceLessonResources(lessonId, sortOrder);
END;
GO

-- ----------------------------------------------------------------------------
-- 6. Staff absence & parking pool
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AbsenceRequests')
BEGIN
    CREATE TABLE AbsenceRequests (
        id INT IDENTITY(1,1) PRIMARY KEY,
        staffUserId NVARCHAR(128) NOT NULL,
        startDate NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        endDate NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        reason NVARCHAR(1000) NOT NULL,
        releasedSpace INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AbsenceRequests_Staff FOREIGN KEY (staffUserId) REFERENCES Users(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_AbsenceRequests_Staff_Dates ON AbsenceRequests(staffUserId, startDate, endDate);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParkingReleases')
BEGIN
    CREATE TABLE ParkingReleases (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ownerUserId NVARCHAR(128) NOT NULL,
        space INT NOT NULL,
        date NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        reserverUserId NVARCHAR(128) NULL,
        reservedAt DATETIME2 NULL,
        absenceRequestId INT NULL, -- set when the release was created by an absence request
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ParkingReleases_Owner_Date UNIQUE (ownerUserId, date),
        CONSTRAINT FK_ParkingReleases_Owner FOREIGN KEY (ownerUserId) REFERENCES Users(id) ON DELETE CASCADE,
        CONSTRAINT FK_ParkingReleases_Reserver FOREIGN KEY (reserverUserId) REFERENCES Users(id),
        -- NO ACTION: Users already cascades here via ownerUserId; the app detaches releases before deleting an absence.
        CONSTRAINT FK_ParkingReleases_Absence FOREIGN KEY (absenceRequestId) REFERENCES AbsenceRequests(id)
    );
    CREATE INDEX IX_ParkingReleases_Date ON ParkingReleases(date);
    CREATE INDEX IX_ParkingReleases_Reserver ON ParkingReleases(reserverUserId);
    CREATE INDEX IX_ParkingReleases_Absence ON ParkingReleases(absenceRequestId);
END;
GO

-- ----------------------------------------------------------------------------
-- 7. Streaming video catalogue
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Streams')
BEGIN
    CREATE TABLE Streams (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(2000) NULL,
        categories NVARCHAR(500) NOT NULL DEFAULT '', -- comma-separated tags
        streamType NVARCHAR(50) NOT NULL, -- 'On Demand' | 'Live'
        accessType NVARCHAR(50) NOT NULL, -- 'Free to Air' | 'Pay Per View'
        videoUrl NVARCHAR(1000) NOT NULL, -- Castr iframe or .m3u8 HLS URL
        thumbnailUrl NVARCHAR(MAX) NULL, -- external URL or base64 data URL (served via /api/media/streams/:id/thumbnail)
        active BIT NOT NULL DEFAULT 1,
        createdBy NVARCHAR(256) NULL, -- email of the admin who created the stream
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Streams_Active_Type ON Streams(active, streamType);
END;
GO

-- ----------------------------------------------------------------------------
-- 8. Branding & editable page content (single-row tables, id = 1)
--    Defaults must match shared/defaults.ts.
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalBranding')
BEGIN
    CREATE TABLE PortalBranding (
        id INT PRIMARY KEY DEFAULT 1,
        mainColor NVARCHAR(7) NOT NULL DEFAULT '#002B49',
        accentColor NVARCHAR(7) NOT NULL DEFAULT '#BA9B37',
        textColor NVARCHAR(7) NOT NULL DEFAULT '#212529',
        navBgColor NVARCHAR(7) NULL,
        navTextColor NVARCHAR(7) NULL,
        heroBgColor NVARCHAR(7) NULL,
        heroTextColor NVARCHAR(7) NULL,
        navLogo NVARCHAR(MAX) NULL, -- served via /api/media/branding/navLogo
        favicon NVARCHAR(MAX) NULL, -- served via /api/media/branding/favicon
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PortalBranding_SingleRow CHECK (id = 1)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM PortalBranding WHERE id = 1)
    INSERT INTO PortalBranding (id) VALUES (1);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalHomeContent')
BEGIN
    CREATE TABLE PortalHomeContent (
        id INT PRIMARY KEY DEFAULT 1,
        heroLabel NVARCHAR(120) NOT NULL DEFAULT 'Welcome to JESS Dubai',
        heroHeadline NVARCHAR(200) NOT NULL DEFAULT 'Excellence, Empowerment and Purpose',
        heroIntro NVARCHAR(1000) NOT NULL DEFAULT 'Empowering our community through innovative digital education and streamlined school services.',
        heroImage NVARCHAR(MAX) NULL, -- served via /api/media/home/heroImage
        heroImageAlt NVARCHAR(200) NOT NULL DEFAULT 'JESS Dubai Campus',
        captionName NVARCHAR(150) NOT NULL DEFAULT 'JESS Leadership Team',
        captionRole NVARCHAR(100) NOT NULL DEFAULT 'Executive Office',
        welcomeLabel NVARCHAR(120) NOT NULL DEFAULT 'Our Community',
        welcomeHeading NVARCHAR(250) NOT NULL DEFAULT 'Welcome to the JESS Enterprise Portal',
        welcomeMessage NVARCHAR(MAX) NOT NULL DEFAULT 'Welcome to the JESS Dubai Enterprise Portal.

This unified platform provides staff, students, and parents with secure, direct access to essential services including distance learning schedules, staff parking management, attendance tracking, and live school event streaming.

Please use the navigation menu above to access your authorised services.',
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PortalHomeContent_SingleRow CHECK (id = 1)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM PortalHomeContent WHERE id = 1)
    INSERT INTO PortalHomeContent (id) VALUES (1);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalLoginContent')
BEGIN
    CREATE TABLE PortalLoginContent (
        id INT PRIMARY KEY DEFAULT 1,
        welcomeHeadline NVARCHAR(200) NOT NULL DEFAULT 'Welcome to the School Community Portal',
        valuesJson NVARCHAR(MAX) NOT NULL DEFAULT '[{"text":"Commitment","icon":null},{"text":"Respect","icon":null},{"text":"Excellence","icon":null},{"text":"Care","icon":null},{"text":"Integrity","icon":null},{"text":"Curiosity","icon":null}]',
        signInHeading NVARCHAR(200) NOT NULL DEFAULT 'Sign in to JESS Portal',
        signInIntro NVARCHAR(1000) NOT NULL DEFAULT 'Choose your login method below to access school services.',
        staffChoiceTitle NVARCHAR(150) NOT NULL DEFAULT 'Staff & Students',
        staffChoiceDescription NVARCHAR(500) NOT NULL DEFAULT 'Sign in with your official school Microsoft account.',
        parentChoiceTitle NVARCHAR(150) NOT NULL DEFAULT 'Parents & Guardians',
        parentChoiceDescription NVARCHAR(500) NOT NULL DEFAULT 'Access your parent account using a secure one-time verification code.',
        parentEmailLabel NVARCHAR(100) NOT NULL DEFAULT 'Registered Parent Email Address',
        parentCodeLabel NVARCHAR(100) NOT NULL DEFAULT '6-Digit One-Time Verification Code',
        sendCodeLabel NVARCHAR(100) NOT NULL DEFAULT 'Send Verification Code',
        verifyCodeLabel NVARCHAR(100) NOT NULL DEFAULT 'Verify and Continue',
        resendCodeLabel NVARCHAR(100) NOT NULL DEFAULT 'Resend Code',
        helpPrompt NVARCHAR(250) NOT NULL DEFAULT 'Need assistance accessing your account?',
        helpLinkText NVARCHAR(100) NOT NULL DEFAULT 'Contact JESS IT Helpdesk',
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PortalLoginContent_SingleRow CHECK (id = 1)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM PortalLoginContent WHERE id = 1)
    INSERT INTO PortalLoginContent (id) VALUES (1);
GO

-- ----------------------------------------------------------------------------
-- 9. Impersonation audit trail (append-only)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdminImpersonationAudit')
BEGIN
    CREATE TABLE AdminImpersonationAudit (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sessionId NVARCHAR(128) NOT NULL,
        actorUserId NVARCHAR(128) NOT NULL,
        actorEmail NVARCHAR(256) NOT NULL,
        targetUserId NVARCHAR(128) NOT NULL,
        targetEmail NVARCHAR(256) NOT NULL,
        targetType NVARCHAR(32) NOT NULL, -- 'Staff', 'Student', 'Parent'
        mode NVARCHAR(32) NOT NULL, -- 'view', 'test'
        eventType NVARCHAR(64) NOT NULL, -- 'start', 'stop', 'action_allowed', 'action_blocked'
        method NVARCHAR(16) NULL,
        path NVARCHAR(500) NULL,
        details NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_AdminImpersonationAudit_Actor ON AdminImpersonationAudit(actorUserId, createdAt);
END;
GO
