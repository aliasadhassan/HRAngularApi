import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { CommonModule } from '@angular/common'; // Yeh import lazmi karein

interface MenuItem {
         icon: string;
         label: string;
}
@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [RouterModule, CommonModule], // CommonModule for ngClass
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {
  constructor(public authService: AuthService) {}
 
  isExpanded = false;
  
  menuItems: MenuItem[] = [
    { icon: 'home', label: 'Home' },
    { icon: 'explore', label: 'Explore' },
    { icon: 'chat_bubble', label: 'Messages' },
    { icon: 'groups', label: 'Groups' },
    { icon: 'work', label: 'Teams & Jobs' },
    { icon: 'notifications', label: 'Notifications' },
    { icon: 'flash_on', label: 'Appearance' },
    { icon: 'settings', label: 'Settings' },
    { icon: 'person', label: 'Your profile' },
    { icon: 'add_box', label: 'New post' }
  ];
  
  toggleSidebar(): void {
    this.isExpanded = !this.isExpanded;
  }
  
  onMenuItemClick(item: MenuItem): void {
    console.log('Clicked:', item.label);
  }
}
      