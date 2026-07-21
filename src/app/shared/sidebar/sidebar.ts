import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { CommonModule } from '@angular/common';
import { animate } from 'motion';

interface MenuItem {
  icon?: string;
  label: string;
  route?: string;
  active?: boolean;
  expanded?: boolean;
  children?: MenuItem[];
}

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements AfterViewInit {
  @ViewChild('sidebarEl') sidebarEl!: ElementRef<HTMLElement>;
  isExpanded = false;

  ngAfterViewInit(): void {
    animate(
      this.sidebarEl.nativeElement,
      { width: this.isExpanded ? '256px' : '64px' } as Record<string, any>,
      { duration: 0 }
    );
  }

  menuItems: MenuItem[] = [
    {
      icon: 'dashboard',
      label: 'Dashboard',
      expanded: true,
      children: [
        { label: 'Overview', route: '/dashboard', active: true },
        { label: 'Analytics', route: '/dashboard/analytics' }
      ]
    },
    {
      icon: 'groups',
      label: 'Employees',
      children: [
        { label: 'All Employees', route: '/employees' },
        { label: 'Add Employee', route: '/employees/add' },
        { label: 'Departments', route: '/employees/departments' }
      ]
    },
    {
      icon: 'event_available',
      label: 'Leaves',
      children: [
        { label: 'Leave Requests', route: '/leaves' },
        { label: 'Leave Calendar', route: '/leaves/calendar' }
      ]
    },
    { icon: 'settings', label: 'Settings', route: '/settings' }
  ];

  constructor(private router: Router) {}

  toggleSidebar(): void {
    this.isExpanded = !this.isExpanded;
    animate(
      this.sidebarEl.nativeElement,
      { width: this.isExpanded ? '256px' : '64px' } as Record<string, any>,
      { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
    );

    // Sidebar collapse hote waqt saare submenus band kar dein
    if (!this.isExpanded) {
      this.menuItems.forEach(item => (item.expanded = false));
    }
  }

  onParentClick(item: MenuItem): void {
    if (item.children?.length) {
      if (!this.isExpanded) {
        // Sidebar collapsed hai to pehle expand karo, phir submenu kholo
        this.toggleSidebar();
      }
      item.expanded = !item.expanded;
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  onChildClick(parent: MenuItem, child: MenuItem): void {
    this.menuItems.forEach(i => (i.active = false));
    parent.active = true;
    this.menuItems.forEach(i => i.children?.forEach(c => (c.active = false)));
    child.active = true;
    if (child.route) this.router.navigate([child.route]);
  }
}