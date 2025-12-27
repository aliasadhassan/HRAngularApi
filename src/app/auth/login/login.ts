import { Component, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink,Router } from '@angular/router'; // Required for routerLink

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink], // Added RouterLink
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  error = '';

  constructor(
    private fb: FormBuilder, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router 
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

login() {
    this.error = ''; 

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (res: any) => {
        console.log('Login success', res);
        localStorage.setItem('accessToken', res.accessToken); // Tip: Aksar yahan token save kiya jata hai
        
        this.router.navigate(['/app/dashboard']).then(() => {
          this.cdr.detectChanges(); // Navigation ke baad UI update
        });
      },
      error: (err) => {
        console.error('Backend Error:', err);
        
        if (err.error && err.error.message) {
          this.error = err.error.message;
        } else if (err.status === 401) {
          this.error = 'Invalid email or password';
        } else {
          this.error = 'An unexpected error occurred';
        }

        this.cdr.detectChanges(); 
      }
    });
  }
}