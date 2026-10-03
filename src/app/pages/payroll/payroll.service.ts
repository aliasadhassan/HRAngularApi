import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignSalary, CalcType, EmployeeSalary, PagedResult, PayComponent, PayGroup, PayPeriod, PayrollEmployee, PayrollRun,
  PayrollSettings, Payslip, PayslipListItem, SalaryGrade, SalaryTemplate, SavePayComponent, TaxRegime, TaxSlab,
  TemplateLine, TemplateListItem
} from './payroll.models';

/**
 * Gateway: /payroll/{x} → Payroll API /api/payroll/{x}
 * Routes HR.Payroll.API ke controllers se match kiye hue (Oct 2026).
 */
export const PAYROLL_ROUTES = {
  settings: 'setup/settings',
  initialize: 'setup/initialize',
  payGroups: 'pay-groups',
  payGroup: (id: string) => `pay-groups/${id}`,
  periods: (groupId: string) => `pay-groups/${groupId}/periods`,
  generatePeriods: (groupId: string) => `pay-groups/${groupId}/periods/generate`,
  components: 'components',
  component: (id: string) => `components/${id}`,
  taxRegimes: 'tax/regimes',
  grades: 'grades',
  grade: (id: string) => `grades/${id}`,
  templates: 'templates',
  template: (id: string) => `templates/${id}`,
  employees: 'employees',
  assignPayGroup: 'employees/pay-group',
  salaries: (employeeId: string) => `employees/${employeeId}/salaries`,
  overrides: (employeeId: string, componentId: string) => `employees/${employeeId}/salary/components/${componentId}`,
  exclude: (employeeId: string, componentId: string) => `employees/${employeeId}/salary/components/${componentId}/exclude`
};
const R = PAYROLL_ROUTES;

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/payroll`;

  // ── Runs ──
  getRuns(payGroupId?: string): Observable<PayrollRun[]> {
    const params = payGroupId ? new HttpParams().set('payGroupId', payGroupId) : undefined;
    return this.http.get<PayrollRun[]>(`${this.base}/runs`, { params });
  }

  getRun(id: string): Observable<PayrollRun> {
    return this.http.get<PayrollRun>(`${this.base}/runs/${id}`);
  }

  createRun(payGroupId: string, payPeriodId: string): Observable<string> {
    return this.http
      .post<{ id: string }>(`${this.base}/runs`, { payGroupId, payPeriodId })
      .pipe(map(r => r.id));
  }

  calculate(id: string): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.base}/runs/${id}/calculate`, {});
  }

  approve(id: string): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.base}/runs/${id}/approve`, {});
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/runs/${id}/cancel`, {});
  }

  // ── Payslips ──
  getRunPayslips(runId: string): Observable<PayslipListItem[]> {
    return this.http.get<PayslipListItem[]>(`${this.base}/runs/${runId}/payslips`);
  }

  getPayslip(id: string): Observable<Payslip> {
    return this.http.get<Payslip>(`${this.base}/payslips/${id}`);
  }

  // ── Setup ──
  getPayGroups(includeInactive = false): Observable<PayGroup[]> {
    return this.http.get<PayGroup[]>(this.url(R.payGroups), { params: { includeInactive } });
  }

  createPayGroup(body: Omit<PayGroup, 'id' | 'isActive' | 'employeeCount'>): Observable<string> {
    return this.http.post<{ id: string }>(this.url(R.payGroups), body).pipe(map(r => r.id));
  }

  updatePayGroup(id: string, body: { name: string; code: string; payDayOffset: number }): Observable<void> {
    return this.http.put<void>(this.url(R.payGroup(id)), body);
  }

  getPayPeriods(payGroupId: string, year?: number): Observable<PayPeriod[]> {
    const params = year ? new HttpParams().set('year', year) : undefined;
    return this.http.get<PayPeriod[]>(this.url(R.periods(payGroupId)), { params });
  }

  generatePeriods(payGroupId: string, count: number): Observable<number> {
    return this.http
      .post<{ generated: number }>(this.url(R.generatePeriods(payGroupId)), {}, { params: { count } })
      .pipe(map(r => r.generated));
  }

  getSettings(): Observable<PayrollSettings> {
    return this.http.get<PayrollSettings>(this.url(R.settings));
  }

  updateSettings(body: PayrollSettings): Observable<void> {
    return this.http.put<void>(this.url(R.settings), body);
  }

  initialize(baseCurrency: string): Observable<void> {
    return this.http.post<void>(this.url(R.initialize), { baseCurrency });
  }

  getComponents(includeInactive = true): Observable<PayComponent[]> {
    return this.http.get<PayComponent[]>(this.url(R.components), { params: { includeInactive } });
  }

  saveComponent(body: SavePayComponent, id?: string): Observable<unknown> {
    return id ? this.http.put(this.url(R.component(id)), body) : this.http.post(this.url(R.components), body);
  }

  getTaxRegimes(countryCode?: string): Observable<TaxRegime[]> {
    const params = countryCode ? new HttpParams().set('countryCode', countryCode) : undefined;
    return this.http.get<TaxRegime[]>(this.url(R.taxRegimes), { params });
  }

  createTaxRegime(body: Omit<TaxRegime, 'id' | 'isPlatformDefined' | 'isActive' | 'slabs'> & { slabs: TaxSlab[] }): Observable<unknown> {
    return this.http.post(this.url(R.taxRegimes), body);
  }

  // ── Salary structure ──
  getGrades(includeInactive = true): Observable<SalaryGrade[]> {
    return this.http.get<SalaryGrade[]>(this.url(R.grades), { params: { includeInactive } });
  }

  saveGrade(body: Omit<SalaryGrade, 'id' | 'isActive'>, id?: string): Observable<unknown> {
    return id ? this.http.put(this.url(R.grade(id)), body) : this.http.post(this.url(R.grades), body);
  }

  getTemplates(includeInactive = true): Observable<TemplateListItem[]> {
    return this.http.get<TemplateListItem[]>(this.url(R.templates), { params: { includeInactive } });
  }

  getTemplate(id: string): Observable<SalaryTemplate> {
    return this.http.get<SalaryTemplate>(this.url(R.template(id)));
  }

  saveTemplate(body: { name: string; salaryGradeId: string | null; lines: TemplateLine[] }, id?: string): Observable<unknown> {
    const payload = {
      ...body,
      lines: body.lines.map(l => ({
        payComponentId: l.payComponentId, calcType: l.calcType,
        amount: l.amount, percentage: l.percentage, baseComponentId: l.baseComponentId
      }))
    };
    return id ? this.http.put(this.url(R.template(id)), payload) : this.http.post(this.url(R.templates), payload);
  }

  // ── Employees & salaries ──
  getPayrollEmployees(q: { page: number; pageSize: number; search?: string; payGroupId?: string; onlyUnassigned?: boolean }): Observable<PagedResult<PayrollEmployee>> {
    let params = new HttpParams().set('page', q.page).set('pageSize', q.pageSize);
    if (q.search?.trim()) params = params.set('search', q.search.trim());
    if (q.payGroupId) params = params.set('payGroupId', q.payGroupId);
    if (q.onlyUnassigned) params = params.set('onlyUnassigned', true);
    return this.http.get<PagedResult<PayrollEmployee>>(this.url(R.employees), { params });
  }

  assignPayGroup(employeeIds: string[], payGroupId: string | null): Observable<number> {
    return this.http
      .post<{ updated: number }>(this.url(R.assignPayGroup), { employeeIds, payGroupId })
      .pipe(map(r => r.updated));
  }

  getSalaryHistory(employeeId: string): Observable<EmployeeSalary[]> {
    return this.http.get<EmployeeSalary[]>(this.url(R.salaries(employeeId)));
  }

  assignSalary(body: AssignSalary): Observable<{ id: string; warning: string | null }> {
    return this.http.post<{ id: string; warning: string | null }>(this.url(R.salaries(body.employeeId)), body);
  }

  setOverride(employeeId: string, componentId: string, body: { calcType: CalcType; amount: number | null; percentage: number | null; baseComponentId: string | null }): Observable<void> {
    return this.http.put<void>(this.url(R.overrides(employeeId, componentId)), body);
  }

  excludeComponent(employeeId: string, componentId: string): Observable<void> {
    return this.http.post<void>(this.url(R.exclude(employeeId, componentId)), {});
  }

  removeOverride(employeeId: string, componentId: string): Observable<void> {
    return this.http.delete<void>(this.url(R.overrides(employeeId, componentId)));
  }

  private url(path: string): string {
    return `${this.base}/${path}`;
  }

  /** Backend ProblemDetails se saaf message (validation errors bhi). */
  static errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const body = error.error;
    if (body?.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors as Record<string, string[]>).flat()[0];
      if (first) return first;
    }
    return body?.detail || body?.title || fallback;
  }
}
