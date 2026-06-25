import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../auth-shared.css', './verify-email.component.css']
})
export class VerifyEmailComponent implements OnInit {
  token = '';
  success = false;
  error = '';
  loading = true;
  showResend = false;
  resendForm!: FormGroup;
  resendLoading = false;
  resendError = '';
  resendSuccess = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.resendForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      if (this.token) {
        this.verifyEmail();
      } else {
        this.error =
          'Le lien de vérification est incomplet. Utilisez le lien reçu par e-mail après votre inscription.';
        this.loading = false;
        this.showResend = true;
      }
    });
  }

  verifyEmail() {
    this.loading = true;
    this.error = '';
    this.authService.verifyEmail(this.token).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 4000);
      },
      error: (err: unknown) => {
        this.error = formatHttpErrorForUser(err, 'verify');
        this.loading = false;
        this.showResend = true;
      }
    });
  }

  resendVerification() {
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }
    this.resendLoading = true;
    this.resendError = '';
    this.resendSuccess = false;
    const email = this.resendForm.get('email')?.value?.trim();
    this.authService.resendVerificationEmail(email).subscribe({
      next: () => {
        this.resendLoading = false;
        this.resendSuccess = true;
      },
      error: (err: unknown) => {
        this.resendError = formatHttpErrorForUser(err, 'verify');
        this.resendLoading = false;
      }
    });
  }

  isResendFieldInvalid(): boolean {
    const field = this.resendForm.get('email');
    return !!(field && field.invalid && field.touched);
  }
}
