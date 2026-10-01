import { memoryStore, isAzureSqlConnected } from './index.js';
import * as Types from './types.js';
import { SqlRepository } from './sqlRepository.js';
import { getWeekdaysBetween } from './dates.js';

/** In-memory data store used for local development and automated tests. */
export class MemoryRepository {
  // -------------------------------------------------------------
  // Users & Roles
  // -------------------------------------------------------------
  async getStaffById(id: string): Promise<Types.StaffUser | null> {
    const user = memoryStore.staffUsers.get(id);
    return user ? { ...user } : null;
  }

  async getStaffByEmail(email: string): Promise<Types.StaffUser | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of memoryStore.staffUsers.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async getStudentById(id: string): Promise<Types.StudentUser | null> {
    const user = memoryStore.studentUsers.get(id);
    return user ? { ...user } : null;
  }

  async getStudentByEmail(email: string): Promise<Types.StudentUser | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of memoryStore.studentUsers.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async getParentById(id: string): Promise<Types.ParentUser | null> {
    const user = memoryStore.parentUsers.get(id);
    if (!user) return null;
    const linked = await this.getParentStudents(id);
    return { ...user, linkedStudents: linked };
  }

  async getParentByEmail(email: string): Promise<Types.ParentUser | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of memoryStore.parentUsers.values()) {
      if (user.email.toLowerCase() === normalized) {
        const linked = await this.getParentStudents(user.id);
        return { ...user, linkedStudents: linked };
      }
    }
    return null;
  }

  async upsertStaffUser(userData: Partial<Types.StaffUser> & { id: string; email: string; displayName: string }): Promise<Types.StaffUser> {
    const existing = memoryStore.staffUsers.get(userData.id);
    const roles = existing?.roles ? [...new Set([...existing.roles, 'Staff'])] : ['Staff'];
    const updated: Types.StaffUser = {
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
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.staffUsers.set(updated.id, updated);
    return updated;
  }

  async upsertStudentUser(userData: Partial<Types.StudentUser> & { id: string; email: string; displayName: string }): Promise<Types.StudentUser> {
    const existing = memoryStore.studentUsers.get(userData.id);
    const updated: Types.StudentUser = {
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
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.studentUsers.set(updated.id, updated);
    // Resolve any pending parent links
    await this.resolvePendingParentLinksForStudent(updated.email, updated.id);
    return updated;
  }

  async createParentUser(userData: { email: string; displayName: string; forename?: string; surname?: string; studentEmail?: string }): Promise<Types.ParentUser> {
    const normalizedEmail = userData.email.toLowerCase().trim();
    if (await this.getParentByEmail(normalizedEmail)) {
      throw new Error('DUPLICATE_EMAIL');
    }

    const id = 'parent-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const parent: Types.ParentUser = {
      id,
      email: normalizedEmail,
      displayName: userData.displayName.trim(),
      forename: userData.forename?.trim() || null,
      surname: userData.surname?.trim() || null,
      authType: 'Local',
      division: 'Parent Community',
      profilePicture: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.parentUsers.set(id, parent);

    if (userData.studentEmail) {
      const student = await this.getStudentByEmail(userData.studentEmail);
      if (student) {
        await this.createParentStudentLink(id, student.id);
      } else {
        await this.createPendingParentLink(id, userData.studentEmail);
      }
    }

    return parent;
  }

  async updateStaffUser(id: string, updates: Partial<Types.StaffUser>): Promise<Types.StaffUser> {
    const staff = memoryStore.staffUsers.get(id);
    if (!staff) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== staff.email.toLowerCase()) {
      const existing = await this.getStaffByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const updated = {
      ...staff,
      ...updates,
      email: updates.email ? updates.email.toLowerCase().trim() : staff.email,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.staffUsers.set(id, updated);
    return updated;
  }

  async updateStudentUser(id: string, updates: Partial<Types.StudentUser>): Promise<Types.StudentUser> {
    const student = memoryStore.studentUsers.get(id);
    if (!student) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== student.email.toLowerCase()) {
      const existing = await this.getStudentByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const updated = {
      ...student,
      ...updates,
      email: updates.email ? updates.email.toLowerCase().trim() : student.email,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.studentUsers.set(id, updated);
    return updated;
  }

  async updateParentUser(id: string, updates: Partial<Types.ParentUser>): Promise<Types.ParentUser> {
    const parent = memoryStore.parentUsers.get(id);
    if (!parent) throw new Error('NOT_FOUND');
    if (updates.email && updates.email.toLowerCase().trim() !== parent.email.toLowerCase()) {
      const existing = await this.getParentByEmail(updates.email);
      if (existing && existing.id !== id) throw new Error('DUPLICATE_EMAIL');
    }
    const updated = {
      ...parent,
      ...updates,
      email: updates.email ? updates.email.toLowerCase().trim() : parent.email,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.parentUsers.set(id, updated);
    return updated;
  }

  async updateUserProfilePicture(type: 'Staff' | 'Student' | 'Parent', id: string, pictureDataUrl: string): Promise<string> {
    if (type === 'Staff') {
      const user = memoryStore.staffUsers.get(id);
      if (user) user.profilePicture = pictureDataUrl;
    } else if (type === 'Student') {
      const user = memoryStore.studentUsers.get(id);
      if (user) user.profilePicture = pictureDataUrl;
    } else if (type === 'Parent') {
      const user = memoryStore.parentUsers.get(id);
      if (user) user.profilePicture = pictureDataUrl;
    }
    return pictureDataUrl;
  }

  async getAllUsers() {
    return {
      staff: Array.from(memoryStore.staffUsers.values()),
      students: Array.from(memoryStore.studentUsers.values()),
      parents: Array.from(memoryStore.parentUsers.values()),
      classes: Array.from(memoryStore.classes.values()),
      availableRoles: ['Admin', 'Staff', 'Onboarding', 'Oasis'],
      availableSections: ['users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'],
    };
  }

  // -------------------------------------------------------------
  // Parent Login Codes
  // -------------------------------------------------------------
  async saveParentLoginCode(email: string, codeHash: string, expiresAt: Date): Promise<void> {
    memoryStore.parentLoginCodes.push({
      email: email.toLowerCase().trim(),
      codeHash,
      attempts: 0,
      expiresAt,
      usedAt: null,
    });
  }

  async getLatestParentLoginCode(email: string) {
    const normalized = email.toLowerCase().trim();
    const codes = memoryStore.parentLoginCodes
      .filter(c => c.email === normalized && !c.usedAt && c.expiresAt > new Date())
      .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime());
    return codes[0] || null;
  }

  async incrementParentLoginCodeAttempts(codeObj: any): Promise<void> {
    codeObj.attempts++;
  }

  async markParentLoginCodeUsed(codeObj: any): Promise<void> {
    codeObj.usedAt = new Date();
  }

  // -------------------------------------------------------------
  // Parent / Student Links
  // -------------------------------------------------------------
  async getParentStudents(parentId: string): Promise<Types.StudentUser[]> {
    const links = memoryStore.parentStudents.filter(l => l.parentId === parentId);
    const students: Types.StudentUser[] = [];
    for (const link of links) {
      const student = memoryStore.studentUsers.get(link.studentId);
      if (student) students.push(student);
    }
    return students;
  }

  async getAllParentLinks(): Promise<Array<{ parent: Types.ParentUser; student: Types.StudentUser }>> {
    const list: Array<{ parent: Types.ParentUser; student: Types.StudentUser }> = [];
    for (const link of memoryStore.parentStudents) {
      const parent = memoryStore.parentUsers.get(link.parentId);
      const student = memoryStore.studentUsers.get(link.studentId);
      if (parent && student) {
        list.push({ parent, student });
      }
    }
    return list;
  }

  async createParentStudentLink(parentId: string, studentId: string): Promise<void> {
    const exists = memoryStore.parentStudents.some(l => l.parentId === parentId && l.studentId === studentId);
    if (!exists) {
      memoryStore.parentStudents.push({ parentId, studentId });
    }
  }

  async deleteParentStudentLink(parentId: string, studentId: string): Promise<boolean> {
    const index = memoryStore.parentStudents.findIndex(l => l.parentId === parentId && l.studentId === studentId);
    if (index !== -1) {
      memoryStore.parentStudents.splice(index, 1);
      return true;
    }
    return false;
  }

  async createPendingParentLink(parentId: string, studentEmail: string): Promise<Types.PendingParentLink> {
    const normalizedEmail = studentEmail.toLowerCase().trim();
    for (const link of memoryStore.pendingParentLinks.values()) {
      if (link.parentId === parentId && link.studentEmail === normalizedEmail) {
        return link;
      }
    }
    const id = memoryStore.nextPendingLinkId++;
    const link: Types.PendingParentLink = {
      id,
      parentId,
      studentEmail: normalizedEmail,
      createdAt: new Date().toISOString(),
    };
    memoryStore.pendingParentLinks.set(id, link);
    return link;
  }

  async getPendingParentLinks(): Promise<Types.PendingParentLink[]> {
    const result: Types.PendingParentLink[] = [];
    for (const link of memoryStore.pendingParentLinks.values()) {
      const parent = memoryStore.parentUsers.get(link.parentId);
      result.push({
        ...link,
        parentName: parent?.displayName,
        parentEmail: parent?.email,
      });
    }
    return result;
  }

  async deletePendingParentLink(id: number): Promise<boolean> {
    return memoryStore.pendingParentLinks.delete(id);
  }

  async resolvePendingParentLinksForStudent(studentEmail: string, studentId: string): Promise<void> {
    const normalizedEmail = studentEmail.toLowerCase().trim();
    const toDelete: number[] = [];
    for (const [id, link] of memoryStore.pendingParentLinks.entries()) {
      if (link.studentEmail.toLowerCase() === normalizedEmail) {
        await this.createParentStudentLink(link.parentId, studentId);
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => memoryStore.pendingParentLinks.delete(id));
  }

  // -------------------------------------------------------------
  // Classes and Periods
  // -------------------------------------------------------------
  async getAllClasses(): Promise<Types.ClassEntity[]> {
    return Array.from(memoryStore.classes.values());
  }

  async upsertClass(code: string, campus: 'ARP' | 'JJ' | 'ARS', name?: string | null): Promise<Types.ClassEntity> {
    const cleanCode = code.toUpperCase().trim();
    const classEntity: Types.ClassEntity = {
      code: cleanCode,
      campus,
      name: name?.trim() || null,
      createdAt: new Date().toISOString(),
    };
    memoryStore.classes.set(cleanCode, classEntity);
    return classEntity;
  }

  async deleteClass(code: string): Promise<boolean> {
    const cleanCode = code.toUpperCase().trim();
    // Cascade remove from staff and student class lists
    for (const staff of memoryStore.staffUsers.values()) {
      if (staff.classes) {
        staff.classes = staff.classes.filter(c => c !== cleanCode);
      }
    }
    for (const student of memoryStore.studentUsers.values()) {
      if (student.classes) {
        student.classes = student.classes.filter(c => c !== cleanCode);
      }
    }
    return memoryStore.classes.delete(cleanCode);
  }

  async getAllPeriods(): Promise<Types.LessonPeriod[]> {
    return Array.from(memoryStore.lessonPeriods.values()).sort((a, b) => a.campus.localeCompare(b.campus) || a.weekday - b.weekday || a.sortOrder - b.sortOrder);
  }

  async getPeriodsForCampusAndWeekday(campus: string, weekday: number): Promise<Types.LessonPeriod[]> {
    return Array.from(memoryStore.lessonPeriods.values())
      .filter(p => p.campus === campus && p.weekday === weekday)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async upsertPeriod(period: Omit<Types.LessonPeriod, 'id'> & { id?: number }): Promise<Types.LessonPeriod> {
    const id = period.id && memoryStore.lessonPeriods.has(period.id) ? period.id : memoryStore.nextPeriodId++;
    const entity: Types.LessonPeriod = {
      id,
      campus: period.campus,
      weekday: period.weekday,
      periodName: period.periodName.trim(),
      startTime: period.startTime,
      endTime: period.endTime,
      sortOrder: period.sortOrder || 0,
      createdAt: new Date().toISOString(),
    };
    memoryStore.lessonPeriods.set(id, entity);
    return entity;
  }

  async deletePeriod(id: number): Promise<boolean> {
    return memoryStore.lessonPeriods.delete(id);
  }

  // -------------------------------------------------------------
  // Distance Learning
  // -------------------------------------------------------------
  async getDayLessons(classCode: string, date: string): Promise<Types.DistanceLesson[]> {
    const lessons: Types.DistanceLesson[] = [];
    for (const lesson of memoryStore.distanceLessons.values()) {
      if (lesson.classCode === classCode && lesson.date === date) {
        lessons.push(lesson);
      }
    }
    return lessons;
  }

  async upsertLesson(data: { classCode: string; date: string; periodId: number; title: string; description?: string | null; teacherUserId: string; resources: Types.DistanceLessonResource[] }): Promise<Types.DistanceLesson> {
    const key = `${data.classCode}_${data.date}_${data.periodId}`;
    const id = memoryStore.distanceLessons.get(key)?.id || Math.floor(Math.random() * 1000000);
    const lesson: Types.DistanceLesson = {
      id,
      classCode: data.classCode,
      date: data.date,
      periodId: data.periodId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      teacherUserId: data.teacherUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resources: data.resources.map((r, i) => ({
        ...r,
        id: i + 1,
        lessonId: id,
        sortOrder: i,
      })),
    };
    memoryStore.distanceLessons.set(key, lesson);
    return lesson;
  }

  async deleteLesson(classCode: string, date: string, periodId: number): Promise<boolean> {
    const key = `${classCode}_${date}_${periodId}`;
    return memoryStore.distanceLessons.delete(key);
  }

  // -------------------------------------------------------------
  // Parking & Absence
  // -------------------------------------------------------------
  async getParkingOverview(staffUserId: string) {
    const staff = memoryStore.staffUsers.get(staffUserId);
    const assignedSpace = staff?.parkingSpace ?? null;
    const authType = staff?.authType ?? 'Entra';

    const yourReleases: Types.ParkingRelease[] = [];
    const availableReleases: Types.ParkingRelease[] = [];
    const yourReservations: Types.ParkingRelease[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    for (const rel of memoryStore.parkingReleases.values()) {
      const owner = memoryStore.staffUsers.get(rel.ownerUserId);
      const reserver = rel.reserverUserId ? memoryStore.staffUsers.get(rel.reserverUserId) : null;
      const hydrated: Types.ParkingRelease = {
        ...rel,
        ownerName: owner?.displayName || 'Unknown',
        reserverName: reserver?.displayName || undefined,
      };

      if (rel.ownerUserId === staffUserId) {
        yourReleases.push(hydrated);
      } else if (!rel.reserverUserId && rel.date >= todayStr) {
        availableReleases.push(hydrated);
      }

      if (rel.reserverUserId === staffUserId) {
        yourReservations.push(hydrated);
      }
    }

    return {
      assignedSpace,
      authType,
      yourReleases: yourReleases.sort((a, b) => a.date.localeCompare(b.date)),
      availableReleases: availableReleases.sort((a, b) => a.date.localeCompare(b.date)),
      yourReservations: yourReservations.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getAllParkingReleases(): Promise<Types.ParkingRelease[]> {
    const list: Types.ParkingRelease[] = [];
    for (const rel of memoryStore.parkingReleases.values()) {
      const owner = memoryStore.staffUsers.get(rel.ownerUserId);
      const reserver = rel.reserverUserId ? memoryStore.staffUsers.get(rel.reserverUserId) : null;
      list.push({
        ...rel,
        ownerName: owner?.displayName || 'Unknown Staff',
        reserverName: reserver?.displayName || undefined,
      });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  async createParkingReleases(ownerUserId: string, space: number, dates: string[]): Promise<Types.ParkingRelease[]> {
    // Check for duplicate date releases by this owner
    for (const date of dates) {
      for (const existing of memoryStore.parkingReleases.values()) {
        if (existing.ownerUserId === ownerUserId && existing.date === date) {
          throw new Error(`OVERLAPPING_RELEASE:${date}`);
        }
      }
    }

    const created: Types.ParkingRelease[] = [];
    for (const date of dates) {
      const id = memoryStore.nextParkingId++;
      const release: Types.ParkingRelease = {
        id,
        ownerUserId,
        space,
        date,
        reserverUserId: null,
        reservedAt: null,
        createdAt: new Date().toISOString(),
      };
      memoryStore.parkingReleases.set(id, release);
      created.push(release);
    }
    return created;
  }

  async cancelParkingRelease(id: number, ownerUserId?: string): Promise<{ release: Types.ParkingRelease; reserverStaff?: Types.StaffUser | null }> {
    const rel = memoryStore.parkingReleases.get(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (ownerUserId && rel.ownerUserId !== ownerUserId) {
      throw new Error('FORBIDDEN');
    }
    let reserverStaff: Types.StaffUser | null = null;
    if (rel.reserverUserId) {
      reserverStaff = memoryStore.staffUsers.get(rel.reserverUserId) || null;
    }
    memoryStore.parkingReleases.delete(id);
    return { release: rel, reserverStaff };
  }

  async reserveParkingRelease(id: number, reserverUserId: string): Promise<Types.ParkingRelease> {
    const rel = memoryStore.parkingReleases.get(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (rel.ownerUserId === reserverUserId) throw new Error('CANNOT_RESERVE_OWN');
    if (rel.reserverUserId) throw new Error('ALREADY_RESERVED');

    const todayStr = new Date().toISOString().slice(0, 10);
    if (rel.date < todayStr) throw new Error('RELEASE_EXPIRED');

    rel.reserverUserId = reserverUserId;
    rel.reservedAt = new Date().toISOString();
    return rel;
  }

  async cancelParkingReservation(id: number, reserverUserId: string): Promise<Types.ParkingRelease> {
    const rel = memoryStore.parkingReleases.get(id);
    if (!rel) throw new Error('NOT_FOUND');
    if (rel.reserverUserId !== reserverUserId) throw new Error('FORBIDDEN');

    rel.reserverUserId = null;
    rel.reservedAt = null;
    return rel;
  }

  async getAbsenceOverview(staffUserId: string) {
    const staff = memoryStore.staffUsers.get(staffUserId);
    const requests = Array.from(memoryStore.absenceRequests.values())
      .filter(a => a.staffUserId === staffUserId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    return {
      assignedSpace: staff?.parkingSpace ?? null,
      requests,
    };
  }

  async createAbsenceRequest(staffUserId: string, startDate: string, endDate: string, reason: string, releaseSpace: boolean): Promise<Types.AbsenceRequest> {
    const staff = memoryStore.staffUsers.get(staffUserId);
    let parkingReleaseIdsStr: string | null = null;

    if (releaseSpace && staff?.parkingSpace && staff.parkingSpace !== 999) {
      // Calculate weekdays between startDate and endDate
      const weekdays = getWeekdaysBetween(startDate, endDate);
      if (weekdays.length > 0) {
        const createdReleases = await this.createParkingReleases(staffUserId, staff.parkingSpace, weekdays);
        parkingReleaseIdsStr = createdReleases.map(r => r.id).join(',');
      }
    }

    const id = memoryStore.nextAbsenceId++;
    const absence: Types.AbsenceRequest = {
      id,
      staffUserId,
      startDate,
      endDate,
      reason: reason.trim(),
      releasedSpace: releaseSpace && staff?.parkingSpace ? staff.parkingSpace : null,
      parkingReleaseIds: parkingReleaseIdsStr,
      createdAt: new Date().toISOString(),
    };
    memoryStore.absenceRequests.set(id, absence);
    return absence;
  }

  async cancelAbsenceRequest(id: number, staffUserId: string): Promise<boolean> {
    const absence = memoryStore.absenceRequests.get(id);
    if (!absence) throw new Error('NOT_FOUND');
    if (absence.staffUserId !== staffUserId) throw new Error('FORBIDDEN');

    // Delete associated unreserved parking releases
    if (absence.parkingReleaseIds) {
      const releaseIds = absence.parkingReleaseIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      for (const relId of releaseIds) {
        const rel = memoryStore.parkingReleases.get(relId);
        if (rel && !rel.reserverUserId) {
          memoryStore.parkingReleases.delete(relId);
        }
      }
    }

    memoryStore.absenceRequests.delete(id);
    return true;
  }

  // -------------------------------------------------------------
  // Streams
  // -------------------------------------------------------------
  async getActiveStreams(): Promise<Types.StreamItem[]> {
    return Array.from(memoryStore.streams.values())
      .filter(s => s.active)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async getAllStreams(): Promise<Types.StreamItem[]> {
    return Array.from(memoryStore.streams.values())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async upsertStream(data: Partial<Types.StreamItem> & { title: string; videoUrl: string; streamType: 'On Demand' | 'Live'; accessType: 'Free to Air' | 'Pay Per View'; categories: string }): Promise<Types.StreamItem> {
    const id = data.id && memoryStore.streams.has(data.id) ? data.id : memoryStore.nextStreamId++;
    const stream: Types.StreamItem = {
      id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      categories: data.categories || '',
      streamType: data.streamType,
      accessType: data.accessType,
      videoUrl: data.videoUrl.trim(),
      thumbnailUrl: data.thumbnailUrl || null,
      active: data.active !== undefined ? data.active : true,
      createdBy: data.createdBy || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.streams.set(id, stream);
    return stream;
  }

  async deleteStream(id: number): Promise<boolean> {
    return memoryStore.streams.delete(id);
  }

  // -------------------------------------------------------------
  // Branding & Content
  // -------------------------------------------------------------
  async getBranding(): Promise<Types.PortalBranding> {
    return { ...memoryStore.branding };
  }

  async updateBranding(data: Partial<Types.PortalBranding>): Promise<Types.PortalBranding> {
    memoryStore.branding = {
      ...memoryStore.branding,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return { ...memoryStore.branding };
  }

  async getHomeContent(): Promise<Types.PortalHomeContent> {
    return { ...memoryStore.homeContent };
  }

  async updateHomeContent(data: Partial<Types.PortalHomeContent>): Promise<Types.PortalHomeContent> {
    memoryStore.homeContent = {
      ...memoryStore.homeContent,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return { ...memoryStore.homeContent };
  }

  async getLoginContent(): Promise<Types.PortalLoginContent> {
    return { ...memoryStore.loginContent };
  }

  async updateLoginContent(data: Partial<Types.PortalLoginContent>): Promise<Types.PortalLoginContent> {
    memoryStore.loginContent = {
      ...memoryStore.loginContent,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return { ...memoryStore.loginContent };
  }

  // -------------------------------------------------------------
  // Impersonation Audit
  // -------------------------------------------------------------
  async logImpersonationAudit(entry: Omit<Types.ImpersonationAudit, 'id' | 'createdAt'>): Promise<void> {
    const audit: Types.ImpersonationAudit = {
      id: memoryStore.nextAuditId++,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    memoryStore.impersonationAudit.push(audit);
  }
}

export type RepositoryApi = { [K in keyof MemoryRepository]: MemoryRepository[K] };

const memoryRepository = new MemoryRepository();
// Typed as RepositoryApi so the compiler enforces that SqlRepository implements every method.
const sqlRepository: RepositoryApi = new SqlRepository();

/**
 * Routes every call to Azure SQL when a connection is active, otherwise to the
 * in-memory store. Resolved per call because the connection is established
 * after this module is first imported.
 */
export const repository: RepositoryApi = new Proxy({} as RepositoryApi, {
  get(_target, prop) {
    const active: any = isAzureSqlConnected() ? sqlRepository : memoryRepository;
    const value = active[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  },
});
