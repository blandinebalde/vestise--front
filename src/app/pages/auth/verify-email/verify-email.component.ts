import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { formatHttpErrorForUser } from '../http-error-messages';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../auth-shared.css', './verify-email.component.css']
})
export class VerifyEmailComponent implements OnInit {
  token = '';
  success = false;
  error = '';
  loading = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      if (this.token) {
        this.verifyEmail();
      } else {
        this.error =
          'Le lien de vérification est incomplet. Utilisez le lien reçu par e-mail après votre inscription, ou créez un compte.';
        this.loading = false;
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
      }
    });
  }
}
