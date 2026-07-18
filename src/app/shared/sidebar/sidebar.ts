import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { CommonModule } from '@angular/common';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  active?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {
  constructor(public authService: AuthService) {}

  isExpanded = false;

  menuItems: MenuItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { icon: 'groups', label: 'Employees', route: '/employees' },
    { icon: 'event_available', label: 'Leaves', route: '/leaves' },
    { icon: 'settings', label: 'Settings', route: '/settings' }
  ];

  toggleSidebar(): void {
    this.isExpanded = !this.isExpanded;
  }

  onMenuItemClick(item: MenuItem): void {
    console.log('Clicked:', item.label);
  }
}