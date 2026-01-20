import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
// Déclaration pour SweetAlert2 (CDN)

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  accountType: 'CLIENT' | 'VENDEUR' = 'CLIENT';
  registerForm!: FormGroup;
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZÀ-ÿ\s]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZÀ-ÿ\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      whatsapp: [''],
      address: [''],
      password: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator() });

    // Ajouter les validations conditionnelles pour vendeur
    this.updateVendeurValidations();
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
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');
      if (!password || !confirmPassword) {
        return null;
      }
      return password.value === confirmPassword.value ? null : { passwordMismatch: true };
    };
  }

  updateVendeurValidations() {
    const phoneControl = this.registerForm.get('phone');
    const whatsappControl = this.registerForm.get('whatsapp');
    const addressControl = this.registerForm.get('address');

    if (this.accountType === 'VENDEUR') {
      phoneControl?.setValidators([Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]+$/)]);
      whatsappControl?.setValidators([Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]+$/)]);
      addressControl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      phoneControl?.clearValidators();
      whatsappControl?.clearValidators();
      addressControl?.clearValidators();
    }

    phoneControl?.updateValueAndValidity();
    whatsappControl?.updateValueAndValidity();
    addressControl?.updateValueAndValidity();
  }

  selectAccountType(type: 'CLIENT' | 'VENDEUR') {
    this.accountType = type;
    this.error = '';
    
    // Réinitialiser les champs spécifiques au vendeur
    if (type === 'CLIENT') {
      this.registerForm.patchValue({
        phone: '',
        address: '',
        whatsapp: ''
      });
    }
    
    this.updateVendeurValidations();
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return `${this.getFieldLabel(fieldName)} est requis`;
    }
    if (field.errors['email']) {
      return 'Email invalide';
    }
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `${this.getFieldLabel(fieldName)} doit contenir au moins ${min} caractères`;
    }
    if (field.errors['pattern']) {
      if (fieldName === 'firstName' || fieldName === 'lastName') {
        return 'Seuls les lettres et espaces sont autorisés';
      }
      if (fieldName === 'phone' || fieldName === 'whatsapp') {
        return 'Format de numéro invalide';
      }
    }
    if (field.errors['passwordStrength']) {
      return 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
    }
    if (this.registerForm.errors && this.registerForm.errors['passwordMismatch'] && fieldName === 'confirmPassword') {
      return 'Les mots de passe ne correspondent pas';
    }
    return '';
  }

  getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      firstName: 'Le prénom',
      lastName: 'Le nom',
      email: 'L\'email',
      phone: 'Le téléphone',
      whatsapp: 'Le WhatsApp',
      address: 'L\'adresse',
      password: 'Le mot de passe',
      confirmPassword: 'La confirmation du mot de passe'
    };
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.error = '';
    this.loading = true;

    const formValue = this.registerForm.value;
    const registerData: any = {
      accountType: this.accountType,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password
    };

    if (this.accountType === 'VENDEUR') {
      registerData.phone = formValue.phone;
      registerData.address = formValue.address;
      registerData.whatsapp = formValue.whatsapp;
    }

    this.authService.register(registerData).subscribe({
      next: (response: any) => {
        this.loading = false;
        
        // Vérifier si la réponse contient un message de succès
        const successMessage = response?.message || 'Inscription réussie !';
        const userEmail = formValue.email;
        const accountTypeLabel = this.accountType === 'CLIENT' ? 'Client' : 'Vendeur';
        
        // Afficher la popup de succès avec SweetAlert
        Swal.fire({
          icon: 'success',
          title: 'Inscription réussie ! 🎉',
          html: `
            <div style="text-align: left; padding: 1rem 0;">
              <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                Félicitations ! Votre compte <strong>${accountTypeLabel}</strong> a été créé avec succès.
              </p>
              <div style="background: #f0f9ff; border-left: 4px solid #007bff; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <p style="margin: 0.5rem 0;"><strong>📧 Email de vérification envoyé</strong></p>
                <p style="margin: 0.5rem 0; color: #666;">Un email a été envoyé à :</p>
                <p style="margin: 0.5rem 0; font-weight: 600; color: #007bff;">${userEmail}</p>
              </div>
              <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                  <strong>⚠️ Important :</strong> Veuillez vérifier votre boîte mail et cliquer sur le lien de vérification pour activer votre compte.
                </p>
                <p style="margin: 0.5rem 0; font-size: 0.9rem; color: #999;">
                  Le lien est valide pendant 24 heures.
                </p>
              </div>
            </div>
          `,
          confirmButtonText: 'Vérifier mon email',
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
        this.registerForm.reset();
        this.accountType = 'CLIENT';
        this.initForm();
      },
      error: (err) => {
        this.loading = false;
        
        // Extraire le message d'erreur correctement
        let errorMessage = 'Erreur lors de l\'inscription. Veuillez réessayer.';
        
        if (err) {
          // Si err.error existe
          if (err.error) {
            // Si err.error est une chaîne
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            }
            // Si err.error a une propriété message
            else if (err.error.message) {
              errorMessage = err.error.message;
            }
            // Si err.error est un objet, essayer de le convertir en JSON lisible
            else if (typeof err.error === 'object') {
              try {
                const errorStr = JSON.stringify(err.error);
                // Si c'est un objet vide ou complexe, utiliser un message générique
                if (errorStr === '{}' || errorStr.length > 200) {
                  errorMessage = 'Erreur lors de l\'inscription. Veuillez vérifier vos informations et réessayer.';
                } else {
                  errorMessage = errorStr;
                }
              } catch (e) {
                errorMessage = 'Erreur lors de l\'inscription. Veuillez réessayer.';
              }
            }
          }
          // Si err.message existe directement
          else if (err.message) {
            errorMessage = err.message;
          }
          // Si err est directement une chaîne
          else if (typeof err === 'string') {
            errorMessage = err;
          }
        }
        
        this.error = errorMessage;
        
        // Afficher une popup d'erreur avec SweetAlert
        Swal.fire({
          icon: 'error',
          title: 'Erreur d\'inscription',
          html: `
            <div style="text-align: left; padding: 0.5rem 0;">
              <p style="margin-bottom: 0.5rem; font-size: 1rem; color: #333;">
                ${errorMessage}
              </p>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                Si le problème persiste, vérifiez que :
              </p>
              <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
                <li>Votre email n'est pas déjà utilisé</li>
                <li>Tous les champs requis sont remplis</li>
                <li>Votre connexion internet est active</li>
              </ul>
            </div>
          `,
          confirmButtonText: 'Réessayer',
          confirmButtonColor: '#dc3545',
          width: '500px'
        });
      }
    });
  }
}
