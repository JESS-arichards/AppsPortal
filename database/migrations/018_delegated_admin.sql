-- 018_delegated_admin.sql
-- Delegated administration permissions for non-full admin staff

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StaffAdminTabPermissions')
BEGIN
    CREATE TABLE StaffAdminTabPermissions (
        staffUserId NVARCHAR(128) NOT NULL,
        section NVARCHAR(50) NOT NULL, -- 'users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PRIMARY KEY (staffUserId, section),
        CONSTRAINT FK_StaffAdminTabPermissions_Staff FOREIGN KEY (staffUserId) REFERENCES StaffUsers(id) ON DELETE CASCADE
    );
END;
