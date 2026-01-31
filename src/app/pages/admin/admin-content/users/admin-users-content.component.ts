import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, User } from '../../../../services/admin.service';
import { CountryCodeService, CountryCode, getFlagEmoji } from '../../../../services/country-code.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-users-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminUsersContentComponent implements OnInit {
  users: User[] = [];
  countryCodes: CountryCode[] = [];
  userForm!: FormGroup;
  editingUser: User | null = null;
  showUserForm = false;

  constructor(
    private adminService: AdminService,
    private countryCodeService: CountryCodeService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', []],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phoneCountryCode: ['+221'],
      phoneNumber: [''],
      address: [''],
      whatsappCountryCode: ['+221'],
      whatsappNumber: [''],
      role: ['USER', Validators.required],
      enabled: [true],
      emailVerified: [false]
    });
    this.loadUsers();
    this.countryCodeService.getCountryCodes().subscribe({
      next: (list) => { this.countryCodes = list; },
      error: () => {}
    });
  }

  loadUsers() {
    this.adminService.getUsers(0, 100).subscribe({
      next: (response) => { this.users = response.content ?? []; },
      error: (err) => { console.error('Error loading users:', err); this.users = []; }
    });
  }

  trackByUserId(_index: number, user: User): number {
    return user.id;
  }

  trackByCountryCode(_index: number, cc: CountryCode): string {
    return cc.code;
  }

  openUserForm(user?: User) {
    this.editingUser = user ?? null;
    if (user) {
      const { code: phoneCode, number: phoneNum } = this.parsePhone(user.phone || '');
      const { code: whatsappCode, number: whatsappNum } = this.parsePhone(user.whatsapp || '');
      this.userForm.patchValue({
        email: user.email,
        password: '',
        firstName: user.firstName,
        lastName: user.lastName,
        phoneCountryCode: phoneCode,
        phoneNumber: phoneNum,
        address: user.address || '',
        whatsappCountryCode: whatsappCode,
        whatsappNumber: whatsappNum,
        role: user.role,
        enabled: user.enabled,
        emailVerified: user.emailVerified
      });
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    } else {
      this.userForm.reset({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneCountryCode: '+221',
        phoneNumber: '',
        address: '',
        whatsappCountryCode: '+221',
        whatsappNumber: '',
        role: 'USER',
        enabled: true,
        emailVerified: false
      });
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password')?.updateValueAndValidity();
    }
    this.showUserForm = true;
  }

  getFlagEmoji(cca2: string): string {
    return getFlagEmoji(cca2);
  }

  private parsePhone(full: string): { code: string; number: string } {
    if (!full || !full.trim()) return { code: '+221', number: '' };
    const sorted = [...this.countryCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const cc of sorted) {
      if (full.startsWith(cc.dialCode)) {
        const rest = full.slice(cc.dialCode.length).replace(/\D/g, '');
        return { code: cc.dialCode, number: rest };
      }
    }
    const digits = full.replace(/\D/g, '');
    return { code: '+221', number: digits };
  }

  saveUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    const raw = this.userForm.value;
    const userData: Partial<User> = {
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      address: raw.address,
      role: raw.role,
      enabled: raw.enabled,
      emailVerified: raw.emailVerified
    };
    const phoneNum = (raw.phoneNumber || '').replace(/\D/g, '');
    const whatsappNum = (raw.whatsappNumber || '').replace(/\D/g, '');
    userData.phone = (raw.phoneCountryCode || '') + phoneNum;
    userData.whatsapp = (raw.whatsappCountryCode || '') + whatsappNum;

    if (this.editingUser) {
      this.adminService.updateUser(this.editingUser.id, userData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Utilisateur mis à jour', 'success');
          this.loadUsers();
          this.showUserForm = false;
        },
        error: (err) => Swal.fire('Erreur', err.error?.message || 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      const password = (raw.password || '').trim();
      if (!password || password.length < 6) {
        Swal.fire('Erreur', 'Le mot de passe est requis (minimum 6 caractères)', 'error');
        return;
      }
      this.adminService.createUser({ ...userData, password }).subscribe({
        next: () => {
          Swal.fire('Succès', 'Utilisateur créé', 'success');
          this.loadUsers();
          this.showUserForm = false;
        },
        error: (err) => Swal.fire('Erreur', err.error?.message || 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteUser(id: number) {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.deleteUser(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Utilisateur supprimé', 'success');
            this.loadUsers();
          },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer l\'utilisateur', 'error')
        });
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: { [key: string]: string } = {
      'ADMIN': 'Administrateur',
      'VENDEUR': 'Vendeur',
      'USER': 'Utilisateur'
    };
    return labels[role] || role;
  }
}
