import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
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
const MAX_PHOTOS = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface CreateAnnonceErrors {
  title?: string;
  description?: string;
  price?: string;
  categoryId?: string;
  publicationType?: string;
  photos?: string;
}

/** Messages d'erreur explicites pour l'API */
const ERROR_MESSAGES: Record<string, string> = {
  'Solde insuffisant': 'Votre solde de crédits est insuffisant pour ce type de publication. Achetez des crédits puis réessayez.',
  'credit': 'Problème de crédits. Vérifiez votre solde ou achetez des crédits.',
  'Category not found': 'La catégorie choisie n\'existe plus. Rechargez la page et sélectionnez une autre catégorie.',
  'Tarif not found': 'Le type de publication n\'est plus disponible. Rechargez la page et choisissez un autre type.',
  'Forbidden': 'Vous n\'avez pas les droits pour publier une annonce. Seuls les comptes vendeur peuvent publier.',
  'Unauthorized': 'Session expirée. Reconnectez-vous puis réessayez.',
  'Network Error': 'Connexion impossible. Vérifiez votre connexion internet et réessayez.',
};

@Component({
  selector: 'app-create-annonce',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-annonce.component.html',
  styleUrls: ['./create-annonce.component.css']
})
export class CreateAnnonceComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('errorAlert') errorAlertRef?: ElementRef<HTMLElement>;
  private scrollToError = false;
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
  /** Phase du chargement : 'creating' = création annonce, 'uploading' = envoi des photos */
  loadingPhase: 'idle' | 'creating' | 'uploading' = 'idle';
  /** Chargement des données initiales (catégories, tarifs) */
  initialLoading = true;
  photoFiles: File[] = [];
  /** URLs de prévisualisation (en sync avec photoFiles) pour éviter ExpressionChangedAfterItHasBeenCheckedError */
  previewUrls: (string | null)[] = [];
  isDragging = false;
  errors: CreateAnnonceErrors = {};
  /** Feedback fichier refusé (type ou taille) */
  fileRejectMessage = '';
  optionsExpanded = false;
  readonly MAX_FILE_SIZE_MB = 5;
  readonly MAX_PHOTOS = 5;
  readonly ALLOWED_EXT = 'JPG, PNG, WebP, GIF';

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private categoryService: CategoryService,
    private creditService: CreditService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    this.initialLoading = true;
    this.creditService.getBalance().subscribe({
      next: (b) => { this.creditBalance = b; },
      error: () => {}
    });
    const user = this.authService.getCurrentUser();
    if (user?.creditBalance != null) this.creditBalance = user.creditBalance;
    this.loadCategories();
    this.loadTarifs();
  }

  private categoriesLoaded = false;
  private tarifsLoaded = false;

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        if (this.categories.length && !this.annonce.categoryId) {
          this.annonce.categoryId = this.categories[0].id;
        }
        this.categoriesLoaded = true;
        this.checkInitialLoadingDone();
      },
      error: () => {
        this.error = 'Impossible de charger les catégories. Rechargez la page.';
        this.categoriesLoaded = true;
        this.checkInitialLoadingDone();
        this.showErrorPopup(this.error);
      }
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
        this.tarifsLoaded = true;
        this.checkInitialLoadingDone();
      },
      error: () => {
        this.error = 'Impossible de charger les types de publication. Rechargez la page.';
        this.tarifsLoaded = true;
        this.checkInitialLoadingDone();
        this.showErrorPopup(this.error);
      }
    });
  }

  private checkInitialLoadingDone() {
    if (this.categoriesLoaded && this.tarifsLoaded) this.initialLoading = false;
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
    this.fileRejectMessage = '';
    const rejected: string[] = [];
    const remaining = MAX_PHOTOS - this.photoFiles.length;
    if (remaining <= 0) {
      this.fileRejectMessage = `Maximum ${MAX_PHOTOS} photos autorisées. Retirez une photo pour en ajouter une autre.`;
      return;
    }
    for (const f of files) {
      if (this.photoFiles.length >= MAX_PHOTOS) break;
      if (!ALLOWED_TYPES.includes(f.type)) {
        rejected.push(`${f.name} : format non accepté (${this.ALLOWED_EXT} uniquement).`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name} : fichier trop volumineux (max ${this.MAX_FILE_SIZE_MB} Mo).`);
        continue;
      }
      this.photoFiles.push(f);
      this.previewUrls.push(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    }
    if (this.photoFiles.length >= MAX_PHOTOS && files.length > remaining) {
      rejected.push(`Maximum ${MAX_PHOTOS} photos. Seules ${remaining} photo(s) ajoutée(s).`);
    }
    if (rejected.length > 0) {
      this.fileRejectMessage = rejected.slice(0, 3).join(' ');
      if (rejected.length > 3) this.fileRejectMessage += ` (+ ${rejected.length - 3} autre(s))`;
    }
  }

  removePhoto(index: number) {
    const url = this.previewUrls[index];
    if (url) URL.revokeObjectURL(url);
    this.previewUrls.splice(index, 1);
    this.photoFiles.splice(index, 1);
  }

  /** Retourne l'URL de prévisualisation en cache (index). Utiliser dans le template pour éviter NG0100. */
  getPreviewUrlByIndex(i: number): string | null {
    return this.previewUrls[i] ?? null;
  }

  ngOnDestroy() {
    this.previewUrls.forEach(url => url && URL.revokeObjectURL(url));
    this.previewUrls = [];
  }

  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return '';
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.name : '';
  }

  onSubmit() {
    this.error = '';
    if (!this.hasEnoughCredits) {
      this.error = `Solde insuffisant : il vous faut ${this.creditCost} crédits (votre solde : ${this.creditBalance} crédits). Rendez-vous dans « Acheter des crédits » pour recharger votre compte.`;
      this.showErrorPopup(this.error);
      return;
    }
    if (!this.validateStep1() || !this.validateStep2()) {
      this.error = 'Veuillez corriger les champs signalés en rouge avant de publier.';
      this.showErrorPopup(this.error);
      return;
    }
    this.loading = true;
    this.loadingPhase = 'creating';
    const payload = {
      ...this.annonce,
      images: [] as string[]
    };
    this.annonceService.createAnnonce(payload).subscribe({
      next: (createdAnnonce) => {
        if (this.photoFiles.length > 0) {
          this.loadingPhase = 'uploading';
          this.annonceService.uploadPhotos(createdAnnonce.id, this.photoFiles).subscribe({
            next: () => this.finishSuccess(createdAnnonce),
            error: (err) => this.finishError(err, createdAnnonce)
          });
        } else {
          this.finishSuccess(createdAnnonce);
        }
      },
      error: (err) => {
        this.loading = false;
        this.loadingPhase = 'idle';
        this.error = this.getApiErrorMessage(err);
        this.showErrorPopup(this.error);
      }
    });
  }

  /** Affiche une erreur en popup (SweetAlert2). */
  showErrorPopup(message: string): void {
    Swal.fire({
      title: 'Erreur',
      text: message,
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#D4A0A0'
    });
  }

  ngAfterViewChecked() {
    if (this.scrollToError && this.error && this.errorAlertRef?.nativeElement) {
      this.scrollToError = false;
      setTimeout(() => this.errorAlertRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }

  /** Retourne un message d'erreur explicite à partir de la réponse API */
  getApiErrorMessage(err: any): string {
    const body = err?.error;
    let str = '';
    if (typeof body === 'string') str = body;
    else if (body?.message) str = body.message;
    else if (body?.error) str = body.error;
    else if (Array.isArray(body?.errors)) str = body.errors.map((e: any) => e.defaultMessage || e.message || e).join('. ');
    else if (err?.message) str = err.message;
    str = String(str || '').trim();
    for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
      if (str.toLowerCase().includes(key.toLowerCase())) return friendly;
    }
    if (err?.status === 403) return ERROR_MESSAGES['Forbidden'];
    if (err?.status === 401) return ERROR_MESSAGES['Unauthorized'];
    if (err?.status === 0 || str === 'Http failure response for') return ERROR_MESSAGES['Network Error'];
    if (err?.status === 400 && !str) return 'Données invalides. Vérifiez le titre, le prix, la catégorie et le type de publication.';
    return str || 'Une erreur est survenue. Vérifiez vos informations et réessayez.';
  }

  private finishSuccess(createdAnnonce: any) {
    this.loading = false;
    this.loadingPhase = 'idle';
    this.creditBalance -= this.creditCost;
    this.authService.refreshCreditBalance(this.creditBalance);
    const msg = createdAnnonce.code
      ? `Votre annonce a été créée. Réf. ${createdAnnonce.code}. Elle sera publiée après modération.`
      : 'Votre annonce a été créée et sera publiée après modération.';
    Swal.fire('Succès', msg, 'success').then(() => {
      this.router.navigate(['/dashboard']);
    });
  }

  private finishError(err: any, _createdAnnonce: any) {
    this.loading = false;
    this.loadingPhase = 'idle';
    this.error = this.getApiErrorMessage(err) || 'L\'annonce a été créée mais l\'envoi des photos a échoué. Vous pourrez ajouter des photos depuis votre tableau de bord.';
    Swal.fire('Attention', this.error, 'warning').then(() => {
      this.router.navigate(['/dashboard']);
    });
  }

  cancel() {
    this.router.navigate(['/dashboard']);
  }
}
