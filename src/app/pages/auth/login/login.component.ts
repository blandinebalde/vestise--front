import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
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

    // Récupérer l'URL de retour si présente
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return fieldName === 'emailOrPhone' ? 'L\'email ou le téléphone est requis' : 'Le mot de passe est requis';
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
        this.router.navigate([this.returnUrl]);
      },
      error: (err: any) => {
        this.loading = false;
        
        // Gérer les erreurs de connexion réseau (ERR_CONNECTION_REFUSED)
        if (err.status === 0 || err.message === 'ERR_CONNECTION_REFUSED' || 
            (err.message && typeof err.message === 'string' && err.message.includes('ERR_CONNECTION_REFUSED'))) {
          this.error = '❌ Impossible de se connecter au serveur.\n\n' ;
                      
          return;
        }

        // Utiliser la méthode du service pour extraire le message d'erreur
        const errorMessage = this.authService.getErrorMessage(err);
        const errorStr = typeof errorMessage === 'string' ? errorMessage : String(errorMessage || '').toLowerCase();

        // Messages d'erreur spécifiques selon le type d'erreur
        if (err.status === 0 || errorStr.includes('network') || errorStr.includes('connection')) {
          this.error = '❌ Erreur de connexion réseau. Vérifiez votre connexion internet.';
        } else if (errorStr.includes('verify') || errorStr.includes('vérif') || errorStr.includes('email')) {
          this.error = '⚠️ Veuillez vérifier votre email avant de vous connecter.\n\n' +
                      'Un lien de vérification a été envoyé à votre adresse email. ' +
                      'Vérifiez votre boîte de réception (et les spams) et cliquez sur le lien pour activer votre compte.';
        } else if (errorStr.includes('disabled') || errorStr.includes('désactivé')) {
          this.error = '🚫 Votre compte est désactivé.\n\n' +
                      'Veuillez contacter le support pour plus d\'informations.';
        } else if (err.status === 401 || errorStr.includes('unauthorized') || errorStr.includes('invalid') || 
                   errorStr.includes('incorrect') || errorStr.includes('wrong')) {
          this.error = '❌ Email/téléphone ou mot de passe incorrect.\n\n' +
                      'Vérifiez que :\n' +
                      '• L\'email ou le numéro de téléphone est correct\n' +
                      '• Le mot de passe est correct\n' +
                      '• Vous avez bien vérifié votre email';
        } else if (err.status === 403) {
          this.error = '🚫 Accès refusé.\n\n' +
                      'Votre compte n\'a pas les permissions nécessaires pour accéder à cette ressource.';
        } else if (err.status === 404) {
          this.error = '❌ Service non trouvé.\n\n' +
                      'Le service demandé n\'est pas disponible. Veuillez contacter le support.';
        } else if (err.status >= 500) {
          this.error = '⚠️ Erreur serveur.\n\n' +
                      'Le serveur rencontre un problème. Veuillez réessayer dans quelques instants ou contacter le support.';
        } else if (errorStr && errorStr.length > 0 && errorStr !== 'undefined' && errorStr !== 'null') {
          // Afficher le message d'erreur du serveur s'il existe
          this.error = errorMessage;
        } else {
          this.error = '❌ Une erreur est survenue lors de la connexion.\n\n' +
                      'Veuillez réessayer. Si le problème persiste, contactez le support.';
        }
      }
    });
  }
}
