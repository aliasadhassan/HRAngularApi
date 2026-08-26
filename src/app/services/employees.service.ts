import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Employee,
  EmployeeListResponse,
  EmployeePayload
} from '../pages/employees/employees.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmployeesService {

  private http = inject(HttpClient);

  // Goes through Ocelot Gateway -> HR Employee API
  private readonly baseUrl =
    environment.apiGatewayUrl + '/employees';

  // Dynamic backend endpoint targeting presentation controller integration channel
  private readonly testAsbUrl =
    environment.apiGatewayUrl + '/api/test-asb';

    getAll(): Observable<EmployeeListResponse> {
    return this.http.get<EmployeeListResponse>(
      `${this.baseUrl}/all-employees`
    );
  }

  getById(id: string): Observable<Employee> {
    return this.http.get<Employee>(
      `${this.baseUrl}/${id}`
    );
  }

 create(payload: EmployeePayload): Observable<string> {
  return this.http.post<string>(
    this.baseUrl,
    payload
  );
}

  update(
    id: string,
    payload: EmployeePayload
  ): Observable<Employee> {
    return this.http.put<Employee>(
      `${this.baseUrl}/${id}`,
      payload
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${id}`
    );
  }
}