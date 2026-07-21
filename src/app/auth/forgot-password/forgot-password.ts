import { Component } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPasswordComponent {
  email: string = '';
  message: string = '';
  error: string = '';
  isLoading: boolean = false;
  today = new Date();

  constructor(private authService: AuthService) {}

  sendLink() {
    this.isLoading = true;
    this.message = '';
    this.error = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.message || "Error occurred. Please try again.";
        this.isLoading = false;
        this.message = '';
      }
    });
  }
}