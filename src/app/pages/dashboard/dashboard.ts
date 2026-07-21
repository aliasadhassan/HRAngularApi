import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiCardsComponent } from '../../shared/widgets/kpi-cards/kpi-cards';
import { ChartComponent } from '../../shared/widgets/chart/chart';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, KpiCardsComponent, ChartComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  today = new Date();

  // Attendance & Growth charts
  attendanceLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  attendanceDatasets = [
    { label: 'Attendance %', data: [92, 95, 90, 96, 94, 70, 65], backgroundColor: '#4C6B4F', borderRadius: 4, maxBarThickness: 28 }
  ];

  growthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  growthDatasets = [
    { label: 'Employees', data: [98, 102, 108, 115, 122, 128], borderColor: '#C9A24B', backgroundColor: 'rgba(201,162,75,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#C9A24B' }
  ];

  // Department donut
  departments = [
    { name: 'Development', count: 58, color: '#4C6B4F' },
    { name: 'Design', count: 34, color: '#C9A24B' },
    { name: 'Marketing', count: 36, color: '#B4552F' }
  ];
  totalStaff = 128;
  deptLabels = this.departments.map(d => d.name);
  deptDatasets = [
    { data: this.departments.map(d => d.count), backgroundColor: this.departments.map(d => d.color), borderWidth: 0 }
  ];

  // Availability panel
  availabilityStats = { available: 104, unavailable: 18, onLeave: 6 };
  quickView = [
    { initials: 'SJ', name: 'Sarah Johnson', role: 'Senior Developer' },
    { initials: 'EC', name: 'Emily Carter', role: 'UI/UX Designer' },
    { initials: 'DL', name: 'David Lee', role: 'Marketing Lead' },
    { initials: 'MS', name: 'Michael Smith', role: 'HR Executive' }
  ];

  // Payroll panel
  payroll = [
    { name: 'Development', count: 58, amount: '$12,400' },
    { name: 'Design', count: 34, amount: '$8,200' },
    { name: 'Marketing', count: 36, amount: '$7,650' },
    { name: 'HR', count: 6, amount: '$5,300' }
  ];

  // Recent Employees table
  recentEmployees = [
    { name: 'Andrew James', department: 'Development', joinDate: '12 Jul 2026', status: 'Active' },
    { name: 'Sophia White', department: 'Design', joinDate: '05 Jul 2026', status: 'Active' },
    { name: 'Daniel Martinez', department: 'Marketing', joinDate: '28 Jun 2026', status: 'Probation' },
    { name: 'Amelia Robinson', department: 'HR', joinDate: '20 Jun 2026', status: 'Active' }
  ];

  // Leave Requests (with accept/reject actions)
  leaveRequests = [
    { initials: 'JA', name: 'James Allaire', reason: '4 Days · Personal Reason' },
    { initials: 'ES', name: 'Esther Schmidt', reason: '2 Days · Going to Hospital' },
    { initials: 'VP', name: 'Valerie Padgett', reason: '1 Day · Changing Account' },
    { initials: 'DN', name: 'Diane Nash', reason: '1 Day · Not Well' },
    { initials: 'SC', name: 'Sally Cavazos', reason: '2 Days · Going to Checkup' }
  ];

  approveLeave(req: any) {
    this.leaveRequests = this.leaveRequests.filter(r => r !== req);
  }

  rejectLeave(req: any) {
    this.leaveRequests = this.leaveRequests.filter(r => r !== req);
  }
  // All Meetings (full-width table)
  meetings = [
    { empInitials: 'AJ', empName: 'Andrew James', empRole: 'Developer',
      withInitials: 'SJ', withName: 'Sarah Johnson', withPhone: '1:1 Sync',
      date: '28 Jul 2026 - 11:15 AM', mode: 'Online', status: 'Confirmed' },
    { empInitials: 'SW', empName: 'Sophia White', empRole: 'Designer',
      withInitials: 'EC', withName: 'Emily Carter', withPhone: 'Design Review',
      date: '29 Jul 2026 - 11:30 AM', mode: 'In-Person', status: 'Cancelled' },
    { empInitials: 'DM', empName: 'Daniel Martinez', empRole: 'Marketing',
      withInitials: 'DL', withName: 'David Lee', withPhone: 'Campaign Review',
      date: '30 Jul 2026 - 09:30 AM', mode: 'Online', status: 'Confirmed' },
    { empInitials: 'AR', empName: 'Amelia Robinson', empRole: 'HR Executive',
      withInitials: 'MS', withName: 'Michael Smith', withPhone: 'Onboarding Sync',
      date: '30 Jul 2026 - 10:00 AM', mode: 'Online', status: 'Checked Out' },
    { empInitials: 'JC', empName: 'John Carter', empRole: 'Sales',
      withInitials: 'RG', withName: 'Rachel Green', withPhone: 'Performance Review',
      date: '30 Jul 2026 - 11:00 AM', mode: 'Online', status: 'Scheduled' }
  ];
}