import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CountryCodeService, CountryCode, getFlagEmoji } from '../../../services/country-code.service';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { formatHttpErrorForUser } from '../http-error-messages';
import Swal from 'sweetalert2';
// Déclaration pour SweetAlert2 (CDN)

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GoogleSignInComponent],
  templateUrl: './register.component.html',
  styleUrls: ['../auth-shared.css', './register.component.css']
})
export class RegisterComponent implements OnInit {
  /** 1 = type, 2 = identité, 3 = vendeur OU mot de passe (client), 4 = mot de passe (vendeur) */
  currentStep = 1;
  accountType: 'CLIENT' | 'VENDEUR' = 'CLIENT';
  registerForm!: FormGroup;
  error = '';
  loading = false;
  countryCodes: CountryCode[] = [];
  loadingCountries = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private countryCodeService: CountryCodeService
  ) {}

  ngOnInit() {
    this.initForm();
    this.countryCodeService.getCountryCodes().subscribe({
      next: (list) => {
        this.countryCodes = list;
        this.loadingCountries = false;
      },
      error: () => {
        this.loadingCountries = false;
      }
    });
  }

  initForm() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZÀ-ÿ\s]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZÀ-ÿ\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phoneCountryCode: ['+221'],
      phoneNumber: [''],
      whatsappCountryCode: ['+221'],
      whatsappNumber: [''],
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
    const phoneNumberControl = this.registerForm.get('phoneNumber');
    const whatsappNumberControl = this.registerForm.get('whatsappNumber');
    const addressControl = this.registerForm.get('address');

    if (this.accountType === 'VENDEUR') {
      phoneNumberControl?.setValidators([Validators.required, Validators.pattern(/^[0-9\s\-]+$/)]);
      whatsappNumberControl?.setValidators([Validators.required, Validators.pattern(/^[0-9\s\-]+$/)]);
      addressControl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      phoneNumberControl?.clearValidators();
      whatsappNumberControl?.clearValidators();
      addressControl?.clearValidators();
    }

    phoneNumberControl?.updateValueAndValidity();
    whatsappNumberControl?.updateValueAndValidity();
    addressControl?.updateValueAndValidity();
  }

  selectAccountType(type: 'CLIENT' | 'VENDEUR') {
    if (this.currentStep !== 1) {
      return;
    }
    this.accountType = type;
    this.error = '';

    if (type === 'CLIENT') {
      this.registerForm.patchValue({
        phoneCountryCode: '+221',
        phoneNumber: '',
        address: '',
        whatsappCountryCode: '+221',
        whatsappNumber: ''
      });
    }

    this.updateVendeurValidations();
  }

  get maxStep(): number {
    return this.accountType === 'VENDEUR' ? 4 : 3;
  }

  isLastStep(): boolean {
    return this.currentStep === this.maxStep;
  }

  stepDisplayIndex(): number {
    if (this.accountType === 'VENDEUR') {
      return this.currentStep;
    }
    return this.currentStep >= 3 ? 3 : this.currentStep;
  }

  stepDisplayTotal(): number {
    return this.accountType === 'VENDEUR' ? 4 : 3;
  }

  get stepLabels(): string[] {
    return this.accountType === 'VENDEUR'
      ? ['Type', 'Identité', 'Activité', 'Sécurité']
      : ['Type', 'Identité', 'Sécurité'];
  }

  getStepHeading(): string {
    switch (this.currentStep) {
      case 1:
        return 'Choisissez votre type de compte.';
      case 2:
        return 'Vos nom, prénom et adresse e-mail.';
      case 3:
        return this.accountType === 'VENDEUR'
          ? 'Téléphone, WhatsApp et adresse (visibles pour vos acheteurs).'
          : 'Créez un mot de passe sécurisé.';
      case 4:
        return 'Créez un mot de passe sécurisé.';
      default:
        return 'Rejoignez Vendit pour acheter ou vendre en toute simplicité.';
    }
  }

  private validatePasswordStep(): boolean {
    ['password', 'confirmPassword'].forEach((n) => this.registerForm.get(n)?.markAsTouched());
    this.registerForm.updateValueAndValidity({ onlySelf: false });
    const pw = this.registerForm.get('password');
    const cp = this.registerForm.get('confirmPassword');
    if (!pw?.valid || !cp?.valid) {
      return false;
    }
    if (this.registerForm.errors?.['passwordMismatch']) {
      return false;
    }
    return true;
  }

  validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 1:
        return true;
      case 2: {
        const names = ['firstName', 'lastName', 'email'];
        names.forEach((n) => this.registerForm.get(n)?.markAsTouched());
        return names.every((n) => this.registerForm.get(n)?.valid === true);
      }
      case 3:
        if (this.accountType === 'VENDEUR') {
          const names = ['phoneNumber', 'whatsappNumber', 'address'];
          names.forEach((n) => this.registerForm.get(n)?.markAsTouched());
          return names.every((n) => this.registerForm.get(n)?.valid === true);
        }
        return this.validatePasswordStep();
      case 4:
        return this.validatePasswordStep();
      default:
        return false;
    }
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) {
      return;
    }
    this.error = '';
    if (this.currentStep < this.maxStep) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep <= 1) {
      return;
    }
    if (this.currentStep === 3 && this.accountType === 'CLIENT') {
      this.currentStep = 2;
    } else {
      this.currentStep--;
    }
    this.error = '';
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (!field || !field.touched) {
      return '';
    }
    if (this.registerForm.errors?.['passwordMismatch'] && fieldName === 'confirmPassword') {
      return 'Les mots de passe ne correspondent pas';
    }
    if (!field.errors) {
      return '';
    }

    if (field.errors['required']) {
      return `${this.getFieldLabel(fieldName)} est requis`;
    }
    if (field.errors['email']) {
      return 'Adresse e-mail invalide.';
    }
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `${this.getFieldLabel(fieldName)} doit contenir au moins ${min} caractères`;
    }
    if (field.errors['pattern']) {
      if (fieldName === 'firstName' || fieldName === 'lastName') {
        return 'Seuls les lettres et espaces sont autorisés';
      }
      if (fieldName === 'phoneNumber' || fieldName === 'whatsappNumber') {
        return 'Format de numéro invalide';
      }
    }
    if (field.errors['passwordStrength']) {
      return 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
    }
    return '';
  }

  getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      firstName: 'Le prénom',
      lastName: 'Le nom',
      email: 'L\'email',
      phoneNumber: 'Le téléphone',
      whatsappNumber: 'Le WhatsApp',
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

  getFlagEmoji(cca2: string): string {
    return getFlagEmoji(cca2);
  }

  onSubmit() {
    if (!this.validateCurrentStep() || this.registerForm.invalid) {
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
      const phoneCode = formValue.phoneCountryCode || '';
      const phoneNum = (formValue.phoneNumber || '').replace(/\D/g, '');
      registerData.phone = phoneCode + phoneNum;
      registerData.address = formValue.address;
      const whatsappCode = formValue.whatsappCountryCode || '';
      const whatsappNum = (formValue.whatsappNumber || '').replace(/\D/g, '');
      registerData.whatsapp = whatsappCode + whatsappNum;
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
          title: 'Inscription réussie',
          html: `
            <div style="text-align: left; padding: 1rem 0;">
              <p style="margin-bottom: 1rem; font-size: 1.1rem;">
                Félicitations ! Votre compte <strong>${accountTypeLabel}</strong> a été créé avec succès.
              </p>
              <div style="background: #f0f9ff; border-left: 4px solid #007bff; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <p style="margin: 0.5rem 0;"><strong>E-mail de vérification envoyé</strong></p>
                <p style="margin: 0.5rem 0; color: #666;">Un email a été envoyé à :</p>
                <p style="margin: 0.5rem 0; font-weight: 600; color: #007bff;">${userEmail}</p>
              </div>
              <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0.5rem 0; font-size: 0.95rem; color: #666;">
                  <strong>Important :</strong> Veuillez vérifier votre boîte mail et cliquer sur le lien de vérification pour activer votre compte.
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
        
        this.registerForm.reset();
        this.accountType = 'CLIENT';
        this.currentStep = 1;
        this.initForm();
      },
      error: (err: unknown) => {
        this.loading = false;
        this.error = formatHttpErrorForUser(err, 'register');
      }
    });
  }

  onGoogleSuccess(): void {
    this.router.navigate(['/dashboard']);
  }

  onGoogleError(message: string): void {
    this.error = message;
  }
}
