import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminOverview, AdminService, ActionLog, User } from '../../../../services/admin.service';
import { CountryCodeService, CountryCode, getFlagEmoji } from '../../../../services/country-code.service';
import Swal from 'sweetalert2';

export type UserRoleFilter = 'ALL' | 'ADMIN' | 'VENDEUR' | 'USER';
export type UserEnabledFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

@Component({
  selector: 'app-admin-users-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-content.component.html',
  styleUrls: [
    './admin-users-content.component.css',
    '../../admin-dashboard/admin-dashboard.component.css'
  ]
})
export class AdminUsersContentComponent implements OnInit, OnDestroy {
  overview: AdminOverview | null = null;
  users: User[] = [];
  countryCodes: CountryCode[] = [];

  roleFilter: UserRoleFilter = 'ALL';
  enabledFilter: UserEnabledFilter = 'ALL';
  searchInput = '';
  page = 0;
  readonly pageSize = 15;
  totalElements = 0;
  totalPages = 0;

  loadingOverview = true;
  loadingList = true;
  loadError = '';

  userForm!: FormGroup;
  editingUser: User | null = null;
  showUserForm = false;

  activityUser: User | null = null;
  activityLogs: ActionLog[] = [];
  activityPage = 0;
  activityTotalPages = 0;
  activityTotalElements = 0;
  loadingActivity = false;
  showActivityPanel = false;

  openMenuPublicId: string | null = null;

  private readonly search$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private adminService: AdminService,
    private countryCodeService: CountryCodeService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
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

