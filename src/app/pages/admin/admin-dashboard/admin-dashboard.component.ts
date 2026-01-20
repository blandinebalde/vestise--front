import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AnnonceService, Annonce } from '../../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../../services/tarif.service';
import { AdminService, User, Category } from '../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab = 'annonces';
  allAnnonces: Annonce[] = [];
  tarifs: PublicationTarif[] = [];
  users: User[] = [];
  categories: Category[] = [];
  totalAnnonces = 0;
  pendingAnnonces = 0;
  totalUsers = 0;
  dailyRevenue = 0;
  weeklyRevenue = 0;
  monthlyRevenue = 0;
  topViewedCount = 0;
  
  // Forms
  userForm!: FormGroup;
  categoryForm!: FormGroup;
  tarifForm!: FormGroup;
  
  // Editing states
  editingUser: User | null = null;
  editingCategory: Category | null = null;
  editingTarif: PublicationTarif | null = null;
  showUserForm = false;
  showCategoryForm = false;
  showTarifForm = false;

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.initForms();
    this.loadAnnonces();
    this.loadTarifs();
    this.loadUsers();
    this.loadCategories();
    this.loadStats();
  }

  initForms() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: [''],
      address: [''],
      whatsapp: [''],
      role: ['USER', Validators.required],
      enabled: [true],
      emailVerified: [false]
    });

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      icon: [''],
      active: [true]
    });

    this.tarifForm = this.fb.group({
      publicationType: ['STANDARD', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      durationDays: [30, [Validators.required, Validators.min(1)]],
      active: [true]
    });
  }

  loadAnnonces() {
    this.annonceService.getAllAnnoncesForAdmin(0, 100).subscribe({
      next: (response) => {
        this.allAnnonces = response.content;
        this.totalAnnonces = response.totalElements;
        this.pendingAnnonces = this.allAnnonces.filter(a => a.status === 'PENDING').length;
      },
      error: (err) => {
        console.error('Error loading annonces:', err);
      }
    });
  }

  loadTarifs() {
    this.tarifService.getAdminTarifs().subscribe({
      next: (tarifs) => {
        this.tarifs = tarifs;
      },
      error: (err) => {
        console.error('Error loading tarifs:', err);
        // Fallback sur l'endpoint public si l'admin échoue
        this.tarifService.getTarifs().subscribe({
          next: (tarifs) => {
            this.tarifs = tarifs;
          }
        });
      }
    });
  }

  loadStats() {
    // TODO: Implémenter les vraies statistiques depuis l'API
    this.monthlyRevenue = 150000;
    this.weeklyRevenue = 37500;
    this.dailyRevenue = 5000;
    this.topViewedCount = 25;
    this.totalUsers = 150;
  }

  approveAnnonce(id: number) {
    this.annonceService.approveAnnonce(id).subscribe({
      next: () => {
        this.loadAnnonces();
      },
      error: (err) => {
        console.error('Error approving annonce:', err);
        alert('Erreur lors de l\'approbation');
      }
    });
  }

  rejectAnnonce(id: number) {
    this.annonceService.rejectAnnonce(id).subscribe({
      next: () => {
        this.loadAnnonces();
      },
      error: (err) => {
        console.error('Error rejecting annonce:', err);
        alert('Erreur lors du rejet');
      }
    });
  }

  updateTarif(tarif: PublicationTarif) {
    this.tarifService.updateTarif(tarif.id, tarif.price, tarif.durationDays, tarif.active).subscribe({
      next: (updated) => {
        // Mettre à jour le tarif dans la liste
        const index = this.tarifs.findIndex(t => t.id === tarif.id);
        if (index !== -1) {
          this.tarifs[index] = updated;
        }
      },
      error: (err) => {
        console.error('Error updating tarif:', err);
        alert('Erreur lors de la mise à jour du tarif');
      }
    });
  }

  getImageUrl(image: string | undefined): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    return `http://localhost:8080/${image}`;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PENDING': 'En attente',
      'APPROVED': 'Approuvée',
      'REJECTED': 'Rejetée',
      'SOLD': 'Vendue',
      'EXPIRED': 'Expirée'
    };
    return labels[status] || status;
  }

  getPublicationTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'STANDARD': 'Standard',
      'PREMIUM': 'Premium',
      'TOP_PUB': 'Top Pub'
    };
    return labels[type] || type;
  }

  // ========== USERS CRUD ==========
  loadUsers() {
    this.adminService.getUsers(0, 100).subscribe({
      next: (response) => {
        this.users = response.content;
        this.totalUsers = response.totalElements;
      },
      error: (err) => console.error('Error loading users:', err)
    });
  }

  openUserForm(user?: User) {
    this.editingUser = user || null;
    if (user) {
      this.userForm.patchValue({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        address: user.address || '',
        whatsapp: user.whatsapp || '',
        role: user.role,
        enabled: user.enabled,
        emailVerified: user.emailVerified
      });
    } else {
      this.userForm.reset({
        role: 'USER',
        enabled: true,
        emailVerified: false
      });
    }
    this.showUserForm = true;
  }

  saveUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const userData = this.userForm.value;
    if (this.editingUser) {
      this.adminService.updateUser(this.editingUser.id, userData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Utilisateur mis à jour', 'success');
          this.loadUsers();
          this.showUserForm = false;
        },
        error: (err) => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
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
          error: (err) => Swal.fire('Erreur', 'Impossible de supprimer l\'utilisateur', 'error')
        });
      }
    });
  }

  // ========== CATEGORIES CRUD ==========
  loadCategories() {
    this.adminService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  openCategoryForm(category?: Category) {
    this.editingCategory = category || null;
    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        active: category.active
      });
    } else {
      this.categoryForm.reset({
        active: true
      });
    }
    this.showCategoryForm = true;
  }

  saveCategory() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const categoryData = this.categoryForm.value;
    if (this.editingCategory) {
      this.adminService.updateCategory(this.editingCategory.id, categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie mise à jour', 'success');
          this.loadCategories();
          this.showCategoryForm = false;
        },
        error: (err) => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      this.adminService.createCategory(categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie créée', 'success');
          this.loadCategories();
          this.showCategoryForm = false;
        },
        error: (err) => Swal.fire('Erreur', 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteCategory(id: number) {
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
        this.adminService.deleteCategory(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Catégorie supprimée', 'success');
            this.loadCategories();
          },
          error: (err) => Swal.fire('Erreur', 'Impossible de supprimer la catégorie', 'error')
        });
      }
    });
  }

  // ========== TARIFS CRUD ==========
  openTarifForm(tarif?: PublicationTarif) {
    this.editingTarif = tarif || null;
    if (tarif) {
      this.tarifForm.patchValue({
        publicationType: tarif.publicationType,
        price: tarif.price,
        durationDays: tarif.durationDays,
        active: tarif.active
      });
    } else {
      this.tarifForm.reset({
        publicationType: 'STANDARD',
        price: 0,
        durationDays: 30,
        active: true
      });
    }
    this.showTarifForm = true;
  }

  saveTarif() {
    if (this.tarifForm.invalid) {
      this.tarifForm.markAllAsTouched();
      return;
    }

    const tarifData = this.tarifForm.value;
    if (this.editingTarif) {
      this.tarifService.updateTarif(this.editingTarif.id, tarifData.price, tarifData.durationDays, tarifData.active).subscribe({
        next: () => {
          Swal.fire('Succès', 'Tarif mis à jour', 'success');
          this.loadTarifs();
          this.showTarifForm = false;
        },
        error: (err) => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      this.adminService.createTarif(tarifData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Tarif créé', 'success');
          this.loadTarifs();
          this.showTarifForm = false;
        },
        error: (err) => Swal.fire('Erreur', 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteTarif(id: number) {
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
        this.adminService.deleteTarif(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Tarif supprimé', 'success');
            this.loadTarifs();
          },
          error: (err) => Swal.fire('Erreur', 'Impossible de supprimer le tarif', 'error')
        });
      }
    });
  }

  // ========== ANNONCES CRUD ==========
  deleteAnnonce(id: number) {
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
        this.adminService.deleteAnnonce(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Annonce supprimée', 'success');
            this.loadAnnonces();
          },
          error: (err) => Swal.fire('Erreur', 'Impossible de supprimer l\'annonce', 'error')
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
