-- 013_branding_and_content.sql
-- Portal branding and custom dynamic content

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalBranding')
BEGIN
    CREATE TABLE PortalBranding (
        id INT PRIMARY KEY DEFAULT 1,
        mainColor NVARCHAR(7) NOT NULL DEFAULT '#002B49',
        accentColor NVARCHAR(7) NOT NULL DEFAULT '#BA9B37',
        textColor NVARCHAR(7) NOT NULL DEFAULT '#212529',
        navBgColor NVARCHAR(7) NULL,
        navTextColor NVARCHAR(7) NULL,
        navAccentColor NVARCHAR(7) NULL,
        heroBgColor NVARCHAR(7) NULL,
        heroTextColor NVARCHAR(7) NULL,
        heroAccentColor NVARCHAR(7) NULL,
        navLogo NVARCHAR(MAX) NULL,
        favicon NVARCHAR(MAX) NULL,
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PortalBranding_SingleRow CHECK (id = 1)
    );

    INSERT INTO PortalBranding (id, mainColor, accentColor, textColor)
    VALUES (1, '#002B49', '#BA9B37', '#212529');
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalHomeContent')
BEGIN
    CREATE TABLE PortalHomeContent (
        id INT PRIMARY KEY DEFAULT 1,
        heroLabel NVARCHAR(120) NOT NULL DEFAULT 'Welcome to JESS Dubai',
        heroHeadline NVARCHAR(200) NOT NULL DEFAULT 'Excellence, Empowerment and Purpose',
        heroIntro NVARCHAR(1000) NOT NULL DEFAULT 'Empowering our community through innovative digital education and streamlined school services.',
        heroImage NVARCHAR(MAX) NULL, -- Base64 data URL or NULL for default
        heroImageAlt NVARCHAR(200) NOT NULL DEFAULT 'JESS Dubai Campus',
        captionName NVARCHAR(150) NOT NULL DEFAULT 'JESS Leadership Team',
        captionRole NVARCHAR(100) NOT NULL DEFAULT 'Executive Office',
        welcomeLabel NVARCHAR(120) NOT NULL DEFAULT 'Our Community',
        welcomeHeading NVARCHAR(250) NOT NULL DEFAULT 'Welcome to the JESS Enterprise Portal',
        welcomeMessage NVARCHAR(MAX) NOT NULL DEFAULT 'Welcome to the JESS Dubai Enterprise Portal.\n\nThis unified platform provides staff, students, and parents with secure, direct access to essential services including distance learning schedules, staff parking management, attendance tracking, and live school event streaming.\n\nPlease use the navigation menu above to access your authorised services.',
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PortalHomeContent_SingleRow CHECK (id = 1)
    );

    INSERT INTO PortalHomeContent (id) VALUES (1);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PortalLoginContent')
BEGIN
    CREATE TABLE PortalLoginContent (
        id INT PRIMARY KEY DEFAULT 1,
        welcomeLabel NVARCHAR(120) NOT NULL DEFAULT 'JESS Dubai',
        welcomeHeadline NVARCHAR(200) NOT NULL DEFAULT 'Welcome to the School Community Portal',
        valuesJson NVARCHAR(MAX) NOT NULL DEFAULT '["Empowering Students","Excellence in Teaching","Community Partnership","Integrity & Care"]',
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

    INSERT INTO PortalLoginContent (id) VALUES (1);
END;
