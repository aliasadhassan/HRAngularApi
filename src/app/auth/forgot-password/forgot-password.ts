import { Component } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common'; // ngIf ke liye
import { FormsModule } from '@angular/forms'; // ngModel ke liye

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule], 
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPasswordComponent {
  email: string = '';
  message: string = '';
  error: string = ''; 
  isLoading: boolean = false;

  constructor(private authService: AuthService) {}

  sendLink() {
    this.isLoading = true;
    // Har request se pehle purane messages clear karein
    this.message = ''; 
    this.error = ''; 

    this.authService.forgotPassword(this.email).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.isLoading = false;
      },
      error: (err) => {
        // Error response ko handle karein aur 'this.error' mein save karein
        this.error = err.error?.message || "Error occurred. Please try again."; 
        this.isLoading = false;
        // error aane per success message empty rehna chahiye
        this.message = ''; 
      }
    });
  }
}
