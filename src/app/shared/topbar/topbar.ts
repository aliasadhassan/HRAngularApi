import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css']
})
export class TopbarComponent {
  showProfileMenu = false;

  // Constructor mein AuthService inject karein
  constructor(private authService: AuthService) {}

  toggleProfile() {
    this.showProfileMenu = !this.showProfileMenu;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile')) {
      this.showProfileMenu = false;
    }
  }

  logout() {
    console.log('Logout clicked');
    this.authService.logout();
  }
}
