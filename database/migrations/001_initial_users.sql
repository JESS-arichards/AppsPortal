-- 001_initial_users.sql
-- Core user tables and relationships for JESS Portal

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StaffUsers')
BEGIN
    CREATE TABLE StaffUsers (
        id NVARCHAR(128) PRIMARY KEY,
        email NVARCHAR(256) NOT NULL UNIQUE,
        displayName NVARCHAR(256) NOT NULL,
        forename NVARCHAR(128) NULL,
        surname NVARCHAR(128) NULL,
        authType NVARCHAR(32) NOT NULL DEFAULT 'Entra', -- 'Entra' | 'Local'
        jobTitle NVARCHAR(256) NULL,
        division NVARCHAR(128) NULL,
        department NVARCHAR(128) NULL,
        profilePicture NVARCHAR(MAX) NULL,
        parkingSpace INT NULL,
        extension INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentUsers')
BEGIN
    CREATE TABLE StudentUsers (
        id NVARCHAR(128) PRIMARY KEY,
        email NVARCHAR(256) NOT NULL UNIQUE,
        displayName NVARCHAR(256) NOT NULL,
        forename NVARCHAR(128) NULL,
        surname NVARCHAR(128) NULL,
        authType NVARCHAR(32) NOT NULL DEFAULT 'Entra',
        division NVARCHAR(128) NULL,
        department NVARCHAR(128) NULL,
        profilePicture NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParentUsers')
BEGIN
    CREATE TABLE ParentUsers (
        id NVARCHAR(128) PRIMARY KEY,
        email NVARCHAR(256) NOT NULL UNIQUE,
        displayName NVARCHAR(256) NOT NULL,
        forename NVARCHAR(128) NULL,
        surname NVARCHAR(128) NULL,
        authType NVARCHAR(32) NOT NULL DEFAULT 'Local',
        division NVARCHAR(128) NULL,
        profilePicture NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StaffUserRoles')
BEGIN
    CREATE TABLE StaffUserRoles (
        staffUserId NVARCHAR(128) NOT NULL,
        role NVARCHAR(64) NOT NULL, -- 'Admin', 'Staff', 'Onboarding', 'Oasis'
        PRIMARY KEY (staffUserId, role),
        CONSTRAINT FK_StaffUserRoles_StaffUsers FOREIGN KEY (staffUserId) REFERENCES StaffUsers(id) ON DELETE CASCADE
    );
END;

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

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParentStudents')
BEGIN
    CREATE TABLE ParentStudents (
        parentId NVARCHAR(128) NOT NULL,
        studentId NVARCHAR(128) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PRIMARY KEY (parentId, studentId),
        CONSTRAINT FK_ParentStudents_Parent FOREIGN KEY (parentId) REFERENCES ParentUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_ParentStudents_Student FOREIGN KEY (studentId) REFERENCES StudentUsers(id) ON DELETE CASCADE
    );
END;
