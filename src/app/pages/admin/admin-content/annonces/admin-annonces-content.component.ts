import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { Annonce } from '../../../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../../../services/tarif.service';
import { CategoryService, Category } from '../../../../services/category.service';
import { AdminOverview, AdminService } from '../../../../services/admin.service';
import { AdminAlertsService } from '../../../../services/admin-alerts.service';
import { API_BASE_URL } from '../../../../config/api.config';
import Swal from 'sweetalert2';

export type AnnonceStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOLD' | 'EXPIRED';

@Component({
  selector: 'app-admin-annonces-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-annonces-content.component.html',
  styleUrls: ['./admin-annonces-content.component.css']
})
export class AdminAnnoncesContentComponent implements OnInit, OnDestroy {
  overview: AdminOverview | null = null;
  annonces: Annonce[] = [];
  tarifs: PublicationTarif[] = [];
  categories: Category[] = [];

  statusFilter: AnnonceStatusFilter = 'ALL';
  searchInput = '';
  page = 0;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50, 100];
  totalElements = 0;
  totalPages = 0;

  loadingOverview = true;
  loadingList = true;
  loadError = '';

  annonceForm!: FormGroup;
  editingAnnonce: Annonce | null = null;
  showAnnonceForm = false;
  detailAnnonce: Annonce | null = null;
  showDetailPopup = false;
  detailSelectedImageIndex = 0;
  imageFailedIds = new Set<string>();
  openMenuPublicId: string | null = null;

  private readonly search$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private tarifService: TarifService,
    private categoryService: CategoryService,
    private adminService: AdminService,
    private adminAlerts: AdminAlertsService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.annonceForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      categoryId: [null, Validators.required],
      publicationType: ['', Validators.required],
      status: ['PENDING', Validators.required],
      condition: ['OCCASION'],
      size: [''],
      brand: [''],
      color: [''],
      location: ['']
    });

    this.subs.add(
      this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
        this.page = 0;
        this.loadAnnonces();
      })
    );

    this.loadOverview();
    this.loadAnnonces();
    this.loadTarifs();
    this.loadCategories();
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

  loadAnnonces(): void {
    this.loadingList = true;
    this.loadError = '';
    this.adminService.getAdminAnnonces(this.page, this.pageSize, this.statusFilter, this.searchInput).subscribe({
      next: (res) => {
        this.annonces = res.content;
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.page = res.number;
        this.loadingList = false;
        this.closeRowMenu();
      },
      error: () => {
        this.loadError = 'Impossible de charger les annonces.';
        this.loadingList = false;
      }
    });
  }

  refreshAll(): void {
    this.loadOverview();
    this.loadAnnonces();
    this.adminAlerts.refresh();
  }

  setStatusFilter(filter: AnnonceStatusFilter): void {
    if (this.statusFilter === filter) {
      return;
    }
    this.statusFilter = filter;
    this.page = 0;
    this.loadAnnonces();
  }

  onSearchInput(): void {
    this.search$.next(this.searchInput);
  }

  clearSearch(): void {
    this.searchInput = '';
    this.page = 0;
    this.loadAnnonces();
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages || p === this.page) {
      return;
    }
    this.page = p;
    this.loadAnnonces();
  }

  onPageSizeChange(): void {
    this.page = 0;
    this.loadAnnonces();
  }

  countForFilter(filter: AnnonceStatusFilter): number {
    const o = this.overview;
    if (!o) {
      return 0;
    }
    switch (filter) {
      case 'ALL':
        return o.totalAnnonces;
      case 'PENDING':
        return o.annoncesPending;
      case 'APPROVED':
        return o.annoncesApproved;
      case 'REJECTED':
        return o.annoncesRejected;
      case 'SOLD':
        return o.annoncesSold;
      case 'EXPIRED':
        return o.annoncesExpired;
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

  get pageNumbers(): number[] {
    const max = 5;
    const total = this.totalPages;
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i);
    }
    let start = Math.max(0, this.page - 2);
    const end = Math.min(total - 1, start + max - 1);
    start = Math.max(0, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  statusPillClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'aa-status--pending',
      APPROVED: 'aa-status--approved',
      REJECTED: 'aa-status--rejected',
      SOLD: 'aa-status--sold',
      EXPIRED: 'aa-status--expired'
    };
    return 'aa-status ' + (map[status] || 'aa-status--default');
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  loadTarifs(): void {
    this.tarifService.getAdminTarifs(0, 100).subscribe({
      next: (response) => {
        this.tarifs = response.content;
      },
      error: () =>
        this.tarifService.getTarifs().subscribe({ next: (t) => (this.tarifs = t) })
    });
  }

  getImageUrl(image: string | undefined): string {
    if (!image) {
      return '';
    }
    if (image.startsWith('http')) {
      return image;
    }
    const path = image.startsWith('/') ? image.slice(1) : image;
    return `${API_BASE_URL}/${path}`;
  }

  onImageError(publicId: string): void {
    this.imageFailedIds.add(publicId);
  }

  imageFailed(publicId: string): boolean {
    return this.imageFailedIds.has(publicId);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'En ligne',
      REJECTED: 'Rejetée',
      SOLD: 'Vendue',
      EXPIRED: 'Expirée'
    };
    return labels[status] || status;
  }

  isRowMenuOpen(annonce: Annonce): boolean {
    return this.openMenuPublicId === annonce.publicId;
  }

  toggleRowMenu(annonce: Annonce, event: Event): void {
    event.stopPropagation();
    this.openMenuPublicId = this.openMenuPublicId === annonce.publicId ? null : annonce.publicId;
  }

  closeRowMenu(): void {
    this.openMenuPublicId = null;
  }

  isPublicationTypeNotInTarifs(): boolean {
    if (!this.editingAnnonce?.publicationType) {
      return false;
    }
    return !this.tarifs.some((t) => t.typeName === this.editingAnnonce!.publicationType);
  }

  openDetailPopup(annonce: Annonce): void {
    this.closeRowMenu();
    this.detailAnnonce = annonce;
    this.detailSelectedImageIndex = 0;
    this.showDetailPopup = true;
  }

  closeDetailPopup(): void {
    this.showDetailPopup = false;
    this.detailAnnonce = null;
    this.detailSelectedImageIndex = 0;
  }

  selectDetailImage(index: number): void {
    this.detailSelectedImageIndex = index;
  }

  openAnnonceForm(annonce?: Annonce): void {
    this.closeRowMenu();
    this.editingAnnonce = annonce ?? null;
    if (annonce) {
      this.annonceForm.patchValue({
        title: annonce.title,
        description: annonce.description || '',
        price: annonce.price,
        categoryId: annonce.categoryId ?? null,
        publicationType: annonce.publicationType,
        status: annonce.status,
        condition: annonce.condition || 'OCCASION',
        size: annonce.size || '',
        brand: annonce.brand || '',
        color: annonce.color || '',
        location: annonce.location || ''
      });
    } else {
      const defaultType = this.tarifs.length > 0 ? this.tarifs[0].typeName : '';
      const defaultCategoryId = this.categories.length > 0 ? this.categories[0].id : null;
      this.annonceForm.reset({
        categoryId: defaultCategoryId,
        publicationType: defaultType,
        status: 'PENDING',
        condition: 'OCCASION',
        price: 0
      });
    }
    this.showAnnonceForm = true;
  }

  saveAnnonce(): void {
    if (this.annonceForm.invalid) {
      this.annonceForm.markAllAsTouched();
      return;
    }
    const data = this.annonceForm.value;
    if (this.editingAnnonce) {
      this.adminService.updateAnnonce(this.editingAnnonce.publicId, data).subscribe({
        next: () => {
          Swal.fire('Succès', 'Annonce mise à jour', 'success');
          this.refreshAll();
          this.showAnnonceForm = false;
        },
        error: (err) => Swal.fire('Erreur', err?.error?.message || 'Erreur mise à jour', 'error')
      });
    } else {
      this.adminService.createAnnonce(data).subscribe({
        next: () => {
          Swal.fire('Succès', 'Annonce créée', 'success');
          this.refreshAll();
          this.showAnnonceForm = false;
        },
        error: (err) => Swal.fire('Erreur', err?.error?.message || 'Création non disponible', 'error')
      });
    }
  }

  approveAnnonce(publicId: string): void {
    this.closeRowMenu();
    this.adminService.approveAnnonce(publicId).subscribe({
      next: () => this.refreshAll(),
      error: () => Swal.fire('Erreur', "Impossible d'approuver l'annonce", 'error')
    });
  }

  rejectAnnonce(publicId: string): void {
    this.closeRowMenu();
    Swal.fire({
      title: 'Rejeter l\'annonce',
      text: 'Le motif sera visible par le vendeur.',
      input: 'textarea',
      inputLabel: 'Motif de rejet',
      inputPlaceholder: 'Ex. photos floues, description incomplète, article interdit…',
      inputAttributes: {
        'aria-label': 'Motif de rejet',
        maxlength: '1000',
        rows: '4'
      },
      inputValidator: (value) => {
        const v = (value || '').trim();
        if (!v) {
          return 'Le motif de rejet est obligatoire';
        }
        if (v.length < 10) {
          return 'Minimum 10 caractères';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Rejeter',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#dc2626'
    }).then((result) => {
      if (!result.isConfirmed || !result.value) {
        return;
      }
      this.adminService.rejectAnnonce(publicId, result.value.trim()).subscribe({
        next: () => {
          Swal.fire('Rejetée', 'L\'annonce a été rejetée avec le motif enregistré.', 'success');
          this.refreshAll();
        },
        error: (err) =>
          Swal.fire('Erreur', err?.error?.message || "Impossible de rejeter l'annonce", 'error')
      });
    });
  }

  deleteAnnonce(publicId: string): void {
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
        this.adminService.deleteAnnonce(publicId).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Annonce supprimée', 'success');
            this.refreshAll();
          },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer', 'error')
        });
      }
    });
  }
}
