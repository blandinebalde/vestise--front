import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../../../services/tarif.service';
import { CategoryService, Category } from '../../../../services/category.service';
import { AdminService } from '../../../../services/admin.service';
import { API_BASE_URL } from '../../../../config/api.config';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-annonces-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-annonces-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminAnnoncesContentComponent implements OnInit {
  allAnnonces: Annonce[] = [];
  filteredAnnonces: Annonce[] = [];
  searchQuery = '';
  tarifs: PublicationTarif[] = [];
  categories: Category[] = [];
  annonceForm!: FormGroup;
  editingAnnonce: Annonce | null = null;
  showAnnonceForm = false;
  /** Annonce affichée dans la popup détails */
  detailAnnonce: Annonce | null = null;
  showDetailPopup = false;
  /** Index de l'image affichée en grand dans la popup détails */
  detailSelectedImageIndex = 0;
  /** IDs des annonces dont l'image n'a pas pu être chargée */
  imageFailedIds = new Set<number>();

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private categoryService: CategoryService,
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
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
      location: [''],
      sellerId: [null]
    });
    this.loadAnnonces();
    this.loadTarifs();
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => this.categories = categories,
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  loadAnnonces() {
    this.imageFailedIds.clear();
    this.annonceService.getAllAnnoncesForAdmin(0, 100).subscribe({
      next: (response) => {
        this.allAnnonces = response.content;
        this.applySearch();
      },
      error: (err) => console.error('Error loading annonces:', err)
    });
  }

  applySearch() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredAnnonces = [...this.allAnnonces];
      return;
    }
    this.filteredAnnonces = this.allAnnonces.filter(a =>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.code && a.code.toLowerCase().includes(q)) ||
      (a.sellerName && a.sellerName.toLowerCase().includes(q)) ||
      (a.categoryName && a.categoryName.toLowerCase().includes(q)) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q))
    );
  }

  onSearchChange() {
    this.applySearch();
  }

  openDetailPopup(annonce: Annonce) {
    this.detailAnnonce = annonce;
    this.detailSelectedImageIndex = 0;
    this.showDetailPopup = true;
  }

  closeDetailPopup() {
    this.showDetailPopup = false;
    this.detailAnnonce = null;
    this.detailSelectedImageIndex = 0;
  }

  selectDetailImage(index: number) {
    this.detailSelectedImageIndex = index;
  }

  loadTarifs() {
    this.tarifService.getAdminTarifs(0, 100).subscribe({
      next: (response) => { this.tarifs = response.content; },
      error: () => this.tarifService.getTarifs().subscribe({ next: (t) => { this.tarifs = t; } })
    });
  }

  getImageUrl(image: string | undefined): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    const path = image.startsWith('/') ? image.slice(1) : image;
    return `${API_BASE_URL}/${path}`;
  }

  onImageError(annonceId: number) {
    this.imageFailedIds.add(annonceId);
  }

  imageFailed(annonceId: number): boolean {
    return this.imageFailedIds.has(annonceId);
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PENDING': 'En attente', 'APPROVED': 'Approuvée', 'REJECTED': 'Rejetée',
      'SOLD': 'Vendue', 'EXPIRED': 'Expirée'
    };
    return labels[status] || status;
  }

  isPublicationTypeNotInTarifs(): boolean {
    if (!this.editingAnnonce?.publicationType) return false;
    return !this.tarifs.some(t => t.typeName === this.editingAnnonce!.publicationType);
  }

  openAnnonceForm(annonce?: Annonce) {
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
        location: annonce.location || '',
        sellerId: annonce.sellerId
      });
    } else {
      const defaultType = this.tarifs.length > 0 ? this.tarifs[0].typeName : '';
      const defaultCategoryId = this.categories.length > 0 ? this.categories[0].id : null;
      this.annonceForm.reset({
        categoryId: defaultCategoryId,
        publicationType: defaultType,
        status: 'PENDING',
        condition: 'OCCASION',
        price: 0,
        sellerId: null
      });
    }
    this.showAnnonceForm = true;
  }

  saveAnnonce() {
    if (this.annonceForm.invalid) {
      this.annonceForm.markAllAsTouched();
      return;
    }
    const data = this.annonceForm.value;
    if (this.editingAnnonce) {
      this.adminService.updateAnnonce(this.editingAnnonce.id, data).subscribe({
        next: () => {
          Swal.fire('Succès', 'Annonce mise à jour', 'success');
          this.loadAnnonces();
          this.showAnnonceForm = false;
        },
        error: (err) => Swal.fire('Erreur', err?.error?.message || 'Erreur mise à jour', 'error')
      });
    } else {
      this.adminService.createAnnonce(data).subscribe({
        next: () => {
          Swal.fire('Succès', 'Annonce créée', 'success');
          this.loadAnnonces();
          this.showAnnonceForm = false;
        },
        error: (err) => Swal.fire('Erreur', err?.error?.message || 'Création non disponible', 'error')
      });
    }
  }

  approveAnnonce(id: number) {
    this.annonceService.approveAnnonce(id).subscribe({
      next: () => this.loadAnnonces(),
      error: () => alert('Erreur lors de l\'approbation')
    });
  }

  rejectAnnonce(id: number) {
    this.annonceService.rejectAnnonce(id).subscribe({
      next: () => this.loadAnnonces(),
      error: () => alert('Erreur lors du rejet')
    });
  }

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
          next: () => { Swal.fire('Supprimé !', 'Annonce supprimée', 'success'); this.loadAnnonces(); },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer', 'error')
        });
      }
    });
  }
}
