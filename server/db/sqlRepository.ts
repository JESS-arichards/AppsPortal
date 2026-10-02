import sql from 'mssql';
import { getPool } from './index.js';
import * as Types from './types.js';
import { getWeekdaysBetween } from './dates.js';

type Params = Record<string, unknown>;

function requirePool(): sql.ConnectionPool {
  const pool = getPool();
  if (!pool) throw new Error('Azure SQL connection is not available');
  return pool;
}

function bind(req: sql.Request, params: Params): sql.Request {
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      req.input(name, sql.NVarChar, null);
    } else if (typeof value === 'number') {
      req.input(name, Number.isInteger(value) ? sql.Int : sql.Float, value);
    } else if (typeof value === 'boolean') {
      req.input(name, sql.Bit, value);
    } else if (value instanceof Date) {
      req.input(name, sql.DateTime2, value);
    } else {
      const text = String(value);
      req.input(name, text.length > 4000 ? sql.NVarChar(sql.MAX) : sql.NVarChar(4000), text);
    }
  }
  return req;
}

function request(params: Params, tx?: sql.Transaction): sql.Request {
  return bind(tx ? new sql.Request(tx) : requirePool().request(), params);
}

async function query<T = any>(text: string, params: Params = {}, tx?: sql.Transaction): Promise<T[]> {
  const result = await request(params, tx).query(text);
  return (result.recordset || []) as T[];
}

async function execute(text: string, params: Params = {}, tx?: sql.Transaction): Promise<number> {
  const result = await request(params, tx).query(text);
  return result.rowsAffected.reduce((sum, n) => sum + n, 0);
}

async function queryMulti(text: string, params: Params = {}, tx?: sql.Transaction): Promise<any[][]> {
  const result = await request(params, tx).query(text);
  return (result.recordsets as unknown as any[][]) || [];
}

async function inTransaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const tx = new sql.Transaction(requirePool());
  await tx.begin();
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw err;
  }
}

function isUniqueViolation(err: any): boolean {
  return err?.number === 2627 || err?.number === 2601;
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  return value == null ? undefined : String(value);
}

function isoOrNull(value: unknown): string | null {
  return iso(value) ?? null;
}

function groupBy(rows: any[], key: string, valueKey: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row[key]) || [];
    list.push(row[valueKey]);
    map.set(row[key], list);
  }
  return map;
}

function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const RELEASE_SELECT = `
  SELECT r.id, r.ownerUserId, r.space, r.[date], r.reserverUserId, r.reservedAt, r.absenceRequestId, r.createdAt,
         o.displayName AS ownerName, v.displayName AS reserverName
  FROM ParkingReleases r
  LEFT JOIN Users o ON o.id = r.ownerUserId
  LEFT JOIN Users v ON v.id = r.reserverUserId`;

const BRANDING_COLUMNS = ['mainColor', 'accentColor', 'textColor', 'navBgColor', 'navTextColor', 'heroBgColor', 'heroTextColor', 'navLogo', 'favicon'];
const HOME_COLUMNS = ['heroLabel', 'heroHeadline', 'heroIntro', 'heroImage', 'heroImageAlt', 'captionName', 'captionRole', 'welcomeLabel', 'welcomeHeading', 'welcomeMessage'];
const LOGIN_COLUMNS = ['welcomeHeadline', 'valuesJson', 'signInHeading', 'signInIntro', 'staffChoiceTitle', 'staffChoiceDescription', 'parentChoiceTitle', 'parentChoiceDescription', 'parentEmailLabel', 'parentCodeLabel', 'sendCodeLabel', 'verifyCodeLabel', 'resendCodeLabel', 'helpPrompt', 'helpLinkText'];

type UserType = 'Staff' | 'Student' | 'Parent';

interface LoadedUsers {
  rows: any[];
  roles: Map<string, string[]>;
  classes: Map<string, string[]>;
  sections: Map<string, string[]>;
}

/** Azure SQL implementation of the repository. Mirrors MemoryRepository behaviour. */
export class SqlRepository {
  // -------------------------------------------------------------
  // Row mappers & loaders
  // -------------------------------------------------------------
  private mapStaff(r: any, roles: string[], classes: string[], sections: string[]): Types.StaffUser {
    return {
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      forename: r.forename ?? null,
      surname: r.surname ?? null,
      authType: r.authType === 'Local' ? 'Local' : 'Entra',
      jobTitle: r.jobTitle ?? null,
      division: r.division ?? null,
      department: r.department ?? null,
      profilePicture: r.profilePicture ?? null,
      parkingSpace: r.parkingSpace ?? null,
      extension: r.extension ?? null,
      misId: r.misId ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      roles,
      classes,
      adminSections: sections,
    };
  }

  private mapStudent(r: any, classes: string[]): Types.StudentUser {
    return {
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      forename: r.forename ?? null,
      surname: r.surname ?? null,
      authType: 'Entra',
      division: r.division ?? null,
      department: r.department ?? null,
      profilePicture: r.profilePicture ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      classes,
    };
  }

