import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CareerGoalRow, CareerRole, CompleteBody, CourseBody, CourseCategory, CourseDetail, CourseListItem, Enrollment, EnrollmentFilter,
  LearningSummary, Lookups, PersonGrowth, Skill, SkillBody, SkillMatrix
} from './learning.models';

/** Gateway: /learning/{x} → Employee API /api/learning/{x} */
@Injectable({ providedIn: 'root' })
export class LearningService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/learning`;

  summary(): Observable<LearningSummary> {
    return this.http.get<LearningSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  // ───── Courses ─────
  courses(category: CourseCategory | '' = '', search = '', includeInactive = false): Observable<CourseListItem[]> {
    let p = new HttpParams();
    if (category) p = p.set('category', category);
    if (search.trim()) p = p.set('search', search.trim());
    if (includeInactive) p = p.set('includeInactive', true);
    return this.http.get<CourseListItem[]>(`${this.base}/courses`, { params: p });
  }

  course(id: string): Observable<CourseDetail> {
    return this.http.get<CourseDetail>(`${this.base}/courses/${id}`);
  }

  createCourse(body: CourseBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/courses`, body).pipe(map(r => r.id));
  }

  updateCourse(id: string, body: CourseBody): Observable<void> {
    return this.http.put<void>(`${this.base}/courses/${id}`, body);
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/courses/${id}`);
  }

  enrol(id: string): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/courses/${id}/enrol`, {}).pipe(map(r => r.id));
  }

  assign(id: string, employeeIds: string[], dueOn: string | null): Observable<{ assigned: number; skipped: number }> {
    return this.http.post<{ assigned: number; skipped: number }>(`${this.base}/courses/${id}/assign`, { employeeIds, dueOn });
  }

  // ───── Enrollments ─────
  enrollments(f: Partial<EnrollmentFilter> & { employeeId?: string }): Observable<Enrollment[]> {
    let p = new HttpParams().set('scope', f.scope ?? 'mine');
    if (f.status) p = p.set('status', f.status);
    if (f.overdue) p = p.set('overdue', true);
    if (f.courseId) p = p.set('courseId', f.courseId);
    if (f.employeeId) p = p.set('employeeId', f.employeeId);
    if (f.departmentId) p = p.set('departmentId', f.departmentId);
    if (f.search?.trim()) p = p.set('search', f.search.trim());
    return this.http.get<Enrollment[]>(`${this.base}/enrollments`, { params: p });
  }

  progress(id: string, progress: number): Observable<void> {
    return this.http.put<void>(`${this.base}/enrollments/${id}/progress`, { progress });
  }

  complete(id: string, body: CompleteBody): Observable<void> {
    return this.http.post<void>(`${this.base}/enrollments/${id}/complete`, body);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/enrollments/${id}/cancel`, {});
  }

  changeDue(id: string, dueOn: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/enrollments/${id}/due`, { dueOn });
  }

  // ───── Skills ─────
  skills(includeInactive = false): Observable<Skill[]> {
    const p = includeInactive ? new HttpParams().set('includeInactive', true) : new HttpParams();
    return this.http.get<Skill[]>(`${this.base}/skills`, { params: p });
  }

  createSkill(body: SkillBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/skills`, body).pipe(map(r => r.id));
  }

  updateSkill(id: string, body: SkillBody): Observable<void> {
    return this.http.put<void>(`${this.base}/skills/${id}`, body);
  }

  deleteSkill(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/skills/${id}`);
  }

  addStarterSkills(): Observable<number> {
    return this.http.post<{ added: number }>(`${this.base}/skills/starter`, {}).pipe(map(r => r.added));
  }

  matrix(departmentId = '', skillId = '', search = ''): Observable<SkillMatrix> {
    let p = new HttpParams();
    if (departmentId) p = p.set('departmentId', departmentId);
    if (skillId) p = p.set('skillId', skillId);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<SkillMatrix>(`${this.base}/skills/matrix`, { params: p });
  }

  // ───── People ─────
  person(employeeId: string | null): Observable<PersonGrowth> {
    return this.http.get<PersonGrowth>(`${this.base}/people/${employeeId ?? 'me'}`);
  }

  rate(employeeId: string, skillId: string, level: number): Observable<void> {
    return this.http.put<void>(`${this.base}/people/${employeeId}/skills/${skillId}`, { level });
  }

  removeSkill(employeeId: string, skillId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/people/${employeeId}/skills/${skillId}`);
  }

  setGoal(employeeId: string, targetDesignationId: string, targetDate: string | null, notes: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/people/${employeeId}/goal`, { targetDesignationId, targetDate, notes });
  }

  achieveGoal(employeeId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/people/${employeeId}/goal/achieved`, {});
  }

  clearGoal(employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/people/${employeeId}/goal`);
  }

  // ───── Career ─────
  roles(): Observable<CareerRole[]> {
    return this.http.get<CareerRole[]>(`${this.base}/career/roles`);
  }

  saveRole(designationId: string, skills: { skillId: string; level: number }[]): Observable<void> {
    return this.http.put<void>(`${this.base}/career/roles/${designationId}`, { skills });
  }

  goals(departmentId = '', search = ''): Observable<CareerGoalRow[]> {
    let p = new HttpParams();
    if (departmentId) p = p.set('departmentId', departmentId);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<CareerGoalRow[]>(`${this.base}/career/goals`, { params: p });
  }
}
