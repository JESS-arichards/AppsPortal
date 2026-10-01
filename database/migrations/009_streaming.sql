-- 009_streaming.sql
-- Streaming video catalogue (Live and On Demand)

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
        thumbnailUrl NVARCHAR(MAX) NULL, -- external URL or base64 data URL
        active BIT NOT NULL DEFAULT 1,
        createdBy NVARCHAR(128) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Streams_Active_Type ON Streams(active, streamType);
END;
