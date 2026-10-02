-- ============================================================================
-- Drops every portal table (current and legacy names) so schema.sql can
-- rebuild an empty database. ALL DATA IS LOST. Development use only.
-- Run with `npm run db:reset`, or paste into the Azure portal query editor
-- and then run schema.sql.
-- ============================================================================
DECLARE @tables TABLE (name SYSNAME PRIMARY KEY);
INSERT INTO @tables (name) VALUES
    -- current schema
    ('Users'), ('UserRoles'), ('UserAdminSections'), ('UserClasses'),
    ('ParentLoginCodes'), ('ParentStudents'), ('PendingParentStudentLinks'),
    ('Classes'), ('LessonPeriods'), ('DistanceLessons'), ('DistanceLessonResources'),
    ('AbsenceRequests'), ('ParkingReleases'), ('Streams'),
    ('PortalBranding'), ('PortalHomeContent'), ('PortalLoginContent'),
    ('AdminImpersonationAudit'),
    -- legacy (pre-consolidation) schema
    ('__SchemaMigrations'), ('StaffUsers'), ('StudentUsers'), ('ParentUsers'),
    ('StaffUserRoles'), ('StaffClasses'), ('StudentClasses'), ('StaffAdminTabPermissions');

DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + N'.'
    + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN (SELECT name FROM @tables)
   OR OBJECT_NAME(fk.referenced_object_id) IN (SELECT name FROM @tables);
EXEC sp_executesql @sql;

SET @sql = N'';
SELECT @sql += N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';'
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name IN (SELECT name FROM @tables);
EXEC sp_executesql @sql;
GO
