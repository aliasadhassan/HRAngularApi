import { Component, ChangeDetectorRef  } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule,RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  registerForm: FormGroup; // Form Group defined here
  success = '';
  error = '';

  constructor(private fb: FormBuilder, private authService: AuthService,private cdr: ChangeDetectorRef) {
    // Validation Logic will set here
    this.registerForm = this.fb.group({
      UserName: ['', [Validators.required, Validators.maxLength(50)]], // Username required + Max 50
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]], // Valid email + Max 50
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]] // Min 6 chars
    });
  }

  register() {

  this.error = '';
  this.success = '';

  if (this.registerForm.invalid) {
    this.registerForm.markAllAsTouched();
    return;
  }

  this.authService.register(this.registerForm.value).subscribe({
    next: (res: any) => {
      this.success = res.message || 'Registration successful!';
      this.error = '';

      console.log('Registration success', res);
      this.cdr.detectChanges(); // UI update

     this.registerForm.reset();
    },
    error: (err) => {
        console.log('Backend Error Object:', err);
        
        // Error message set karein
        if (err.error && err.error.message) {
          this.error = err.error.message;
        } else {
          this.error = 'An unexpected error occurred';
        }

        // SAB SE IMPORTANT LINE: Angular ko force karein screen update karne ke liye
        this.cdr.detectChanges(); 
      }
  });
}

}
