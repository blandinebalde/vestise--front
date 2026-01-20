import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { NavigationService } from '../../../services/navigation.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.forgotPasswordForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return 'L\'email est requis';
    }
    if (field.errors['email']) {
      return 'L\'email doit être un email valide';
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

  onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulaire invalide',
        text: 'Veuillez entrer un email valide.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    this.loading = true;
    const email = this.forgotPasswordForm.get('email')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (response: any) => {
        this.loading = false;
        
        // Vérifier si la réponse indique un succès (peut être un objet ou une chaîne)
        const successMessage = response?.message || response?.text || response || 'Email envoyé avec succès';
        
        // Afficher la popup de succès avec SweetAlert
        Swal.fire({
          icon: 'success',
          title: 'Email envoyé ! 📧',
          html: `
            <div style="text-align: left; padding: 1rem 0;">
              <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                Un lien de réinitialisation a été envoyé avec <strong>succès</strong>.
              </p>
              <div style="background: #f0f9ff; border-left: 4px solid #007bff; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <p style="margin: 0.5rem 0;"><strong>📧 Email envoyé à :</strong></p>
                <p style="margin: 0.5rem 0; font-weight: 600; color: #007bff;">${email}</p>
              </div>
              <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                  <strong>📋 Instructions :</strong>
                </p>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
                  <li>Vérifiez votre boîte de réception</li>
                  <li>Vérifiez aussi votre dossier spam/courrier indésirable</li>
                  <li>Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe</li>
                  <li>Le lien est valide pendant <strong>1 heure</strong></li>
                </ul>
              </div>
            </div>
          `,
          confirmButtonText: 'Retour à la connexion',
          confirmButtonColor: '#007bff',
          width: '600px',
          customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            htmlContainer: 'swal-custom-html'
          },
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then((result) => {
          if (result.isConfirmed) {
            // Rediriger vers la page de connexion
            this.router.navigate(['/login']);
          }
        });
        
        // Réinitialiser le formulaire
        this.forgotPasswordForm.reset();
        this.initForm();
      },
      error: (err) => {
        this.loading = false;
        
        // Vérifier si c'est en fait un succès (parfois les réponses sont dans error)
        if (err && err.error) {
          // Si err.error contient un text avec un message de succès, c'est un succès
          if (err.error.text && typeof err.error.text === 'string' && 
              (err.error.text.includes('sent') || err.error.text.includes('envoyé'))) {
            const successMessage = err.error.text;
            
            Swal.fire({
              icon: 'success',
              title: 'Email envoyé ! 📧',
              html: `
                <div style="text-align: left; padding: 1rem 0;">
                  <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                    Un lien de réinitialisation a été envoyé avec <strong>succès</strong>.
                  </p>
                  <div style="background: #f0f9ff; border-left: 4px solid #007bff; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                    <p style="margin: 0.5rem 0;"><strong>📧 Email envoyé à :</strong></p>
                    <p style="margin: 0.5rem 0; font-weight: 600; color: #007bff;">${email}</p>
                  </div>
                  <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                      <strong>📋 Instructions :</strong>
                    </p>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
                      <li>Vérifiez votre boîte de réception</li>
                      <li>Vérifiez aussi votre dossier spam/courrier indésirable</li>
                      <li>Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe</li>
                      <li>Le lien est valide pendant <strong>1 heure</strong></li>
                    </ul>
                  </div>
                </div>
              `,
              confirmButtonText: 'Retour à la connexion',
              confirmButtonColor: '#007bff',
              width: '600px',
              customClass: {
                popup: 'swal-custom-popup',
                title: 'swal-custom-title',
                htmlContainer: 'swal-custom-html'
              },
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then((result) => {
              if (result.isConfirmed) {
                this.router.navigate(['/login']);
              }
            });
            
            this.forgotPasswordForm.reset();
            this.initForm();
            return;
          }
        }
        
        // Extraire le message d'erreur correctement
        let errorMessage = 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer.';
        
        if (err) {
          if (err.error) {
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else if (err.error.message) {
              errorMessage = err.error.message;
            } else if (typeof err.error === 'object') {
              // Ignorer les objets vides
              if (Object.keys(err.error).length > 0 && !err.error.text) {
                try {
                  const errorStr = JSON.stringify(err.error);
                  if (errorStr !== '{}' && errorStr.length < 200) {
                    errorMessage = errorStr;
                  }
                } catch (e) {
                  // Utiliser le message par défaut
                }
              }
            }
          } else if (err.message) {
            errorMessage = err.message;
          } else if (typeof err === 'string') {
            errorMessage = err;
          }
        }
        
        // Afficher une popup d'erreur avec SweetAlert
        Swal.fire({
          icon: 'error',
          title: 'Erreur d\'envoi',
          html: `
            <div style="text-align: left; padding: 0.5rem 0;">
              <p style="margin-bottom: 0.5rem; font-size: 1rem; color: #333;">
                ${errorMessage}
              </p>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                Vérifiez que :
              </p>
              <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
                <li>L'adresse email est correcte</li>
                <li>L'adresse email est associée à un compte existant</li>
                <li>Votre connexion internet est active</li>
              </ul>
            </div>
          `,
          confirmButtonText: 'Réessayer',
          confirmButtonColor: '#dc3545',
          showCancelButton: true,
          cancelButtonText: 'Retour à la connexion',
          cancelButtonColor: '#6c757d',
          width: '500px'
        }).then((result) => {
          if (result.dismiss === Swal.DismissReason.cancel) {
            this.router.navigate(['/login']);
          }
        });
      }
    });
  }

  get f() { return this.forgotPasswordForm.controls; }
}
