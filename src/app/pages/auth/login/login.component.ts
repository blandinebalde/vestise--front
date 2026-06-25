import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GoogleSignInComponent],
  templateUrl: './login.component.html',
  styleUrls: ['../auth-shared.css', './login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  error = '';
  loading = false;
  returnUrl = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      emailOrPhone: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(1)]]
    });

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return fieldName === 'emailOrPhone'
        ? 'L’e-mail ou le numéro de téléphone est obligatoire.'
        : 'Le mot de passe est obligatoire.';
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.error = '';
    this.loading = true;

    const { emailOrPhone, password } = this.loginForm.value;

    this.authService.login(emailOrPhone, password).subscribe({
      next: () => {
        this.loading = false;
        if (this.returnUrl.startsWith('/')) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.router.navigate([this.returnUrl]);
        }
      },
      error: (err: unknown) => {
        this.loading = false;
        this.error = formatHttpErrorForUser(err, 'login');
      }
    });
  }

  onGoogleSuccess(): void {
    if (this.returnUrl.startsWith('/')) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.router.navigate([this.returnUrl]);
    }
  }

  onGoogleError(message: string): void {
    this.error = message;
  }
}