  private mapParent(r: any): Types.ParentUser {
    return {
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      forename: r.forename ?? null,
      surname: r.surname ?? null,
      authType: 'Local',
      division: r.division ?? null,
      profilePicture: r.profilePicture ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  }

  private mapRelease(r: any, unknownOwner = 'Unknown'): Types.ParkingRelease {
    return {
      id: r.id,
      ownerUserId: r.ownerUserId,
      space: r.space,
      date: r.date,
      reserverUserId: r.reserverUserId ?? null,
      reservedAt: isoOrNull(r.reservedAt),
      absenceRequestId: r.absenceRequestId ?? null,
      createdAt: iso(r.createdAt),
      ownerName: r.ownerName || unknownOwner,
      reserverName: r.reserverName || undefined,
    };
  }

  private mapStream(r: any): Types.StreamItem {
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      categories: r.categories ?? '',
      streamType: r.streamType,
      accessType: r.accessType,
      videoUrl: r.videoUrl,
      thumbnailUrl: r.thumbnailUrl ?? null,
      active: !!r.active,
      createdBy: r.createdBy ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  }

  private mapAbsence(r: any): Types.AbsenceRequest {
    return {
      id: r.id,
      staffUserId: r.staffUserId,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason,
      releasedSpace: r.releasedSpace ?? null,
      createdAt: iso(r.createdAt),
    };
  }

  /**
   * Loads users of one type plus their roles/classes/admin sections in a single round trip.
   * `filter` is a SQL predicate over the Users table (e.g. 'id = @id').
   */
  private async loadUsers(userType: UserType, filter: string, params: Params = {}, tx?: sql.Transaction): Promise<LoadedUsers> {
    const extras = userType === 'Staff'
      ? `SELECT r.userId, r.[role] FROM UserRoles r JOIN @ids i ON i.id = r.userId;
         SELECT c.userId, c.classCode FROM UserClasses c JOIN @ids i ON i.id = c.userId;
         SELECT s.userId, s.section FROM UserAdminSections s JOIN @ids i ON i.id = s.userId;`
      : userType === 'Student'
        ? 'SELECT c.userId, c.classCode FROM UserClasses c JOIN @ids i ON i.id = c.userId;'
        : '';
    const sets = await queryMulti(`
      DECLARE @ids TABLE (id NVARCHAR(128) PRIMARY KEY);
      INSERT INTO @ids (id) SELECT id FROM Users WHERE userType = @userType AND (${filter});
      SELECT u.* FROM Users u JOIN @ids i ON i.id = u.id ORDER BY u.displayName;
      ${extras}`, { ...params, userType }, tx);
    const rows = sets[0] || [];
    const empty = new Map<string, string[]>();
    if (userType === 'Staff') {
      return {
        rows,
        roles: groupBy(sets[1] || [], 'userId', 'role'),
        classes: groupBy(sets[2] || [], 'userId', 'classCode'),
        sections: groupBy(sets[3] || [], 'userId', 'section'),
      };
    }
    return { rows, roles: empty, classes: userType === 'Student' ? groupBy(sets[1] || [], 'userId', 'classCode') : empty, sections: empty };
  }

  private async loadStaff(filter: string, params: Params = {}, tx?: sql.Transaction): Promise<Types.StaffUser[]> {
    const { rows, roles, classes, sections } = await this.loadUsers('Staff', filter, params, tx);
    return rows.map(r => this.mapStaff(r, roles.get(r.id) || [], classes.get(r.id) || [], sections.get(r.id) || []));
  }

  private async loadStudents(filter: string, params: Params = {}, tx?: sql.Transaction): Promise<Types.StudentUser[]> {
    const { rows, classes } = await this.loadUsers('Student', filter, params, tx);
    return rows.map(r => this.mapStudent(r, classes.get(r.id) || []));
  }

  private async loadParents(filter: string, params: Params = {}, tx?: sql.Transaction): Promise<Types.ParentUser[]> {
    const { rows } = await this.loadUsers('Parent', filter, params, tx);
    return rows.map(r => this.mapParent(r));
  }

  /** Inserts or updates the Users row and replaces the given membership lists. */
  private async saveUser(
    userType: UserType,
    u: { id: string; email: string; displayName: string; forename?: string | null; surname?: string | null; authType: string; jobTitle?: string | null; division?: string | null; department?: string | null; profilePicture?: string | null; parkingSpace?: number | null; extension?: number | null; misId?: string | null },
    lists: { roles?: string[]; classes?: string[]; sections?: string[] },
    tx: sql.Transaction,
  ): Promise<void> {
    const params: Params = {
      id: u.id, userType, email: u.email, displayName: u.displayName, forename: u.forename ?? null, surname: u.surname ?? null,
      authType: u.authType, jobTitle: u.jobTitle ?? null, division: u.division ?? null, department: u.department ?? null,
      profilePicture: u.profilePicture ?? null, parkingSpace: u.parkingSpace ?? null, extension: u.extension ?? null, misId: u.misId ?? null,
      roles: JSON.stringify(lists.roles || []), classes: JSON.stringify(lists.classes || []), sections: JSON.stringify(lists.sections || []),
    };
    const statements = [`
      IF EXISTS (SELECT 1 FROM Users WHERE id = @id)
        UPDATE Users SET email = @email, displayName = @displayName, forename = @forename, surname = @surname,
          authType = @authType, jobTitle = @jobTitle, division = @division, department = @department,
          profilePicture = @profilePicture, parkingSpace = @parkingSpace, extension = @extension, misId = @misId, updatedAt = SYSUTCDATETIME()
        WHERE id = @id AND userType = @userType;
      ELSE
        INSERT INTO Users (id, userType, email, displayName, forename, surname, authType, jobTitle, division, department, profilePicture, parkingSpace, extension, misId)
        VALUES (@id, @userType, @email, @displayName, @forename, @surname, @authType, @jobTitle, @division, @department, @profilePicture, @parkingSpace, @extension, @misId);`];
    if (lists.roles) {
      statements.push(`
        DELETE FROM UserRoles WHERE userId = @id;
        INSERT INTO UserRoles (userId, [role]) SELECT DISTINCT @id, value FROM OPENJSON(@roles);`);
    }
    if (lists.classes) {
      statements.push(`
        DELETE FROM UserClasses WHERE userId = @id;
        INSERT INTO UserClasses (userId, classCode)
          SELECT DISTINCT @id, c.code FROM Classes c WHERE c.code IN (SELECT value FROM OPENJSON(@classes));`);
    }
    if (lists.sections) {
      statements.push(`
        DELETE FROM UserAdminSections WHERE userId = @id;
        INSERT INTO UserAdminSections (userId, section) SELECT DISTINCT @id, value FROM OPENJSON(@sections);`);
    }
    await execute(statements.join('\n'), params, tx);
  }

  private saveStaff(u: Types.StaffUser, tx: sql.Transaction): Promise<void> {
    return this.saveUser('Staff', u, { roles: u.roles || [], classes: u.classes || [], sections: u.adminSections || [] }, tx);
  }

  private saveStudent(u: Types.StudentUser, tx: sql.Transaction): Promise<void> {
    return this.saveUser('Student', u, { classes: u.classes || [] }, tx);
  }

  // -------------------------------------------------------------
  // Users & Roles
  // -------------------------------------------------------------
  async getStaffById(id: string): Promise<Types.StaffUser | null> {
    return (await this.loadStaff('id = @id', { id }))[0] || null;
  }

  async getStaffByEmail(email: string): Promise<Types.StaffUser | null> {
    return (await this.loadStaff('email = @email', { email: email.toLowerCase().trim() }))[0] || null;
  }

  async getStudentById(id: string): Promise<Types.StudentUser | null> {
    return (await this.loadStudents('id = @id', { id }))[0] || null;
  }

  async getStudentByEmail(email: string): Promise<Types.StudentUser | null> {
    return (await this.loadStudents('email = @email', { email: email.toLowerCase().trim() }))[0] || null;
  }

  async getParentById(id: string): Promise<Types.ParentUser | null> {
    const parent = (await this.loadParents('id = @id', { id }))[0];
    if (!parent) return null;
    return { ...parent, linkedStudents: await this.getParentStudents(id) };
  }

  async getParentByEmail(email: string): Promise<Types.ParentUser | null> {
    const parent = (await this.loadParents('email = @email', { email: email.toLowerCase().trim() }))[0];
    if (!parent) return null;
    return { ...parent, linkedStudents: await this.getParentStudents(parent.id) };
  }

  async upsertStaffUser(userData: Partial<Types.StaffUser> & { id: string; email: string; displayName: string }): Promise<Types.StaffUser> {
    const existing = await this.getStaffById(userData.id);
    const roles = existing?.roles?.length ? [...new Set([...existing.roles, 'Staff'])] : ['Staff'];
    const merged: Types.StaffUser = {
      id: userData.id,
      email: userData.email.toLowerCase().trim(),
      displayName: userData.displayName,
      forename: userData.forename ?? existing?.forename ?? null,
      surname: userData.surname ?? existing?.surname ?? null,
      authType: userData.authType ?? existing?.authType ?? 'Entra',
      jobTitle: userData.jobTitle ?? existing?.jobTitle ?? null,
      division: userData.division ?? existing?.division ?? null,
      department: userData.department ?? existing?.department ?? null,
      profilePicture: userData.profilePicture ?? existing?.profilePicture ?? null,
      parkingSpace: userData.parkingSpace ?? existing?.parkingSpace ?? null,
      extension: userData.extension ?? existing?.extension ?? null,
      misId: userData.misId ?? existing?.misId ?? null,
      roles: userData.roles ?? roles,
      classes: userData.classes ?? existing?.classes ?? [],
      adminSections: userData.adminSections ?? existing?.adminSections ?? [],
    };
    await inTransaction(tx => this.saveStaff(merged, tx));
    return (await this.getStaffById(merged.id))!;
  }

  async upsertStudentUser(userData: Partial<Types.StudentUser> & { id: string; email: string; displayName: string }): Promise<Types.StudentUser> {
    const existing = await this.getStudentById(userData.id);
    const merged: Types.StudentUser = {
      id: userData.id,
      email: userData.email.toLowerCase().trim(),
      displayName: userData.displayName,
      forename: userData.forename ?? existing?.forename ?? null,
      surname: userData.surname ?? existing?.surname ?? null,
      authType: 'Entra',
      division: userData.division ?? existing?.division ?? null,
      department: userData.department ?? existing?.department ?? 'Student',
      profilePicture: userData.profilePicture ?? existing?.profilePicture ?? null,
      classes: userData.classes ?? existing?.classes ?? [],
    };
    await inTransaction(tx => this.saveStudent(merged, tx));
    await this.resolvePendingParentLinksForStudent(merged.email, merged.id);
    return (await this.getStudentById(merged.id))!;
  }

  async createParentUser(userData: { email: string; displayName: string; forename?: string; surname?: string; studentEmail?: string }): Promise<Types.ParentUser> {
    const normalizedEmail = userData.email.toLowerCase().trim();
    if (await this.getParentByEmail(normalizedEmail)) {
      throw new Error('DUPLICATE_EMAIL');
    }

    const id = 'parent-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    try {
      await execute(`
        INSERT INTO Users (id, userType, email, displayName, forename, surname, authType, division)
        VALUES (@id, 'Parent', @email, @displayName, @forename, @surname, 'Local', 'Parent Community')`, {
        id,
        email: normalizedEmail,
        displayName: userData.displayName.trim(),
        forename: userData.forename?.trim() || null,
        surname: userData.surname?.trim() || null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('DUPLICATE_EMAIL');
      throw err;
    }

    if (userData.studentEmail) {
      const student = await this.getStudentByEmail(userData.studentEmail);
      if (student) {
        await this.createParentStudentLink(id, student.id);
      } else {
        await this.createPendingParentLink(id, userData.studentEmail);
      }
    }

    return (await this.loadParents('id = @id', { id }))[0];
  }

  async updateStaffUser(id: string, updates: Partial<Types.StaffUser>): Promise<Types.StaffUser> {
    const staff = await this.getStaffById(id);
    if (!staff) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== staff.email.toLowerCase()) {
      const existing = await this.getStaffByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const merged: Types.StaffUser = {
      ...staff,
      ...withoutUndefined(updates),
      id,
      email: updates.email ? updates.email.toLowerCase().trim() : staff.email,
    };
    try {
      await inTransaction(tx => this.saveStaff(merged, tx));
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('DUPLICATE_EMAIL');
      throw err;
    }
    return (await this.getStaffById(id))!;
  }

  async updateStudentUser(id: string, updates: Partial<Types.StudentUser>): Promise<Types.StudentUser> {
    const student = await this.getStudentById(id);
    if (!student) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== student.email.toLowerCase()) {
      const existing = await this.getStudentByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const merged: Types.StudentUser = {
      ...student,
      ...withoutUndefined(updates),
      id,
      authType: 'Entra',
      email: updates.email ? updates.email.toLowerCase().trim() : student.email,
    };
    try {
      await inTransaction(tx => this.saveStudent(merged, tx));
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('DUPLICATE_EMAIL');
      throw err;
    }
    return (await this.getStudentById(id))!;
  }

  async updateParentUser(id: string, updates: Partial<Types.ParentUser>): Promise<Types.ParentUser> {
    const parent = (await this.loadParents('id = @id', { id }))[0];
    if (!parent) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== parent.email.toLowerCase()) {
      const existing = await this.getParentByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const merged = { ...parent, ...withoutUndefined(updates), email: updates.email ? updates.email.toLowerCase().trim() : parent.email };
    try {
      await execute(`
        UPDATE Users SET email = @email, displayName = @displayName, forename = @forename, surname = @surname,
          division = @division, profilePicture = @profilePicture, updatedAt = SYSUTCDATETIME()
        WHERE id = @id AND userType = 'Parent'`, {
        id,
        email: merged.email,
        displayName: merged.displayName,
        forename: merged.forename ?? null,
        surname: merged.surname ?? null,
        division: merged.division ?? null,
        profilePicture: merged.profilePicture ?? null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('DUPLICATE_EMAIL');
      throw err;
    }
    return (await this.loadParents('id = @id', { id }))[0];
  }

  async updateUserProfilePicture(type: 'Staff' | 'Student' | 'Parent', id: string, pictureDataUrl: string): Promise<string> {
    await execute('UPDATE Users SET profilePicture = @picture, updatedAt = SYSUTCDATETIME() WHERE id = @id AND userType = @type', { id, type, picture: pictureDataUrl });
    return pictureDataUrl;
  }

  async getAllUsers() {
    const [staff, students, parents, classes] = await Promise.all([
      this.loadStaff('1 = 1'),
      this.loadStudents('1 = 1'),
      this.loadParents('1 = 1'),
      this.getAllClasses(),
    ]);
    return {
      staff,
      students,
      parents,
      classes,
      availableRoles: ['Admin', 'Staff', 'Onboarding', 'Oasis'],
      availableSections: ['users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'],
    };
  }

  // -------------------------------------------------------------
  // Parent Login Codes
  // -------------------------------------------------------------
  async saveParentLoginCode(email: string, codeHash: string, expiresAt: Date): Promise<void> {
    // Issuing a new code supersedes older ones for the address; expired codes are purged on the way.
    await execute(`
      DELETE FROM ParentLoginCodes WHERE email = @email OR expiresAt < SYSUTCDATETIME();
      INSERT INTO ParentLoginCodes (email, codeHash, expiresAt) VALUES (@email, @codeHash, @expiresAt);`, {
      email: email.toLowerCase().trim(),
      codeHash,
      expiresAt,
    });
  }

  async getLatestParentLoginCode(email: string) {
    const rows = await query(`
      SELECT TOP 1 id, email, codeHash, attempts, expiresAt, usedAt FROM ParentLoginCodes
      WHERE email = @email AND usedAt IS NULL AND expiresAt > SYSUTCDATETIME()
      ORDER BY expiresAt DESC`, { email: email.toLowerCase().trim() });
    return rows[0] || null;
  }

  async incrementParentLoginCodeAttempts(codeObj: any): Promise<void> {
    await execute('UPDATE ParentLoginCodes SET attempts = attempts + 1 WHERE id = @id', { id: codeObj.id });
    codeObj.attempts++;
  }

  async markParentLoginCodeUsed(codeObj: any): Promise<void> {
    await execute('UPDATE ParentLoginCodes SET usedAt = SYSUTCDATETIME() WHERE id = @id', { id: codeObj.id });
    codeObj.usedAt = new Date();
  }

  // -------------------------------------------------------------
  // Parent / Student Links
  // -------------------------------------------------------------
  async getParentStudents(parentId: string): Promise<Types.StudentUser[]> {
    return this.loadStudents('id IN (SELECT studentId FROM ParentStudents WHERE parentId = @parentId)', { parentId });
  }

  async getAllParentLinks(): Promise<Array<{ parent: Types.ParentUser; student: Types.StudentUser }>> {
    const links = await query('SELECT parentId, studentId FROM ParentStudents ORDER BY createdAt');
    if (!links.length) return [];
    const parents = new Map((await this.loadParents('id IN (SELECT parentId FROM ParentStudents)')).map(p => [p.id, p]));
    const students = new Map((await this.loadStudents('id IN (SELECT studentId FROM ParentStudents)')).map(s => [s.id, s]));
    const list: Array<{ parent: Types.ParentUser; student: Types.StudentUser }> = [];
    for (const link of links) {
      const parent = parents.get(link.parentId);
      const student = students.get(link.studentId);
      if (parent && student) list.push({ parent, student });
    }
    return list;
  }

  async createParentStudentLink(parentId: string, studentId: string): Promise<void> {
    await execute(`
      IF NOT EXISTS (SELECT 1 FROM ParentStudents WHERE parentId = @parentId AND studentId = @studentId)
        INSERT INTO ParentStudents (parentId, studentId) VALUES (@parentId, @studentId)`, { parentId, studentId });
  }

  async deleteParentStudentLink(parentId: string, studentId: string): Promise<boolean> {
    return (await execute('DELETE FROM ParentStudents WHERE parentId = @parentId AND studentId = @studentId', { parentId, studentId })) > 0;
  }

  async createPendingParentLink(parentId: string, studentEmail: string): Promise<Types.PendingParentLink> {
    const normalizedEmail = studentEmail.toLowerCase().trim();
    const map = (r: any): Types.PendingParentLink => ({ id: r.id, parentId: r.parentId, studentEmail: r.studentEmail, createdAt: iso(r.createdAt)! });
    const existing = await query('SELECT * FROM PendingParentStudentLinks WHERE parentId = @parentId AND studentEmail = @email', { parentId, email: normalizedEmail });
    if (existing[0]) return map(existing[0]);
    const inserted = await query(`
      INSERT INTO PendingParentStudentLinks (parentId, studentEmail)
      OUTPUT INSERTED.* VALUES (@parentId, @email)`, { parentId, email: normalizedEmail });
    return map(inserted[0]);
  }

  async getPendingParentLinks(): Promise<Types.PendingParentLink[]> {
    const rows = await query(`
      SELECT p.id, p.parentId, p.studentEmail, p.createdAt, u.displayName AS parentName, u.email AS parentEmail
      FROM PendingParentStudentLinks p LEFT JOIN Users u ON u.id = p.parentId
      ORDER BY p.createdAt`);
    return rows.map(r => ({
      id: r.id,
      parentId: r.parentId,
      studentEmail: r.studentEmail,
      createdAt: iso(r.createdAt)!,
      parentName: r.parentName ?? undefined,
      parentEmail: r.parentEmail ?? undefined,
    }));
  }

  async deletePendingParentLink(id: number): Promise<boolean> {
    return (await execute('DELETE FROM PendingParentStudentLinks WHERE id = @id', { id })) > 0;
  }

  async resolvePendingParentLinksForStudent(studentEmail: string, studentId: string): Promise<void> {
    const email = studentEmail.toLowerCase().trim();
    await inTransaction(async tx => {
      await execute(`
        INSERT INTO ParentStudents (parentId, studentId)
        SELECT DISTINCT p.parentId, @studentId FROM PendingParentStudentLinks p
        WHERE p.studentEmail = @email
          AND NOT EXISTS (SELECT 1 FROM ParentStudents ps WHERE ps.parentId = p.parentId AND ps.studentId = @studentId);
        DELETE FROM PendingParentStudentLinks WHERE studentEmail = @email;`, { email, studentId }, tx);
    });
  }

  // -------------------------------------------------------------
  // Classes and Periods
  // -------------------------------------------------------------
  async getAllClasses(): Promise<Types.ClassEntity[]> {
    const rows = await query('SELECT code, campus, name, createdAt FROM Classes ORDER BY code');
    return rows.map(r => ({ code: r.code, campus: r.campus, name: r.name ?? null, createdAt: iso(r.createdAt) }));
  }

  async upsertClass(code: string, campus: 'ARP' | 'JJ' | 'ARS', name?: string | null): Promise<Types.ClassEntity> {
    const cleanCode = code.toUpperCase().trim();
    const rows = await query(`
      IF EXISTS (SELECT 1 FROM Classes WHERE code = @code)
        UPDATE Classes SET campus = @campus, name = @name WHERE code = @code;
      ELSE
        INSERT INTO Classes (code, campus, name) VALUES (@code, @campus, @name);
      SELECT code, campus, name, createdAt FROM Classes WHERE code = @code;`,
      { code: cleanCode, campus, name: name?.trim() || null });
    const r = rows[0];
    return { code: r.code, campus: r.campus, name: r.name ?? null, createdAt: iso(r.createdAt) };
  }

  async deleteClass(code: string): Promise<boolean> {
    return (await execute('DELETE FROM Classes WHERE code = @code', { code: code.toUpperCase().trim() })) > 0;
  }

  private mapPeriod(r: any): Types.LessonPeriod {
    return {
      id: r.id,
      campus: r.campus,
      weekday: r.weekday,
      periodName: r.periodName,
      startTime: r.startTime,
      endTime: r.endTime,
      sortOrder: r.sortOrder,
      createdAt: iso(r.createdAt),
    };
  }

  async getAllPeriods(): Promise<Types.LessonPeriod[]> {
    const rows = await query('SELECT * FROM LessonPeriods ORDER BY campus, weekday, sortOrder');
    return rows.map(r => this.mapPeriod(r));
  }

  async getPeriodsForCampusAndWeekday(campus: string, weekday: number): Promise<Types.LessonPeriod[]> {
    const rows = await query('SELECT * FROM LessonPeriods WHERE campus = @campus AND weekday = @weekday ORDER BY sortOrder', { campus, weekday });
    return rows.map(r => this.mapPeriod(r));
  }

  async upsertPeriod(period: Omit<Types.LessonPeriod, 'id'> & { id?: number }): Promise<Types.LessonPeriod> {
    const params = {
      id: period.id ?? null,
      campus: period.campus,
      weekday: period.weekday,
      periodName: period.periodName.trim(),
      startTime: period.startTime,
      endTime: period.endTime,
      sortOrder: period.sortOrder || 0,
    };
    if (period.id) {
      const updated = await query(`
        UPDATE LessonPeriods SET campus = @campus, weekday = @weekday, periodName = @periodName,
          startTime = @startTime, endTime = @endTime, sortOrder = @sortOrder
        OUTPUT INSERTED.* WHERE id = @id`, params);
      if (updated[0]) return this.mapPeriod(updated[0]);
    }
    const inserted = await query(`
      INSERT INTO LessonPeriods (campus, weekday, periodName, startTime, endTime, sortOrder)
      OUTPUT INSERTED.* VALUES (@campus, @weekday, @periodName, @startTime, @endTime, @sortOrder)`, params);
    return this.mapPeriod(inserted[0]);
  }

  async deletePeriod(id: number): Promise<boolean> {
    return (await execute('DELETE FROM LessonPeriods WHERE id = @id', { id })) > 0;
  }

  // -------------------------------------------------------------
  // Distance Learning
  // -------------------------------------------------------------
  async getDayLessons(classCode: string, date: string): Promise<Types.DistanceLesson[]> {
    const lessons = await query('SELECT * FROM DistanceLessons WHERE classCode = @classCode AND [date] = @date', { classCode, date });
    if (!lessons.length) return [];
    const resources = await query(`
      SELECT * FROM DistanceLessonResources
      WHERE lessonId IN (SELECT id FROM DistanceLessons WHERE classCode = @classCode AND [date] = @date)
      ORDER BY lessonId, sortOrder`, { classCode, date });
    return lessons.map(l => ({
      id: l.id,
      classCode: l.classCode,
      date: l.date,
      periodId: l.periodId,
      title: l.title,
      description: l.description ?? null,
      teacherUserId: l.teacherUserId,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
      resources: resources.filter(r => r.lessonId === l.id).map(r => ({
        id: r.id,
        lessonId: r.lessonId,
        label: r.label,
        url: r.url ?? null,
        fileData: r.fileData ?? null,
        fileName: r.fileName ?? null,
        mimeType: r.mimeType ?? null,
        sortOrder: r.sortOrder,
      })),
    }));
  }

  async upsertLesson(data: { classCode: string; date: string; periodId: number; title: string; description?: string | null; teacherUserId: string; resources: Types.DistanceLessonResource[] }): Promise<Types.DistanceLesson> {
    const params = {
      classCode: data.classCode,
      date: data.date,
      periodId: data.periodId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      teacherUserId: data.teacherUserId,
    };
    await inTransaction(async tx => {
      const existing = await query('SELECT id FROM DistanceLessons WHERE classCode = @classCode AND [date] = @date AND periodId = @periodId', params, tx);
      let lessonId: number;
      if (existing[0]) {
        lessonId = existing[0].id;
        await execute(`
          UPDATE DistanceLessons SET title = @title, description = @description, teacherUserId = @teacherUserId, updatedAt = SYSUTCDATETIME()
          WHERE id = @lessonId`, { ...params, lessonId }, tx);
        await execute('DELETE FROM DistanceLessonResources WHERE lessonId = @lessonId', { lessonId }, tx);
      } else {
        const inserted = await query(`
          INSERT INTO DistanceLessons (classCode, [date], periodId, title, description, teacherUserId)
          OUTPUT INSERTED.id VALUES (@classCode, @date, @periodId, @title, @description, @teacherUserId)`, params, tx);
        lessonId = inserted[0].id;
      }
      for (let i = 0; i < data.resources.length; i++) {
        const r = data.resources[i];
        await execute(`
          INSERT INTO DistanceLessonResources (lessonId, label, url, fileData, fileName, mimeType, sortOrder)
          VALUES (@lessonId, @label, @url, @fileData, @fileName, @mimeType, @sortOrder)`, {
          lessonId,
          label: r.label,
          url: r.url ?? null,
          fileData: r.fileData ?? null,
          fileName: r.fileName ?? null,
          mimeType: r.mimeType ?? null,
          sortOrder: i,
        }, tx);
      }
    });
    const lessons = await this.getDayLessons(data.classCode, data.date);
    return lessons.find(l => l.periodId === data.periodId)!;
  }

  async deleteLesson(classCode: string, date: string, periodId: number): Promise<boolean> {
    return (await execute('DELETE FROM DistanceLessons WHERE classCode = @classCode AND [date] = @date AND periodId = @periodId', { classCode, date, periodId })) > 0;
  }

  // -------------------------------------------------------------
  // Parking & Absence
  // -------------------------------------------------------------
  private async getRelease(id: number, tx?: sql.Transaction): Promise<Types.ParkingRelease | null> {
    const rows = await query(`${RELEASE_SELECT} WHERE r.id = @id`, { id }, tx);
    return rows[0] ? this.mapRelease(rows[0]) : null;
  }

  async getParkingOverview(staffUserId: string) {
    const staff = await this.getStaffById(staffUserId);
    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = await query(`${RELEASE_SELECT}
      WHERE r.ownerUserId = @userId OR r.reserverUserId = @userId OR (r.reserverUserId IS NULL AND r.[date] >= @today)
      ORDER BY r.[date]`, { userId: staffUserId, today: todayStr });

    const yourReleases: Types.ParkingRelease[] = [];
    const availableReleases: Types.ParkingRelease[] = [];
    const yourReservations: Types.ParkingRelease[] = [];
    for (const row of rows) {
      const rel = this.mapRelease(row);
      if (rel.ownerUserId === staffUserId) {
        yourReleases.push(rel);
      } else if (!rel.reserverUserId && rel.date >= todayStr) {
        availableReleases.push(rel);
      }
      if (rel.reserverUserId === staffUserId) {
        yourReservations.push(rel);
      }
    }

    return {
      assignedSpace: staff?.parkingSpace ?? null,
      authType: staff?.authType ?? 'Entra',
      yourReleases,
      availableReleases,
      yourReservations,
    };
  }

  async getAllParkingReleases(): Promise<Types.ParkingRelease[]> {
    const rows = await query(`${RELEASE_SELECT} ORDER BY r.[date]`);
    return rows.map(r => this.mapRelease(r, 'Unknown Staff'));
  }

  async createParkingReleases(ownerUserId: string, space: number, dates: string[], absenceRequestId: number | null = null, tx?: sql.Transaction): Promise<Types.ParkingRelease[]> {
    const work = async (t: sql.Transaction) => {
      const overlap = await query(`
        SELECT TOP 1 [date] FROM ParkingReleases
        WHERE ownerUserId = @ownerUserId AND [date] IN (SELECT value FROM OPENJSON(@dates))
        ORDER BY [date]`, { ownerUserId, dates: JSON.stringify(dates) }, t);
      if (overlap[0]) throw new Error(`OVERLAPPING_RELEASE:${overlap[0].date}`);

      const inserted = await query(`
        INSERT INTO ParkingReleases (ownerUserId, space, [date], absenceRequestId)
        OUTPUT INSERTED.*
        SELECT DISTINCT @ownerUserId, @space, value, @absenceRequestId FROM OPENJSON(@dates)`,
        { ownerUserId, space, dates: JSON.stringify(dates), absenceRequestId }, t);
      return inserted
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => ({
          id: r.id,
          ownerUserId: r.ownerUserId,
          space: r.space,
          date: r.date,
          reserverUserId: null,
          reservedAt: null,
          absenceRequestId: r.absenceRequestId ?? null,
          createdAt: iso(r.createdAt),
        }));
    };
    return tx ? work(tx) : inTransaction(work);
  }

  async cancelParkingRelease(id: number, ownerUserId?: string): Promise<{ release: Types.ParkingRelease; reserverStaff?: Types.StaffUser | null }> {
    const rel = await this.getRelease(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (ownerUserId && rel.ownerUserId !== ownerUserId) {
      throw new Error('FORBIDDEN');
    }
    const reserverStaff = rel.reserverUserId ? await this.getStaffById(rel.reserverUserId) : null;
    await execute('DELETE FROM ParkingReleases WHERE id = @id', { id });
    return { release: rel, reserverStaff };
  }

  async reserveParkingRelease(id: number, reserverUserId: string): Promise<Types.ParkingRelease> {
    const rel = await this.getRelease(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (rel.ownerUserId === reserverUserId) throw new Error('CANNOT_RESERVE_OWN');
    if (rel.reserverUserId) throw new Error('ALREADY_RESERVED');

    const todayStr = new Date().toISOString().slice(0, 10);
    if (rel.date < todayStr) throw new Error('RELEASE_EXPIRED');

    // Guard against two staff reserving the same space concurrently.
    const affected = await execute(`
      UPDATE ParkingReleases SET reserverUserId = @reserverUserId, reservedAt = SYSUTCDATETIME()
      WHERE id = @id AND reserverUserId IS NULL`, { id, reserverUserId });
    if (affected === 0) throw new Error('ALREADY_RESERVED');
    return (await this.getRelease(id))!;
  }

  async cancelParkingReservation(id: number, reserverUserId: string): Promise<Types.ParkingRelease> {
    const rel = await this.getRelease(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (rel.reserverUserId !== reserverUserId) throw new Error('FORBIDDEN');

    await execute('UPDATE ParkingReleases SET reserverUserId = NULL, reservedAt = NULL WHERE id = @id', { id });
    return (await this.getRelease(id))!;
  }

  async getAbsenceOverview(staffUserId: string) {
    const staff = await this.getStaffById(staffUserId);
    const rows = await query('SELECT * FROM AbsenceRequests WHERE staffUserId = @staffUserId ORDER BY startDate DESC', { staffUserId });
    return {
      assignedSpace: staff?.parkingSpace ?? null,
      requests: rows.map(r => this.mapAbsence(r)),
    };
  }

  async createAbsenceRequest(staffUserId: string, startDate: string, endDate: string, reason: string, releaseSpace: boolean): Promise<Types.AbsenceRequest> {
    const staff = await this.getStaffById(staffUserId);
    const space = releaseSpace && staff?.parkingSpace ? staff.parkingSpace : null;
    return inTransaction(async tx => {
      const inserted = await query(`
        INSERT INTO AbsenceRequests (staffUserId, startDate, endDate, reason, releasedSpace)
        OUTPUT INSERTED.* VALUES (@staffUserId, @startDate, @endDate, @reason, @releasedSpace)`, {
        staffUserId,
        startDate,
        endDate,
        reason: reason.trim(),
        releasedSpace: space,
      }, tx);
      const absence = this.mapAbsence(inserted[0]);
      if (space && space !== 999) {
        const weekdays = getWeekdaysBetween(startDate, endDate);
        if (weekdays.length > 0) {
          await this.createParkingReleases(staffUserId, space, weekdays, absence.id, tx);
        }
      }
      return absence;
    });
  }

  async cancelAbsenceRequest(id: number, staffUserId: string): Promise<boolean> {
    const rows = await query('SELECT id, staffUserId FROM AbsenceRequests WHERE id = @id', { id });
    const absence = rows[0];
    if (!absence) throw new Error('NOT_FOUND');
    if (absence.staffUserId !== staffUserId) throw new Error('FORBIDDEN');

    // Unreserved releases are withdrawn; reserved ones stay with their reserver (detached from the absence).
    await inTransaction(tx => execute(`
      DELETE FROM ParkingReleases WHERE absenceRequestId = @id AND reserverUserId IS NULL;
      UPDATE ParkingReleases SET absenceRequestId = NULL WHERE absenceRequestId = @id;
      DELETE FROM AbsenceRequests WHERE id = @id;`, { id }, tx));
    return true;
  }
  // -------------------------------------------------------------
  // Streams
  // -------------------------------------------------------------
  async getActiveStreams(): Promise<Types.StreamItem[]> {
    const rows = await query('SELECT * FROM Streams WHERE active = 1 ORDER BY createdAt DESC');
    return rows.map(r => this.mapStream(r));
  }

  async getAllStreams(): Promise<Types.StreamItem[]> {
    const rows = await query('SELECT * FROM Streams ORDER BY createdAt DESC');
    return rows.map(r => this.mapStream(r));
  }

  async upsertStream(data: Partial<Types.StreamItem> & { title: string; videoUrl: string; streamType: 'On Demand' | 'Live'; accessType: 'Free to Air' | 'Pay Per View'; categories: string }): Promise<Types.StreamItem> {
    const params = {
      id: data.id ?? null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      categories: data.categories || '',
      streamType: data.streamType,
      accessType: data.accessType,
      videoUrl: data.videoUrl.trim(),
      thumbnailUrl: data.thumbnailUrl || null,
      active: data.active !== undefined ? !!data.active : true,
      createdBy: data.createdBy || null,
    };
    if (data.id) {
      const updated = await query(`
        UPDATE Streams SET title = @title, description = @description, categories = @categories, streamType = @streamType,
          accessType = @accessType, videoUrl = @videoUrl, thumbnailUrl = @thumbnailUrl, active = @active,
          createdBy = COALESCE(@createdBy, createdBy), updatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.* WHERE id = @id`, params);
      if (updated[0]) return this.mapStream(updated[0]);
    }
    const inserted = await query(`
      INSERT INTO Streams (title, description, categories, streamType, accessType, videoUrl, thumbnailUrl, active, createdBy)
      OUTPUT INSERTED.* VALUES (@title, @description, @categories, @streamType, @accessType, @videoUrl, @thumbnailUrl, @active, @createdBy)`, params);
    return this.mapStream(inserted[0]);
  }

  async deleteStream(id: number): Promise<boolean> {
    return (await execute('DELETE FROM Streams WHERE id = @id', { id })) > 0;
  }

  // -------------------------------------------------------------
  // Branding & Content (single-row tables, id = 1)
  // -------------------------------------------------------------
  private async getSingleton<T>(table: string, columns: string[]): Promise<T> {
    let rows = await query(`SELECT * FROM ${table} WHERE id = 1`);
    if (!rows[0]) {
      // schema.sql seeds the row; column defaults supply the values if it was deleted since.
      rows = await query(`
        IF NOT EXISTS (SELECT 1 FROM ${table} WHERE id = 1) INSERT INTO ${table} (id) VALUES (1);
        SELECT * FROM ${table} WHERE id = 1;`);
    }
    const r = rows[0];
    const result: any = { id: 1, updatedAt: iso(r.updatedAt) };
    for (const col of columns) result[col] = r[col] ?? null;
    return result as T;
  }

  private async updateSingleton<T>(table: string, columns: string[], data: Record<string, unknown>): Promise<T> {
    const provided = columns.filter(c => data[c] !== undefined);
    if (provided.length) {
      const params: Params = {};
      for (const c of provided) params[c] = data[c];
      await execute(`
        IF NOT EXISTS (SELECT 1 FROM ${table} WHERE id = 1) INSERT INTO ${table} (id) VALUES (1);
        UPDATE ${table} SET ${provided.map(c => `${c} = @${c}`).join(', ')}, updatedAt = SYSUTCDATETIME() WHERE id = 1;`, params);
    }
    return this.getSingleton<T>(table, columns);
  }

  async getBranding(): Promise<Types.PortalBranding> {
    return this.getSingleton<Types.PortalBranding>('PortalBranding', BRANDING_COLUMNS);
  }

  async updateBranding(data: Partial<Types.PortalBranding>): Promise<Types.PortalBranding> {
    return this.updateSingleton<Types.PortalBranding>('PortalBranding', BRANDING_COLUMNS, data);
  }

  async getHomeContent(): Promise<Types.PortalHomeContent> {
    return this.getSingleton<Types.PortalHomeContent>('PortalHomeContent', HOME_COLUMNS);
  }

  async updateHomeContent(data: Partial<Types.PortalHomeContent>): Promise<Types.PortalHomeContent> {
    return this.updateSingleton<Types.PortalHomeContent>('PortalHomeContent', HOME_COLUMNS, data);
  }

  async getLoginContent(): Promise<Types.PortalLoginContent> {
    return this.getSingleton<Types.PortalLoginContent>('PortalLoginContent', LOGIN_COLUMNS);
  }

  async updateLoginContent(data: Partial<Types.PortalLoginContent>): Promise<Types.PortalLoginContent> {
    return this.updateSingleton<Types.PortalLoginContent>('PortalLoginContent', LOGIN_COLUMNS, data);
  }

  // -------------------------------------------------------------
  // Impersonation Audit
  // -------------------------------------------------------------
  async logImpersonationAudit(entry: Omit<Types.ImpersonationAudit, 'id' | 'createdAt'>): Promise<void> {
    await execute(`
      INSERT INTO AdminImpersonationAudit (sessionId, actorUserId, actorEmail, targetUserId, targetEmail, targetType, mode, eventType, method, path, details)
      VALUES (@sessionId, @actorUserId, @actorEmail, @targetUserId, @targetEmail, @targetType, @mode, @eventType, @method, @path, @details)`, {
      sessionId: entry.sessionId,
      actorUserId: entry.actorUserId,
      actorEmail: entry.actorEmail,
      targetUserId: entry.targetUserId,
      targetEmail: entry.targetEmail,
      targetType: entry.targetType,
      mode: entry.mode,
      eventType: entry.eventType,
      method: entry.method ?? null,
      path: entry.path ?? null,
      details: entry.details ?? null,
    });
  }
}
