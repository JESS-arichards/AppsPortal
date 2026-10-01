-- 002_classes_and_periods.sql
-- Academic structures: Classes and Lesson Periods

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Classes')
BEGIN
    CREATE TABLE Classes (
        code NVARCHAR(20) PRIMARY KEY, -- e.g. [A-Z0-9-]{1,20}
        campus NVARCHAR(10) NOT NULL, -- 'ARP', 'JJ', 'ARS'
        name NVARCHAR(100) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StaffClasses')
BEGIN
    CREATE TABLE StaffClasses (
        staffUserId NVARCHAR(128) NOT NULL,
        classCode NVARCHAR(20) NOT NULL,
        PRIMARY KEY (staffUserId, classCode),
        CONSTRAINT FK_StaffClasses_StaffUsers FOREIGN KEY (staffUserId) REFERENCES StaffUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_StaffClasses_Classes FOREIGN KEY (classCode) REFERENCES Classes(code) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentClasses')
BEGIN
    CREATE TABLE StudentClasses (
        studentUserId NVARCHAR(128) NOT NULL,
        classCode NVARCHAR(20) NOT NULL,
        PRIMARY KEY (studentUserId, classCode),
        CONSTRAINT FK_StudentClasses_StudentUsers FOREIGN KEY (studentUserId) REFERENCES StudentUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_StudentClasses_Classes FOREIGN KEY (classCode) REFERENCES Classes(code) ON DELETE CASCADE
    );
END;

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
