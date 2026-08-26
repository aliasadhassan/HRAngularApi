import {
AfterViewInit,
Component,
ElementRef,
ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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
imports: [CommonModule, RouterModule],
templateUrl: './sidebar.html',
styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements AfterViewInit {
@ViewChild('sidebarEl')
sidebarEl!: ElementRef; 

isExpanded = false; 

menuItems: MenuItem[] = [
{
icon: 'dashboard',
label: 'Dashboard',
expanded: true,
children: [
{
label: 'Overview',
route: '/app/dashboard',
active: true
},
{
label: 'Analytics',
route: '/app/dashboard/analytics'
}
]
},
{
icon: 'groups',
label: 'Employees',
children: [
{
label: 'All Employees',
route: '/app/employees'
},
{
label: 'Departments',
route: '/app/employees/departments'
}
]
},
{
icon: 'event_available',
label: 'Leaves',
children: [
{
label: 'Leave Requests',
route: '/app/leaves'
},
{
label: 'Leave Calendar',
route: '/app/leaves/calendar'
}
]
},
{
icon: 'settings',
label: 'Settings',
route: '/app/settings'
}
]; 

constructor(private router: Router) {} 

ngAfterViewInit(): void {
this.sidebarEl.nativeElement.style.width = '64px';
} 

toggleSidebar(): void {
const fromWidth = this.isExpanded ? '256px' : '64px';
const toWidth = this.isExpanded ? '64px' : '256px'; 

this.isExpanded = !this.isExpanded;

animate(
this.sidebarEl.nativeElement,
{
width: [fromWidth, toWidth]
},
{
duration: 0.35,
ease: 'easeInOut'
}
);

if (!this.isExpanded) {
this.menuItems.forEach(item => {
item.expanded = false;
});
}

} 

onParentClick(item: MenuItem): void {
if (item.children && item.children.length > 0) {
if (!this.isExpanded) {
this.toggleSidebar();
}
item.expanded = !item.expanded;
return;
} 

if (item.route) {
this.navigate(item.route);
}
} 

onChildClick(parent: MenuItem, child: MenuItem): void {
this.menuItems.forEach(item => {
item.active = false;
item.children?.forEach(childItem => {
childItem.active = false;
});
}); 

parent.active = true;
child.active = true;

if (child.route) {
this.navigate(child.route);
}

} 

private navigate(route: string): void {
// Standard angular routing tree command sequence matching microservices boundaries
this.router.navigate([route]).then(success => {
if (success) {
console.log(`Successfully navigated to: ${route}`);
} else {
console.error(`Routing module refused transition to layout: ${route}`);
}
});
}
}