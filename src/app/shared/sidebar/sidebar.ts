import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { CommonModule } from '@angular/common'; // Yeh import lazmi karein

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [RouterModule, CommonModule], // CommonModule for ngClass
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {
  constructor(public authService: AuthService) {}

  // Yeh property track karegi ke menu collapse hua hai ya nahi
  isCollapsed: boolean = false; 

  // Yeh function menu state change karega
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
}
