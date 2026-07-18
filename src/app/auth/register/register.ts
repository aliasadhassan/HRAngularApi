import { Component, ChangeDetectorRef  } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink,Router } from '@angular/router';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import { AlertService } from '../../services/alert/alert';

// Options pehle set karein
const options = {
  translations: zxcvbnEn.translations,
  graphs: zxcvbnCommon.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommon.dictionary,
    ...zxcvbnEn.dictionary,
  },
};

zxcvbnOptions.setOptions(options);

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
  today = new Date();

  hidePassword = true;
  passwordSuggestions: string[] = []; 

  // Variables define for password strength meter
  strengthScore: number = 0;

  constructor(
    private router: Router,
    private alert: AlertService,
    private fb: FormBuilder, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef) {
    // Validation Logic will set here
    this.registerForm = this.fb.group({
      UserName: ['', [Validators.required, Validators.maxLength(50)]], // Username required + Max 50
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]], // Valid email + Max 50
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]] // Min 6 chars
    });
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
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
      this.alert.success('User registered successfully');
      this.error = '';

      console.log('Registration success', res);
      this.cdr.detectChanges(); // UI update

      this.registerForm.reset();

      // RESET PASSWORD STRENGTH UI
      this.strengthText = '';
      this.strengthScore = 0;
      this.strengthClass = '';

       // AUTO REDIRECT AFTER 2 SECONDS
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 5000);

    },
    error: (err) => {
        console.log('Backend Error Object:', err);
        this.alert.error('Registration failed');
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

// Initialize these to be empty strings initially so they don't show up on load
  strengthText: string = '';
  strengthClass: string = '';

  // Password strength meter function
  // Iss function ko form control ki value change hone par call karein
updateStrength() {
    const password = this.registerForm.get('password')?.value || '';

    // Jab password empty ho, sab kuch hide ho jana chahiye
    if (!password) {
      this.strengthScore = 0;
      this.strengthText = '';
      this.strengthClass = '';
      this.passwordSuggestions = []; // Clear suggestions
      return; // Stop execution
    }

    const result = zxcvbn(password);
    this.strengthScore = result.score;
    
    // Feedback text and class update karein
    switch (this.strengthScore) {
      case 0:
      case 1:
        this.strengthText = 'Weak';
        this.strengthClass = 'weak';
        break;
      case 2:
        this.strengthText = 'Medium';
        this.strengthClass = 'medium';
        break;
      case 3:
      case 4:
        this.strengthText = 'Strong';
        this.strengthClass = 'strong';
        break;
    }
  }
}
