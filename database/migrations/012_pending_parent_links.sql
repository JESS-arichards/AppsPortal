-- 012_pending_parent_links.sql
-- Pending order-independent parent-to-student links

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PendingParentStudentLinks')
BEGIN
    CREATE TABLE PendingParentStudentLinks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        parentId NVARCHAR(128) NOT NULL,
        studentEmail NVARCHAR(256) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_PendingParentStudentLinks UNIQUE (parentId, studentEmail),
        CONSTRAINT FK_PendingParentLinks_Parent FOREIGN KEY (parentId) REFERENCES ParentUsers(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PendingParentLinks_StudentEmail ON PendingParentStudentLinks(studentEmail);
END;
