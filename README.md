# JESS Dubai Community Portal Applications

An enterprise-class digital community portal designed and engineered for Jumeirah English Speaking School (JESS Dubai). Built strictly in accordance with the enterprise functional specification, providing single sign-on with Microsoft Entra ID (staff & students), passwordless email verification (parents), dynamic institutional branding with WCAG 2.1 AA accessibility compliance, distance learning orchestration, staff parking pool management, absence reporting, live/on-demand video streaming, and secure administrative impersonation with immutable audit logging.

---

## Table of Contents
1. [Executive Architectural Assessment & Technology Justification](#1-executive-architectural-assessment--technology-justification)
2. [Solution Architecture & System Topology](#2-solution-architecture--system-topology)
3. [Azure Web App & Infrastructure Deployment Guide](#3-azure-web-app--infrastructure-deployment-guide)
4. [Azure SQL Database Setup & Migrations](#4-azure-sql-database-setup--migrations)
5. [Comprehensive Environment Variables Specification](#5-comprehensive-environment-variables-specification)
6. [Next Steps: Image Assets & Media Placeholder Replacement](#6-next-steps-image-assets--media-placeholder-replacement)
7. [Enterprise Security & Impersonation Framework](#7-enterprise-security--impersonation-framework)
8. [Local Development & Validation](#8-local-development--validation)

---

## 1. Executive Architectural Assessment & Technology Justification

As requested, an architectural assessment was conducted evaluating **React with TypeScript** against modern enterprise alternatives for this specific educational portal:

### Architectural Comparison Matrix

| Evaluation Dimension | React + TypeScript (Vite + Node/Express) [Selected] | Next.js (App Router / SSR) | Remix / React Router v7 | Angular (v18+) | ASP.NET Core Blazor (Server/Wasm) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication Model** | Clean decoupled MSAL browser PKCE flow + signed secure HttpOnly cookie backend | Complex edge/server cookie sync across Server Components and client | Good action/loader cookie handling, moderate cognitive load | Heavy boilerplate for MSAL Angular interop | Good Azure integration, but WebSockets state overhead for Blazor Server |
| **Dynamic Institutional Re-branding** | Real-time CSS Custom Properties injected at runtime into root DOM from `/api/branding` | SSR hydration mismatch risks when dynamic CSS variables vary per tenant/school | Supports loader styling; requires layout cache invalidation | NgStyle/CSS variable injection works but requires custom RxJS stream | Requires component lifecycle re-rendering |
| **Azure Web App Hosting Compatibility** | Lightweight, high-throughput Node.js container with single port (static SPA + REST API) | Requires dedicated Node.js server with standalone output tuning or Azure Static Web Apps | Node.js adapter or container required | Single static build or reverse proxy | Requires .NET runtime container or Azure App Service Windows/.NET stack |
| **Impersonation Safety (Write-blocking)** | Express middleware strictly blocks POST/PUT/DELETE in "view" mode and verifies signatures | Requires middleware interception across all Route Handlers & Server Actions | Intercepts loaders/actions cleanly | Interceptor-based client guard + API controller filter | C# ActionFilters; state leakage risks on Blazor Server circuits |
| **Client Bundle & Startup Latency** | Optimized Vite tree-shaking; fast initial cold-start on Azure Linux App Service B1/P1v3 | Cold-start penalty on serverless/App Service for dynamically compiled lambdas | Moderate cold-start | Heavier initial runtime payload | Large initial WebAssembly download or circuit latency |

### Architect's Recommendation & Rationale

**Selected Architecture: Single-Artifact React 18 + TypeScript SPA with Node/Express REST Backend.**
1. **Unified Enterprise Deployment:** Serving both the production-built React SPA and the REST API from a single Node.js runtime process eliminates cross-origin resource sharing (CORS) complexity, prevents split-routing overhead, and allows seamless deployment to a single Azure Web App service plan.
2. **Deterministic Branding & Accessibility:** Real-time school color adjustments require strict adherence to WCAG 2.1 AA (minimum 4.5:1 contrast). React's reactive virtual DOM coupled with CSS custom property variables on `:root` allows instant visual updates without page reload or SSR hydration mismatches.
3. **Decoupled Security Boundary:** Combining `@azure/msal-browser` authorization code flow with PKCE for Entra ID, combined with server-side HMAC-SHA256 signed session cookies, provides defense-in-depth against token exfiltration (XSS cannot extract HttpOnly cookies).

---

## 2. Solution Architecture & System Topology

```
                  ┌────────────────────────────────────────────────────────┐
                  │                    Azure Traffic                       │
                  └──────────────────────────┬─────────────────────────────┘
                                             │ HTTPS
                                             ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 Azure App Service                      │
                  │   ┌────────────────────────────────────────────────┐   │
                  │   │        Node.js Express Unified Process         │   │
                  │   │                                                │   │
                  │   │   [Static SPA]                [REST API]       │   │
                  │   │   /index.html                 /api/auth        │   │
                  │   │   /assets/*.js                /api/admin       │   │
                  │   │   /assets/*.css               /api/parking     │   │
                  │   │   /portal-config.js           /api/distance    │   │
                  │   │                               /api/absence     │   │
                  │   │                               /api/streaming   │   │
                  │   └───────────────────────┬────────────────────────┘   │
                  └───────────────────────────┼────────────────────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
                     ▼                        ▼                        ▼
       ┌────────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
       │   Azure SQL Database   │  │ Microsoft Entra ID  │  │ Microsoft Graph API │
       │  (Connection Pool /    │  │  (Tenant JWKS Token │  │  (Parent OTP Emails │
       │   Managed Identity)    │  │     Validation)     │  │   & Teams Alerts)   │
       └────────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 3. Azure Web App & Infrastructure Deployment Guide

### Prerequisites
- Azure Subscription with Contributor rights on target Resource Group.
- Azure App Service Plan (Standard S1 or Premium P1v3 recommended for SLA and staging slots).
- Azure SQL Database (General Purpose Serverless or Provisioned tier).
- Azure Entra ID App Registration.

### Step-by-Step Deployment
1. **Create the Azure App Service (Linux Node 20 LTS):**
   ```bash
   az group create --name rg-jess-portal --location uae-north
   az appservice plan create --name plan-jess-portal --resource-group rg-jess-portal --sku B1 --is-linux
   az webapp create --name app-jess-portal --resource-group rg-jess-portal --plan plan-jess-portal --runtime "NODE:20-lts"
   ```

2. **Configure App Service Startup Command:**
   Under **App Service > Configuration > General Settings > Startup Command**:
   ```bash
   node dist-server/server/index.js
   ```

3. **Deploy the Build Artifacts:**
   Run the production build:
   ```bash
   npm run build
   ```
   Deploy the compiled payload (`dist/`, `dist-server/`, `database/`, `package.json`, and `public/`) via GitHub Actions or Azure CLI:
   ```bash
   az webapp deploy --resource-group rg-jess-portal --name app-jess-portal --src-path release.zip --type zip
   ```

---

## 4. Azure SQL Database Setup & Migrations

The database layer provides a single consolidated SQL definition in [`database/schema.sql`](/D:/GitHub/PortalApplications/database/schema.sql) as well as modular migration scripts in `database/migrations/`.

### Single Consolidated Database Query
To establish the entire schema in Azure SQL (or SQL Server Management Studio / Azure Data Studio / Azure Portal Query Editor), execute the consolidated script:
- [`database/schema.sql`](/D:/GitHub/PortalApplications/database/schema.sql)

This single query creates all core tables, relationships, foreign keys, clustered & non-clustered indexes, single-row singleton check constraints, and seed content in correct topological dependency order:
1. `__SchemaMigrations` (Migration history & deployment tracking)
2. `StaffUsers`, `StudentUsers`, `ParentUsers` (Root user identity entities)
3. `StaffUserRoles`, `ParentLoginCodes`, `ParentStudents`, `PendingParentStudentLinks` (Security, linking & OTP verification)
4. `Classes`, `StaffClasses`, `StudentClasses`, `LessonPeriods` (Academic schedule & timetable structures)
5. `DistanceLessons`, `DistanceLessonResources` (Distance learning orchestration)
6. `ParkingReleases`, `AbsenceRequests` (Staff parking pool allocation & absence reporting)
7. `Streams` (Live and on-demand video streaming catalogue)
8. `PortalBranding`, `PortalHomeContent`, `PortalLoginContent` (Institution branding with WCAG contrast and home/login CMS)
9. `StaffAdminTabPermissions`, `AdminImpersonationAudit` (Delegated administration & immutable impersonation logging)

### Migration Runner
Run database migrations using the TypeScript migration runner, which automatically applies the consolidated schema:
Run database migrations using TypeScript migration runner:
```bash
# Execute migrations against target Azure SQL database
npm run db:migrate
```

### Dual-Mode Database Architecture
The database layer (`server/db/index.ts`, `server/db/repository.ts`, `server/db/sqlRepository.ts`) runs in one of two modes:
- **Azure SQL Mode (deployed environments):** When `AZURE_SQL_CONNECTION_STRING` (or `SQL_CONNECTION_STRING`, or the individual `AZURE_SQL_SERVER`/`AZURE_SQL_DATABASE`/`AZURE_SQL_USER`/`AZURE_SQL_PASSWORD` settings) is provided, **all data** (users, roles, classes, lessons, parking, absence, streams, branding, home/login content, impersonation audit) is read from and written to Azure SQL via parameterized queries. On startup the server connects with retry logic and applies `database/schema.sql` (idempotent), so missing tables are created automatically. If SQL is configured but unreachable, the server **fails to start** rather than silently falling back to memory.
- **In-Memory Mode (local development/tests only):** When no SQL connection is configured, the application uses an in-memory repository pre-seeded with demo staff, student and parent accounts, campus lesson periods and mock streams. Nothing is persisted, and demo accounts never exist in SQL.

### First Administrator
A new SQL database has no administrators. Set `INITIAL_ADMIN_EMAILS` to one or more staff emails; when those users sign in with Entra they are granted the `Admin` role (stored in `StaffUserRoles`). Roles are never removed by this setting, so it can be cleared once an admin exists.

---

## 5. Comprehensive Environment Variables Specification

The following variables must be configured in Azure App Service under **Settings > Configuration > Application settings**:

| Variable Name | Required | Default / Example | Purpose & Description | Azure Portal Setting Key |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Optional | `3000` | Port for the Express server process. Azure App Service automatically routes requests to this port. | `PORT` |
| `NODE_ENV` | Optional | `production` | Environment mode (`development` or `production`). Enables production asset optimization and secure cookie flags. | `NODE_ENV` |
| `AZURE_SQL_CONNECTION_STRING` | Recommended | `Server=tcp:sql-jess.database.windows.net,1433;Database=sqldb-portal;User ID=sqladmin;Password=...;Encrypt=true;` | Full ADO.NET / mssql connection string for Azure SQL Database. | `AZURE_SQL_CONNECTION_STRING` |
| `AZURE_SQL_SERVER` | Optional | `sql-jess.database.windows.net` | Azure SQL Server FQDN (used if individual credentials are preferred over connection string). | `AZURE_SQL_SERVER` |
| `AZURE_SQL_DATABASE` | Optional | `sqldb-portal` | Azure SQL Database catalog name. | `AZURE_SQL_DATABASE` |
| `AZURE_SQL_USER` | Optional | `portal_db_user` | Database user login. | `AZURE_SQL_USER` |
| `AZURE_SQL_PASSWORD` | Optional | `***` | Secure password for database user login. | `AZURE_SQL_PASSWORD` |
| `INITIAL_ADMIN_EMAILS` | Recommended (first deploy) | `a.richards@jess.sch.ae` | Comma-separated staff emails granted the `Admin` role on Entra sign-in. Needed to create the first administrator in a new database. | `INITIAL_ADMIN_EMAILS` |
| `SESSION_SECRET` | **Mandatory** | *(Generate a 64-char random hex)* | Key used to compute HMAC-SHA256 signatures for cookies and impersonation tokens. | `SESSION_SECRET` |
| `ENTRA_CLIENT_ID` | **Mandatory** | `00000000-0000-0000-0000-000000000000` | Application (Client) ID from Microsoft Entra ID App Registration. Exposed safely to client via `/portal-config.js`. | `ENTRA_CLIENT_ID` |
| `ENTRA_TENANT_ID` | **Mandatory** | `00000000-0000-0000-0000-000000000000` | Directory (Tenant) ID for JESS Dubai in Microsoft Entra. | `ENTRA_TENANT_ID` |
| `ENTRA_CLIENT_SECRET` | Optional | `***` | Entra App Registration client secret for server-to-server Microsoft Graph API token acquisition. | `ENTRA_CLIENT_SECRET` |
| `ENTRA_REDIRECT_URI` | Optional | `https://portal.jess.sch.ae/` | Configured redirect URI registered in Microsoft Entra ID authentication blades. | `ENTRA_REDIRECT_URI` |
| `GRAPH_MAIL_SENDER` | Optional | `portal-noreply@jess.sch.ae` | Dedicated mailbox / service account used to dispatch parent 6-digit verification codes via Graph API. | `GRAPH_MAIL_SENDER` |
| `BLOB_STORAGE_CONNECTION_STRING`| Optional | `DefaultEndpointsProtocol=https;AccountName=...` | Azure Blob Storage connection string for user avatars and branding media assets. | `BLOB_STORAGE_CONNECTION_STRING` |
| `BLOB_STORAGE_CONTAINER` | Optional | `portal-assets` | Target Blob container name for static images. | `BLOB_STORAGE_CONTAINER` |

---

## 6. Next Steps: Image Assets & Media Placeholder Replacement

The application currently contains placeholder assets in `public/` that must be replaced before production rollout:

### Asset Inventory & Technical Requirements

| Placeholder Asset | Current Location | Recommended Dimensions | Format | Specification / Guidelines | Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Site Logo** | `public/Site_Logo.png` | 400 × 120 px | SVG or 32-bit PNG (transparent) | Primary school crest / insignia. Must maintain high visual contrast when rendered on dark navy (`#002B49`). | Replace with official JESS Dubai vector mark. Upload through Admin Console > Branding, or replace in `public/`. |
| **Home Hero Image** | `public/Default_Home_Page_Image.png` | 1920 × 600 px | WebP or JPG (compressed < 350KB) | Panoramic campus photo (e.g. Arabian Ranches or Jumeirah campus) with soft lighting and natural contrast. | Replace with approved school photography. Ensure background overlay allows hero text readability. |
| **Avatar Placeholder** | `public/avatar-placeholder.png` | 256 × 256 px | PNG / SVG (circle cropped) | Neutral silhouette or geometric fallback for users without Microsoft Graph profile pictures. | Update with school-branded monogram or brand silhouette. |
| **Favicon** | `public/favicon.ico` | 32 × 32 px & 64 × 64 px | ICO or SVG | Multi-resolution icon for browser tabs and mobile bookmarking. | Replace with official school crest favicon. |

### Production Cloud Media Architecture
For production scale on Azure Web Apps:
1. **Azure Blob Storage Integration:** Store branding uploads and user avatar overrides in an Azure Blob Storage container (`portal-assets`) with Public Blob Read permissions.
2. **Azure Front Door / CDN:** Place an Azure Front Door or Azure CDN endpoint in front of the blob container for low-latency Edge caching across the UAE and international users.

---

## 7. Enterprise Security & Impersonation Framework

The application implements enterprise security controls in strict accordance with the functional specification:

### 1. Entra ID Single Sign-On (Staff & Students)
- Uses Microsoft Authentication Library (MSAL) v3 with PKCE authorization code flow.
- Verified on the backend via Microsoft Entra JWKS keys (`https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`).

### 2. Passwordless Parent Authentication
- Parents authenticate using their registered personal email address.
- A cryptographically random 6-digit verification code is generated, hashed with SHA-256 before storage in `ParentLoginCodes`, and dispatched via Microsoft Graph API.
- Rate limiting: Maximum 5 verification attempts per code; expires strictly after 10 minutes.

### 3. Order-Independent Parent Linking
- When administrators link a parent to a student email before the student's initial sign-in, the link is held in `PendingParentStudentLinks`.
- Upon the student's initial SSO sync, the system automatically resolves and materializes the link into `ParentStudents`.

### 4. Admin Impersonation & Audit Trail
- System Administrators can impersonate any Staff, Student, or Parent user.
- **View Mode:** The administrator can browse the portal exactly as the target user. All state-mutating requests (`POST`, `PUT`, `DELETE`) are strictly blocked by middleware with `HTTP 403 Forbidden` and audited to `AdminImpersonationAudit`.
- **Test Mode:** Permitted write actions are executed with the actor administrator's identity permanently recorded in the audit log.
- **Security Lockout:** Access to all administrative sections (`/portal/admin`) is blocked during active impersonation to prevent privilege escalation.
- **Visual Alerting:** A persistent, high-visibility warning banner is affixed across the viewport header with an instant **"Exit Impersonation"** control.

### 5. Automated WCAG 2.1 AA Contrast Enforcement
- Administrators modifying institutional brand colors are constrained by an automated contrast engine (`server/services/contrast.ts`).
- Navigation and hero text combinations must satisfy a minimum luminance contrast ratio of **4.5:1** before changes can be persisted.

---

## 8. Local Development & Validation

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Running Locally
```bash
# 1. Install dependencies
npm install

# 2. Run unit and integration tests
npm test

# 3. Build client and server
npm run build

# 4. Start local development server (with hot reload)
npm run dev

# 5. Access portal in browser
# Open: http://localhost:3000
```

### Pre-seeded Development Personas
When running in local fallback mode (no Azure SQL required), sign in using the following test personas:
- **Administrator:** `admin@jess.sch.ae` (Full administrative privileges, impersonation console)
- **Teaching Staff:** `teacher@jess.sch.ae` (Parking space #45, timetable, distance learning, absence reporting)
- **Student:** `alex.smith@student.jess.sch.ae` (Year 10 timetable, distance learning resources)
- **Parent:** `parent.smith@example.com` (Parent OTP verification code logged in terminal console)
