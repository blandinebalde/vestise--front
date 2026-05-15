import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AdminCategoriesOverview,
  AdminService,
  Category
} from '../../../../services/admin.service';
import Swal from 'sweetalert2';

export type CategoryActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-admin-categories-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-categories-content.component.html',
  styleUrls: [
    './admin-categories-content.component.css',
    '../../admin-dashboard/admin-dashboard.component.css'
  ]
})
export class AdminCategoriesContentComponent implements OnInit, OnDestroy {
  overview: AdminCategoriesOverview | null = null;
  categories: Category[] = [];

  activeFilter: CategoryActiveFilter = 'ALL';
  searchInput = '';
  page = 0;
  readonly pageSize = 15;
  totalElements = 0;
  totalPages = 0;

  loadingOverview = true;
  loadingList = true;
  loadError = '';

  categoryForm!: FormGroup;
  editingCategory: Category | null = null;
  showCategoryForm = false;
  openMenuCategoryId: number | null = null;

  private readonly search$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      icon: [''],
      active: [true]
    });

    this.subs.add(
      this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
        this.page = 0;
        this.loadCategories();
      })
    );

    this.loadOverview();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadOverview(): void {
    this.loadingOverview = true;
    this.adminService.getAdminCategoriesOverview().subscribe({
      next: (data) => {
        this.overview = data;
        this.loadingOverview = false;
      },
      error: () => {
        this.loadingOverview = false;
      }
    });
  }

  loadCategories(): void {
    this.loadingList = true;
    this.loadError = '';
    const activeParam =
      this.activeFilter === 'ACTIVE' ? 'true' : this.activeFilter === 'INACTIVE' ? 'false' : 'ALL';
    this.adminService.getAdminCategories(this.page, this.pageSize, activeParam, this.searchInput).subscribe({
      next: (res) => {
        this.categories = res.content ?? [];
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.page = res.number;
        this.loadingList = false;
        this.closeRowMenu();
      },
      error: () => {
        this.loadError = 'Impossible de charger les catégories.';
        this.loadingList = false;
      }
    });
  }

  refreshAll(): void {
    this.loadOverview();
    this.loadCategories();
  }

  setActiveFilter(filter: CategoryActiveFilter): void {
    if (this.activeFilter === filter) {
      return;
    }
    this.activeFilter = filter;
    this.page = 0;
    this.loadCategories();
  }

  onSearchInput(): void {
    this.search$.next(this.searchInput);
  }

  clearSearch(): void {
    this.searchInput = '';
    this.page = 0;
    this.loadCategories();
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages || p === this.page) {
      return;
    }
    this.page = p;
    this.loadCategories();
  }

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.page + 1) * this.pageSize, this.totalElements);
  }

  trackByCategoryId(_index: number, cat: Category): number {
    return cat.id;
  }

  isRowMenuOpen(cat: Category): boolean {
    return this.openMenuCategoryId === cat.id;
  }

  toggleRowMenu(cat: Category, event: Event): void {
    event.stopPropagation();
    this.openMenuCategoryId = this.openMenuCategoryId === cat.id ? null : cat.id;
  }

  closeRowMenu(): void {
    this.openMenuCategoryId = null;
  }

  openCategoryForm(category?: Category): void {
    this.closeRowMenu();
    this.editingCategory = category ?? null;
    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        active: category.active
      });
    } else {
      this.categoryForm.reset({ active: true });
    }
    this.showCategoryForm = true;
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const categoryData = this.categoryForm.value;
    if (this.editingCategory) {
      this.adminService.updateCategory(this.editingCategory.id, categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie mise à jour', 'success');
          this.showCategoryForm = false;
          this.refreshAll();
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      this.adminService.createCategory(categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie créée', 'success');
          this.showCategoryForm = false;
          this.refreshAll();
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la création', 'error')
      });
    }
  }

  activateCategory(cat: Category): void {
    this.closeRowMenu();
    this.adminService.activateCategory(cat.id).subscribe({
      next: () => {
        Swal.fire('Succès', 'Catégorie activée', 'success');
        this.refreshAll();
      },
      error: () => Swal.fire('Erreur', 'Activation impossible', 'error')
    });
  }

  deactivateCategory(cat: Category): void {
    this.closeRowMenu();
    Swal.fire({
      title: 'Désactiver cette catégorie ?',
      text: 'Elle ne sera plus proposée aux vendeurs pour de nouvelles annonces.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Désactiver',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.deactivateCategory(cat.id).subscribe({
          next: () => {
            Swal.fire('Succès', 'Catégorie désactivée', 'success');
            this.refreshAll();
          },
          error: () => Swal.fire('Erreur', 'Désactivation impossible', 'error')
        });
      }
    });
  }

  deleteCategory(cat: Category): void {
    this.closeRowMenu();
    Swal.fire({
      title: 'Supprimer cette catégorie ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.deleteCategory(cat.id).subscribe({
          next: () => {
            Swal.fire('Supprimé', 'Catégorie supprimée', 'success');
            this.refreshAll();
          },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer (annonces liées ?)', 'error')
        });
      }
    });
  }
}
