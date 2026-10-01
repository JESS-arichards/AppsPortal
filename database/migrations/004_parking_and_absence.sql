-- 004_parking_and_absence.sql
-- Parking releases and staff absence requests

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ParkingReleases')
BEGIN
    CREATE TABLE ParkingReleases (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ownerUserId NVARCHAR(128) NOT NULL,
        space INT NOT NULL,
        date NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        reserverUserId NVARCHAR(128) NULL,
        reservedAt DATETIME2 NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ParkingReleases_Owner FOREIGN KEY (ownerUserId) REFERENCES StaffUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_ParkingReleases_Reserver FOREIGN KEY (reserverUserId) REFERENCES StaffUsers(id)
    );
    CREATE INDEX IX_ParkingReleases_Date ON ParkingReleases(date);
    CREATE INDEX IX_ParkingReleases_Owner_Date ON ParkingReleases(ownerUserId, date);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AbsenceRequests')
BEGIN
    CREATE TABLE AbsenceRequests (
        id INT IDENTITY(1,1) PRIMARY KEY,
        staffUserId NVARCHAR(128) NOT NULL,
        startDate NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        endDate NVARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
        reason NVARCHAR(1000) NOT NULL,
        releasedSpace INT NULL,
        parkingReleaseIds NVARCHAR(500) NULL, -- comma-separated list of release IDs
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AbsenceRequests_Staff FOREIGN KEY (staffUserId) REFERENCES StaffUsers(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_AbsenceRequests_Staff_Dates ON AbsenceRequests(staffUserId, startDate, endDate);
END;
