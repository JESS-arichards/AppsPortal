-- 003_distance_learning.sql
-- Distance Learning lessons and educational resources

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
        CONSTRAINT FK_DistanceLessons_Staff FOREIGN KEY (teacherUserId) REFERENCES StaffUsers(id)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DistanceLessonResources')
BEGIN
    CREATE TABLE DistanceLessonResources (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lessonId INT NOT NULL,
        label NVARCHAR(200) NOT NULL,
        url NVARCHAR(1000) NULL,
        fileData NVARCHAR(MAX) NULL, -- Base64 data URL
        fileName NVARCHAR(255) NULL,
        mimeType NVARCHAR(100) NULL,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_DistanceLessonResources_Lesson FOREIGN KEY (lessonId) REFERENCES DistanceLessons(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_DistanceLessonResources_LessonId ON DistanceLessonResources(lessonId, sortOrder);
END;
