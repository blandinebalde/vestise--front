import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { NavigationService } from '../../../services/navigation.service';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth-shared.css', './reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm!: FormGroup;
  token = '';
  tokenMissing = false;
  loading = false;
  error = '';
  success = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.tokenMissing = !this.token;
    });
    this.initForm();
  }

  initForm() {
    this.resetPasswordForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator()]],
        confirmPassword: ['', Validators.required]
      },
      { validators: this.passwordMatchValidator() }
    );
  }

  passwordStrengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const hasNumber = /[0-9]/.test(control.value);
      const hasUpper = /[A-Z]/.test(control.value);
      const hasLower = /[a-z]/.test(control.value);
      const passwordValid = hasNumber && hasUpper && hasLower;
      return !passwordValid ? { passwordStrength: true } : null;
    };
  }

  passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('newPassword');
      const confirmPassword = control.get('confirmPassword');
      if (!password || !confirmPassword) {
        return null;
      }
      return password.value === confirmPassword.value ? null : { passwordMismatch: true };
    };
  }

  getFieldError(fieldName: string): string {
    const field = this.resetPasswordForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return 'Ce champ est requis.';
    }
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `Le mot de passe doit contenir au moins ${min} caractères.`;
    }
    if (field.errors['passwordStrength']) {
      return 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.';
    }
    if (this.resetPasswordForm.errors && this.resetPasswordForm.errors['passwordMismatch'] && fieldName === 'confirmPassword') {
      return 'Les mots de passe ne correspondent pas.';
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  private isResetSuccessPayload(err: unknown): boolean {
    const e = err as { error?: { text?: string } };
    const t = e?.error?.text;
    if (typeof t !== 'string') return false;
    const lower = t.toLowerCase();
    return lower.includes('reset successfully') || lower.includes('réinitialisé');
  }

  onSubmit() {
    if (this.tokenMissing) {
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const newPassword = this.resetPasswordForm.get('newPassword')?.value;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err: unknown) => {
        if (this.isResetSuccessPayload(err)) {
          this.loading = false;
          this.success = true;
          return;
        }
        this.loading = false;
        this.error = formatHttpErrorForUser(err, 'password');
      }
    });
  }

  get f() {
    return this.resetPasswordForm.controls;
  }

  hasMinLength(): boolean {
    const password = this.resetPasswordForm.get('newPassword')?.value;
    return password && password.length >= 6;
  }

  hasUpperCase(): boolean {
    const password = this.resetPasswordForm.get('newPassword')?.value;
    return password && /[A-Z]/.test(password);
  }

  hasLowerCase(): boolean {
    const password = this.resetPasswordForm.get('newPassword')?.value;
    return password && /[a-z]/.test(password);
  }

  hasNumber(): boolean {
    const password = this.resetPasswordForm.get('newPassword')?.value;
    return password && /[0-9]/.test(password);
  }
}
