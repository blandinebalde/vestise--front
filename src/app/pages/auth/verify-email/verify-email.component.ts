import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css']
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
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (this.token) {
        this.verifyEmail();
      } else {
        this.error = 'Token de vérification manquant';
        this.loading = false;
      }
    });
  }

  verifyEmail() {
    this.authService.verifyEmail(this.token).subscribe({
      next: (response: any) => {
        this.success = true;
        this.loading = false;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err: any) => {
        // Extraire le message d'erreur de différentes façons possibles
        let errorMessage = 'Erreur lors de la vérification. Le lien peut être expiré ou invalide.';
        
        if (err && err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          } else if (err.error.error) {
            errorMessage = err.error.error;
          }
        } else if (err && err.message) {
          errorMessage = err.message;
        }
        
        // Messages d'erreur spécifiques
        if (errorMessage.includes('expired') || errorMessage.includes('expiré')) {
          errorMessage = 'Le lien de vérification a expiré. Veuillez vous inscrire à nouveau.';
        } else if (errorMessage.includes('Invalid') || errorMessage.includes('invalide')) {
          errorMessage = 'Le lien de vérification est invalide. Veuillez vérifier votre email ou vous inscrire à nouveau.';
        } else if (errorMessage.includes('not found') || errorMessage.includes('introuvable')) {
          errorMessage = 'Token de vérification introuvable. Veuillez vous inscrire à nouveau.';
        }
        
        this.error = errorMessage;
        this.loading = false;
      }
    });
  }
}
