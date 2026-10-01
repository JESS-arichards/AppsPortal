-- 019_impersonation.sql
-- Admin impersonation audit log

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
    CREATE INDEX IX_AdminImpersonationAudit_SessionId ON AdminImpersonationAudit(sessionId);
    CREATE INDEX IX_AdminImpersonationAudit_Actor ON AdminImpersonationAudit(actorUserId, createdAt);
END;
