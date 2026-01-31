import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AnnonceService } from '../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../services/tarif.service';
import { CategoryService, Category } from '../../services/category.service';
import { CreditService } from '../../services/credit.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface CreateAnnonceErrors {
  title?: string;
  description?: string;
  price?: string;
  categoryId?: string;
  publicationType?: string;
  photos?: string;
}

@Component({
  selector: 'app-create-annonce',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-annonce.component.html',
  styleUrls: ['./create-annonce.component.css']
})
export class CreateAnnonceComponent implements OnInit {
  currentStep = 1;
  annonce: any = {
    title: '',
    description: '',
    price: null as number | null,
    categoryId: null as number | null,
    publicationType: '',
    condition: '',
    size: '',
    brand: '',
    color: '',
    location: '',
    images: [] as string[],
    toutDoitPartir: false,
    originalPrice: null as number | null,
    isLot: false,
    acceptPaymentOnDelivery: false,
    latitude: null as number | null,
    longitude: null as number | null
  };
  categories: Category[] = [];
  tarifs: PublicationTarif[] = [];
  selectedTarif: PublicationTarif | null = null;
  creditBalance = 0;
  error = '';
  loading = false;
  photoFiles: File[] = [];
  isDragging = false;
  errors: CreateAnnonceErrors = {};

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private categoryService: CategoryService,
    private creditService: CreditService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadTarifs();
    this.creditService.getBalance().subscribe({
      next: (b) => { this.creditBalance = b; },
      error: () => {}
    });
    const user = this.authService.getCurrentUser();
    if (user?.creditBalance != null) this.creditBalance = user.creditBalance;
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        if (this.categories.length && !this.annonce.categoryId) {
          this.annonce.categoryId = this.categories[0].id;
        }
      },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  loadTarifs() {
    this.tarifService.getTarifs().subscribe({
      next: (tarifs) => {
        this.tarifs = tarifs.filter(t => t.active);
        if (this.tarifs.length && !this.annonce.publicationType) {
          this.annonce.publicationType = this.tarifs[0].typeName;
        }
        this.updateSelectedTarif();
      },
      error: (err) => console.error('Error loading tarifs:', err)
    });
  }

  updateSelectedTarif() {
    this.selectedTarif = this.tarifs.find(t => t.typeName === this.annonce.publicationType) || null;
  }

  onPublicationTypeChange() {
    this.updateSelectedTarif();
  }

  get creditCost(): number {
    const t = this.selectedTarif;
    if (!t || t.price == null) return 0;
    return typeof t.price === 'number' ? t.price : Number(t.price);
  }

  get hasEnoughCredits(): boolean {
    return this.creditBalance >= this.creditCost;
  }

  validateStep1(): boolean {
    this.errors = {};
    const title = (this.annonce.title || '').trim();
    if (!title) {
      this.errors['title'] = 'Le titre est obligatoire.';
    } else if (title.length > MAX_TITLE) {
      this.errors['title'] = `Le titre ne doit pas dépasser ${MAX_TITLE} caractères.`;
    }
    const desc = (this.annonce.description || '').trim();
    if (desc.length > MAX_DESC) {
      this.errors['description'] = `La description ne doit pas dépasser ${MAX_DESC} caractères.`;
    }
    const price = this.annonce.price;
    if (price == null || price === '' || Number(price) < 1) {
      this.errors['price'] = 'Le prix doit être supérieur à 0.';
    }
    if (!this.annonce.categoryId) {
      this.errors['categoryId'] = 'Veuillez choisir une catégorie.';
    }
    if (!(this.annonce.publicationType || '').trim()) {
      this.errors['publicationType'] = 'Veuillez choisir un type de publication.';
    }
    return Object.keys(this.errors).length === 0;
  }

  validateStep2(): boolean {
    this.errors = {};
    if (this.photoFiles.length === 0) {
      this.errors['photos'] = 'Ajoutez au moins une photo.';
    }
    return Object.keys(this.errors).length === 0;
  }

  nextStep() {
    if (this.currentStep === 1 && !this.validateStep1()) return;
    if (this.currentStep === 2 && !this.validateStep2()) return;
    if (this.currentStep < 3) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files) this.addFiles(Array.from(event.dataTransfer.files));
  }

  private addFiles(files: File[]) {
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) continue;
      if (f.size > MAX_FILE_SIZE) continue;
      this.photoFiles.push(f);
    }
  }

  removePhoto(index: number) {
    this.photoFiles.splice(index, 1);
  }

  getPreviewUrl(file: File): string | null {
    if (!file.type.startsWith('image/')) return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }

  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return '';
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.name : '';
  }

  onSubmit() {
    this.error = '';
    if (!this.hasEnoughCredits) {
      this.error = `Solde insuffisant. Il vous faut ${this.creditCost} crédits (votre solde : ${this.creditBalance}). Achetez des crédits pour continuer.`;
      return;
    }
    if (!this.validateStep1() || !this.validateStep2()) {
      this.error = 'Veuillez corriger les erreurs avant de publier.';
      return;
    }
    this.loading = true;
    const payload = {
      ...this.annonce,
      images: [] as string[]
    };
    this.annonceService.createAnnonce(payload).subscribe({
      next: (createdAnnonce) => {
        if (this.photoFiles.length > 0) {
          this.annonceService.uploadPhotos(createdAnnonce.id, this.photoFiles).subscribe({
            next: () => this.finishSuccess(createdAnnonce),
            error: (err) => this.finishError(err, createdAnnonce)
          });
        } else {
          this.finishSuccess(createdAnnonce);
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création de l\'annonce. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  private finishSuccess(createdAnnonce: any) {
    this.loading = false;
    this.creditBalance -= this.creditCost;
    this.authService.refreshCreditBalance(this.creditBalance);
    const msg = createdAnnonce.code
      ? `Votre annonce a été créée. Réf. ${createdAnnonce.code}. Elle sera publiée après modération.`
      : 'Votre annonce a été créée et sera publiée après modération.';
    Swal.fire('Succès', msg, 'success').then(() => {
      this.router.navigate(['/dashboard']);
    });
  }

  private finishError(err: any, createdAnnonce: any) {
    this.loading = false;
    this.error = err.error?.message || 'Annonce créée mais l\'upload des photos a échoué. Vous pouvez ajouter des photos depuis le tableau de bord.';
    Swal.fire('Attention', this.error, 'warning').then(() => {
      this.router.navigate(['/dashboard']);
    });
  }

  cancel() {
    this.router.navigate(['/dashboard']);
  }
}
