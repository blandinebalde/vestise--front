import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { NavigationService } from '../../../services/navigation.service';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-shared.css', './forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm!: FormGroup;
  loading = false;
  error = '';
  sentSuccess = false;
  sentToDisplay = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.forgotPasswordForm = this.fb.group({
      emailOrPhone: ['', [Validators.required]]
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.forgotPasswordForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return 'L’e-mail ou le numéro de téléphone est requis.';
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  private applySentSuccess(emailOrPhone: string) {
    this.loading = false;
    this.sentSuccess = true;
    this.sentToDisplay = (emailOrPhone || '').trim();
    this.error = '';
    this.forgotPasswordForm.reset();
    this.initForm();
  }

  private isForgotSuccessPayload(err: unknown): boolean {
    const e = err as { error?: { text?: string } };
    const t = e?.error?.text;
    if (typeof t !== 'string') return false;
    const lower = t.toLowerCase();
    return lower.includes('sent') || lower.includes('envoyé');
  }

  onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    this.sentSuccess = false;
    const emailOrPhone = (this.forgotPasswordForm.get('emailOrPhone')?.value || '').trim();

    this.authService.forgotPassword(emailOrPhone).subscribe({
      next: () => {
        this.applySentSuccess(emailOrPhone);
      },
      error: (err: unknown) => {
        if (this.isForgotSuccessPayload(err)) {
          this.applySentSuccess(emailOrPhone);
          return;
        }
        this.loading = false;
        this.error = formatHttpErrorForUser(err, 'forgot');
      }
    });
  }

  get f() {
    return this.forgotPasswordForm.controls;
  }
}