    this.subs.add(
      this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
        this.page = 0;
        this.loadUsers();
      })
    );

    this.loadOverview();
    this.loadUsers();
    this.countryCodeService.getCountryCodes().subscribe({
      next: (list) => (this.countryCodes = list),
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadOverview(): void {
    this.loadingOverview = true;
    this.adminService.getAdminOverview().subscribe({
      next: (data) => {
        this.overview = data;
        this.loadingOverview = false;
      },
      error: () => {
        this.loadingOverview = false;
      }
    });
  }

  loadUsers(): void {
    this.loadingList = true;
    this.loadError = '';
    const enabledParam =
      this.enabledFilter === 'ACTIVE' ? 'true' : this.enabledFilter === 'DISABLED' ? 'false' : 'ALL';
    this.adminService
      .getAdminUsers(this.page, this.pageSize, this.roleFilter, enabledParam, this.searchInput)
      .subscribe({
        next: (res) => {
          this.users = res.content ?? [];
          this.totalElements = res.totalElements;
          this.totalPages = res.totalPages;
          this.page = res.number;
          this.loadingList = false;
          this.closeRowMenu();
        },
        error: () => {
          this.loadError = 'Impossible de charger les utilisateurs.';
          this.loadingList = false;
        }
      });
  }

  refreshAll(): void {
    this.loadOverview();
    this.loadUsers();
    if (this.activityUser) {
      this.loadUserActivity(this.activityUser.publicId, this.activityPage);
    }
  }

  setRoleFilter(filter: UserRoleFilter): void {
    if (this.roleFilter === filter) {
      return;
    }
    this.roleFilter = filter;
    this.page = 0;
    this.loadUsers();
  }

  setEnabledFilter(filter: UserEnabledFilter): void {
    if (this.enabledFilter === filter) {
      return;
    }
    this.enabledFilter = filter;
    this.page = 0;
    this.loadUsers();
  }

  onSearchInput(): void {
    this.search$.next(this.searchInput);
  }

  clearSearch(): void {
    this.searchInput = '';
    this.page = 0;
    this.loadUsers();
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages || p === this.page) {
      return;
    }
    this.page = p;
    this.loadUsers();
  }

  countForRole(filter: UserRoleFilter): number {
    const o = this.overview;
    if (!o) {
      return 0;
    }
    switch (filter) {
      case 'ALL':
        return o.usersTotal;
      case 'VENDEUR':
        return o.usersVendeurs;
      case 'USER':
        return o.usersClients;
      case 'ADMIN':
        return o.usersAdmins;
      default:
        return 0;
    }
  }

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.page + 1) * this.pageSize, this.totalElements);
  }

  trackByUserId(_index: number, user: User): string {
    return user.publicId;
  }

  trackByCountryCode(_index: number, cc: CountryCode): string {
    return cc.code;
  }

  trackByLogId(_index: number, log: ActionLog): number {
    return log.id;
  }

  isRowMenuOpen(user: User): boolean {
    return this.openMenuPublicId === user.publicId;
  }

  toggleRowMenu(user: User, event: Event): void {
    event.stopPropagation();
    this.openMenuPublicId = this.openMenuPublicId === user.publicId ? null : user.publicId;
  }

  closeRowMenu(): void {
    this.openMenuPublicId = null;
  }

  openActivityPanel(user: User): void {
    this.closeRowMenu();
    this.activityUser = user;
    this.activityPage = 0;
    this.showActivityPanel = true;
    this.loadUserActivity(user.publicId, 0);
  }

  closeActivityPanel(): void {
    this.showActivityPanel = false;
    this.activityUser = null;
    this.activityLogs = [];
  }

  loadUserActivity(publicId: string, page: number): void {
    this.loadingActivity = true;
    this.adminService.getUserActivity(publicId, page, 20).subscribe({
      next: (res) => {
        this.activityLogs = res.content ?? [];
        this.activityPage = res.number;
        this.activityTotalPages = res.totalPages;
        this.activityTotalElements = res.totalElements;
        this.loadingActivity = false;
      },
      error: () => {
        this.activityLogs = [];
        this.loadingActivity = false;
      }
    });
  }

  activityPrevPage(): void {
    if (this.activityUser && this.activityPage > 0) {
      this.loadUserActivity(this.activityUser.publicId, this.activityPage - 1);
    }
  }

  activityNextPage(): void {
    if (this.activityUser && this.activityPage < this.activityTotalPages - 1) {
      this.loadUserActivity(this.activityUser.publicId, this.activityPage + 1);
    }
  }

  activateUser(user: User): void {
    this.closeRowMenu();
    this.adminService.activateUser(user.publicId).subscribe({
      next: () => {
        Swal.fire('Activé', 'Le compte est actif.', 'success');
        this.refreshAll();
      },
      error: (err) =>
        Swal.fire('Erreur', err?.error?.message || "Impossible d'activer le compte", 'error')
    });
  }

  deactivateUser(user: User): void {
    this.closeRowMenu();
    if (user.role === 'ADMIN') {
      Swal.fire('Refusé', 'Un administrateur ne peut pas être désactivé.', 'warning');
      return;
    }
    Swal.fire({
      title: 'Désactiver ce compte ?',
      text: "L'utilisateur ne pourra plus se connecter (sessions invalidées).",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Désactiver',
      cancelButtonText: 'Annuler'
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.deactivateUser(user.publicId).subscribe({
          next: () => {
            Swal.fire('Désactivé', 'Le compte est désactivé.', 'success');
            this.refreshAll();
          },
          error: (err) =>
            Swal.fire('Erreur', err?.error?.message || 'Impossible de désactiver', 'error')
        });
      }
    });
  }

  getFlagEmoji(cca2: string): string {
    return getFlagEmoji(cca2);
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      ADMIN: 'Administrateur',
      VENDEUR: 'Vendeur',
      USER: 'Acheteur'
    };
    return labels[role] || role;
  }

  getActivitySuccessLabel(log: ActionLog): string {
    return log.success ? 'OK' : 'Échec';
  }

  openUserForm(user?: User): void {
    this.closeRowMenu();
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

  private parsePhone(full: string): { code: string; number: string } {
    if (!full || !full.trim()) {
      return { code: '+221', number: '' };
    }
    const sorted = [...this.countryCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const cc of sorted) {
      if (full.startsWith(cc.dialCode)) {
        const rest = full.slice(cc.dialCode.length).replace(/\D/g, '');
        return { code: cc.dialCode, number: rest };
      }
    }
    return { code: '+221', number: full.replace(/\D/g, '') };
  }

  saveUser(): void {
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
      this.adminService.updateUser(this.editingUser.publicId, userData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Utilisateur mis à jour', 'success');
          this.refreshAll();
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
          this.refreshAll();
          this.showUserForm = false;
        },
        error: (err) => Swal.fire('Erreur', err.error?.message || 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteUser(publicId: string): void {
    this.closeRowMenu();
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
        this.adminService.deleteUser(publicId).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Utilisateur supprimé', 'success');
            this.refreshAll();
          },
          error: () => Swal.fire('Erreur', "Impossible de supprimer l'utilisateur", 'error')
        });
      }
    });
  }
}
