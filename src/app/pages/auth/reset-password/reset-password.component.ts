import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { NavigationService } from '../../../services/navigation.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm!: FormGroup;
  token = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        Swal.fire({
          icon: 'error',
          title: 'Lien invalide',
          text: 'Le lien de réinitialisation est manquant ou invalide.',
          confirmButtonText: 'Retour à la connexion',
          confirmButtonColor: '#dc3545',
          allowOutsideClick: false
        }).then(() => {
          this.router.navigate(['/login']);
        });
      }
    });

    this.initForm();
  }

  initForm() {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator()]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator() });
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
      return 'Ce champ est requis';
    }
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `Le mot de passe doit contenir au moins ${min} caractères`;
    }
    if (field.errors['passwordStrength']) {
      return 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
    }
    if (this.resetPasswordForm.errors && this.resetPasswordForm.errors['passwordMismatch'] && fieldName === 'confirmPassword') {
      return 'Les mots de passe ne correspondent pas';
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

  onSubmit() {
    if (!this.token) {
      Swal.fire({
        icon: 'error',
        title: 'Lien invalide',
        text: 'Le lien de réinitialisation est manquant.',
        confirmButtonText: 'Retour à la connexion',
        confirmButtonColor: '#dc3545'
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulaire invalide',
        text: 'Veuillez corriger les erreurs dans le formulaire.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    this.loading = true;
    const newPassword = this.resetPasswordForm.get('newPassword')?.value;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: (response: any) => {
        this.loading = false;
        
        // Afficher la popup de succès avec SweetAlert
        Swal.fire({
          icon: 'success',
          title: 'Mot de passe réinitialisé ! 🔐',
          html: `
            <div style="text-align: left; padding: 1rem 0;">
              <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                Votre mot de passe a été réinitialisé avec <strong>succès</strong>.
              </p>
              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <p style="margin: 0.5rem 0; color: #155724;">
                  <strong>✅ Sécurité renforcée</strong>
                </p>
                <p style="margin: 0.5rem 0; color: #155724; font-size: 0.95rem;">
                  Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                </p>
              </div>
              <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                  <strong>💡 Conseil :</strong> Utilisez un mot de passe fort et unique pour protéger votre compte.
                </p>
              </div>
            </div>
          `,
          confirmButtonText: 'Se connecter',
          confirmButtonColor: '#28a745',
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
      },
      error: (err) => {
        this.loading = false;
        
        // Vérifier si c'est en fait un succès (parfois les réponses sont dans error)
        if (err && err.error) {
          // Si err.error contient un text avec un message de succès, c'est un succès
          if (err.error.text && typeof err.error.text === 'string' && 
              (err.error.text.includes('reset successfully') || err.error.text.includes('réinitialisé'))) {
            
            Swal.fire({
              icon: 'success',
              title: 'Mot de passe réinitialisé ! 🔐',
              html: `
                <div style="text-align: left; padding: 1rem 0;">
                  <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                    Votre mot de passe a été réinitialisé avec <strong>succès</strong>.
                  </p>
                  <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                    <p style="margin: 0.5rem 0; color: #155724;">
                      <strong>✅ Sécurité renforcée</strong>
                    </p>
                    <p style="margin: 0.5rem 0; color: #155724; font-size: 0.95rem;">
                      Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                    </p>
                  </div>
                  <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                      <strong>💡 Conseil :</strong> Utilisez un mot de passe fort et unique pour protéger votre compte.
                    </p>
                  </div>
                </div>
              `,
              confirmButtonText: 'Se connecter',
              confirmButtonColor: '#28a745',
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
            return;
          }
        }
        
        // Extraire le message d'erreur correctement
        let errorMessage = 'Erreur lors de la réinitialisation. Le lien peut être expiré ou invalide.';
        
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
          title: 'Erreur de réinitialisation',
          html: `
            <div style="text-align: left; padding: 0.5rem 0;">
              <p style="margin-bottom: 0.5rem; font-size: 1rem; color: #333;">
                ${errorMessage}
              </p>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                Causes possibles :
              </p>
              <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
                <li>Le lien de réinitialisation a expiré (valide 1 heure)</li>
                <li>Le lien a déjà été utilisé</li>
                <li>Le lien est incorrect ou invalide</li>
              </ul>
            </div>
          `,
          confirmButtonText: 'Demander un nouveau lien',
          confirmButtonColor: '#dc3545',
          showCancelButton: true,
          cancelButtonText: 'Retour à la connexion',
          cancelButtonColor: '#6c757d',
          width: '500px'
        }).then((result) => {
          if (result.isConfirmed) {
            this.router.navigate(['/forgot-password']);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            this.router.navigate(['/login']);
          }
        });
      }
    });
  }

  get f() { return this.resetPasswordForm.controls; }

  // Méthodes pour vérifier les exigences du mot de passe dans le template
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
