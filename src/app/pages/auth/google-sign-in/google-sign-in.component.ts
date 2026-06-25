import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleAuthService, GoogleButtonText } from '../../../services/google-auth.service';
import { AuthService } from '../../../services/auth.service';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="google-sign-in" *ngIf="!unavailableReason">
      <div #buttonHost class="google-sign-in__host" [class.google-sign-in__host--loading]="loading"></div>
      <p class="google-sign-in__hint" *ngIf="loading">Connexion Google en cours…</p>
      <p class="google-sign-in__origin" *ngIf="pageOrigin">
        Origine à autoriser dans Google Cloud si erreur « invalid_client » :
        <code>{{ pageOrigin }}</code>
      </p>
    </div>
    <p class="google-sign-in__unavailable" *ngIf="unavailableReason" role="status">{{ unavailableReason }}</p>
    <p class="google-sign-in__error" *ngIf="error" role="alert">{{ error }}</p>
  `,
  styles: [`
    .google-sign-in__host {
      display: flex;
      justify-content: center;
      min-height: 44px;
    }
    .google-sign-in__host--loading {
      opacity: 0.55;
      pointer-events: none;
    }
    .google-sign-in__hint {
      margin: 0.5rem 0 0;
      font-size: 0.8125rem;
      color: var(--text-light, #6b6580);
      text-align: center;
    }
    .google-sign-in__unavailable {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-light, #6b6580);
      text-align: center;
    }
    .google-sign-in__error {
      margin: 0.5rem 0 0;
      font-size: 0.8125rem;
      color: var(--error-color, #c62828);
      text-align: center;
    }
    .google-sign-in__origin {
      margin: 0.65rem 0 0;
      font-size: 0.75rem;
      line-height: 1.4;
      color: var(--text-light, #6b6580);
      text-align: center;
    }
    .google-sign-in__origin code {
      display: inline-block;
      margin-top: 0.2rem;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      background: rgba(127, 119, 221, 0.1);
      font-size: 0.7rem;
      word-break: break-all;
    }
  `]
})
export class GoogleSignInComponent implements AfterViewInit, OnDestroy {
  @ViewChild('buttonHost') buttonHost!: ElementRef<HTMLDivElement>;

  @Input() accountType: 'CLIENT' | 'VENDEUR' = 'CLIENT';
  @Input() mode: 'login' | 'signup' = 'login';
  @Input() buttonText: GoogleButtonText = 'continue_with';

  @Output() success = new EventEmitter<void>();
  @Output() failed = new EventEmitter<string>();

  loading = false;
  error = '';
  unavailableReason = '';
  pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  private resizeObserver?: ResizeObserver;

  constructor(
    private googleAuth: GoogleAuthService,
    private authService: AuthService
  ) {}

  ngAfterViewInit(): void {
    void this.mountButton();
    if (typeof ResizeObserver !== 'undefined' && this.buttonHost?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.loading && !this.unavailableReason) {
          void this.mountButton();
        }
      });
      this.resizeObserver.observe(this.buttonHost.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private async mountButton(): Promise<void> {
    if (!this.buttonHost?.nativeElement) {
      return;
    }
    await this.googleAuth.renderButton(this.buttonHost.nativeElement, {
      text: this.buttonText,
      onCredential: (idToken) => this.handleCredential(idToken),
      onUnavailable: (reason) => {
        this.unavailableReason = reason;
      }
    });
  }

  private handleCredential(idToken: string): void {
    this.error = '';
    this.loading = true;

    this.authService.loginWithGoogle(idToken, {
      accountType: this.accountType,
      mode: this.mode
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success.emit();
      },
      error: (err: unknown) => {
        this.loading = false;
        this.error = formatHttpErrorForUser(err, this.mode === 'signup' ? 'register' : 'login');
        this.failed.emit(this.error);
      }
    });
  }
}
