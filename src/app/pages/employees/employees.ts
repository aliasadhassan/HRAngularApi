import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup
} from '@angular/forms';
import { Observable } from 'rxjs';

import { EmployeesService } from '../../services/employees.service';
import { Employee, EmployeePayload } from './employees.model';

@Component({
  selector: 'app-employees',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './employees.html',
  styleUrl: './employees.scss'
})
export class EmployeesComponent implements OnInit {

  private readonly employeesService = inject(EmployeesService);
  private readonly fb = inject(FormBuilder);

  employees = signal<Employee[]>([]);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  isModalOpen = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);

  form: FormGroup = this.fb.group({
    username: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ],
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(50)
      ]
    ],
    cnic: [
      '',
      [
        Validators.required,
        Validators.maxLength(20)
      ]
    ],
    country: [
      '',
      [
        Validators.required,
        Validators.maxLength(50)
      ]
    ],
    city: [
      '',
      [
        Validators.required,
        Validators.maxLength(50)
      ]
    ],
    address: [
      '',
      [
        Validators.required,
        Validators.maxLength(250)
      ]
    ],
    contactNo: [
      '',
      [
        Validators.required,
        Validators.maxLength(20)
      ]
    ]
  });

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.errorMsg.set(null);

    this.employeesService.getAll().subscribe({
      next: (response) => {
        this.employees.set(response.data);
        this.loading.set(false);
      },

      error: (error) => {
        console.error('Failed to load employees:', error);

        this.errorMsg.set('No data available.');
        this.loading.set(false);
      }
    });
  }

  openAddModal(): void {
    this.editingId.set(null);
    this.form.reset();
    this.errorMsg.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(emp: Employee): void {
    this.editingId.set(emp.id);

    this.form.patchValue({
      username: emp.username,
      email: emp.email,
      cnic: emp.cnic,
      country: emp.country,
      city: emp.city,
      address: emp.address,
      contactNo: emp.contactNo
    });

    this.errorMsg.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) {
      return;
    }

    this.isModalOpen.set(false);
    this.form.reset();
    this.editingId.set(null);
  }

save(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const payload = this.form.value as EmployeePayload;
  const id = this.editingId();

  this.saving.set(true);
  this.errorMsg.set(null);

  const request$: Observable<number | Employee> =
    id !== null
      ? this.employeesService.update(id, payload)
      : this.employeesService.create(payload);

  request$.subscribe({
    next: () => {
      this.saving.set(false);
      this.closeModal();
      this.loadEmployees();
    },

    error: (error: unknown) => {
      console.error('Employee save failed:', error);

      this.saving.set(false);

      this.errorMsg.set(
        id !== null
          ? 'Employee could not be updated.'
          : 'Employee could not be created.'
      );
    }
  });
}

  remove(emp: Employee): void {
    if (!confirm(`${emp.username} will be deleted. Are you sure?`)) {
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    this.employeesService.delete(emp.id).subscribe({
      next: () => {
        this.loadEmployees();
      },

      error: (error) => {
        console.error('Employee deletion failed:', error);

        this.loading.set(false);
        this.errorMsg.set('Data could not be deleted.');
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);

    return !!control &&
      control.invalid &&
      (control.touched || control.dirty);
  }
}