export interface Employee {
  id: string;
  username: string;
  email: string;
  cnic: string;
  country: string;
  city: string;
  address: string;
  contactNo: string;
  createdDate: string;
}

export type EmployeePayload = Omit<Employee, 'id' | 'createdDate'>;

export interface EmployeeListResponse {
  source: string;
  page: number;
  data: Employee[];
}