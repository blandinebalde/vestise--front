import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AnnonceService, AnnonceSellerUpdate } from '../../services/annonce.service';
import { CategoryService, Category } from '../../services/category.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modifier-annonce',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './modifier-annonce.component.html',
  styleUrls: ['./modifier-annonce.component.css']
})
export class ModifierAnnonceComponent implements OnInit {
  publicId = '';
  loading = true;
  saving = false;
  error = '';
  categories: Category[] = [];

  model = {
    title: '',
    description: '',
    price: null as number | null,
    categoryId: null as number | null,
    condition: '' as string,
    size: '',
    brand: '',
    color: '',
    location: '',
    toutDoitPartir: false,
    originalPrice: null as number | null,
    isLot: false,
    acceptPaymentOnDelivery: false,
    latitude: null as number | null,
    longitude: null as number | null
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private annonceService: AnnonceService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    if (!this.publicId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.categoryService.getCategories().subscribe({
      next: (c) => (this.categories = c ?? []),
      error: () => (this.categories = [])
    });
    this.annonceService.getMyAnnonce(this.publicId).subscribe({
      next: (a) => {
        this.model.title = a.title ?? '';
        this.model.description = a.description ?? '';
        this.model.price = a.price != null ? Number(a.price) : null;
        this.model.categoryId = a.categoryId ?? null;
        this.model.condition = (a.condition as string) ?? '';
        this.model.size = a.size ?? '';
        this.model.brand = a.brand ?? '';
        this.model.color = a.color ?? '';
        this.model.location = a.location ?? '';
        this.model.toutDoitPartir = !!a.toutDoitPartir;
        this.model.originalPrice = a.originalPrice != null ? Number(a.originalPrice) : null;
        this.model.isLot = !!a.isLot;
        this.model.acceptPaymentOnDelivery = !!a.acceptPaymentOnDelivery;
        this.model.latitude = a.latitude ?? null;
        this.model.longitude = a.longitude ?? null;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger cette annonce.';
        this.loading = false;
      }
    });
  }

  save(): void {
    if (this.saving) return;
    const t = this.model.title.trim();
    if (!t) {
      Swal.fire({ icon: 'warning', title: 'Titre requis', text: 'Indiquez un titre pour votre annonce.' });
      return;
    }
    if (this.model.price == null || this.model.price <= 0) {
      Swal.fire({ icon: 'warning', title: 'Prix invalide', text: 'Indiquez un prix supérieur à 0.' });
      return;
    }
    if (this.model.categoryId == null) {
      Swal.fire({ icon: 'warning', title: 'Catégorie', text: 'Choisissez une catégorie.' });
      return;
    }

    const body: AnnonceSellerUpdate = {
      title: t,
      description: (this.model.description ?? '').trim(),
      price: this.model.price,
      categoryId: this.model.categoryId,
      size: this.model.size.trim() || undefined,
      brand: this.model.brand.trim() || undefined,
      color: this.model.color.trim() || undefined,
      location: this.model.location.trim() || undefined,
      toutDoitPartir: this.model.toutDoitPartir,
      originalPrice: this.model.originalPrice ?? undefined,
      isLot: this.model.isLot,
      acceptPaymentOnDelivery: this.model.acceptPaymentOnDelivery,
      latitude: this.model.latitude ?? undefined,
      longitude: this.model.longitude ?? undefined
    };
    const c = this.model.condition?.trim();
    if (c) {
      body.condition = c;
    }

    this.saving = true;
    this.error = '';
    this.annonceService.updateMyAnnonce(this.publicId, body).subscribe({
      next: () => {
        this.saving = false;
        Swal.fire({ icon: 'success', title: 'Enregistré', timer: 1600, showConfirmButton: false });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.saving = false;
        const msg =
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : null) ||
          'La modification a échoué.';
        this.error = msg;
        Swal.fire({ icon: 'error', title: 'Erreur', text: msg });
      }
    });
  }
}
