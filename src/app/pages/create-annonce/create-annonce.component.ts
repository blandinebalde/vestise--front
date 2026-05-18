import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AnnonceService, AnnonceValidationResponse } from '../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../services/tarif.service';
import { CategoryService, Category } from '../../services/category.service';
import { CreditService } from '../../services/credit.service';
import { AuthService } from '../../services/auth.service';
import { SellerPlanService, SellerSubscriptionStatus } from '../../services/seller-plan.service';
import {
  AnnonceImportService,
  ImportFileAnalysis,
  ImportPreviewRow,
  ResolvedAnnonceImport
} from '../../services/annonce-import.service';
import { concatMap, from, last, tap } from 'rxjs';
import Swal from 'sweetalert2';

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TOTAL_STEPS = 4;

export interface CreateAnnonceErrors {
  title?: string;
  description?: string;
  price?: string;
  categoryId?: string;
  publicationType?: string;
  paymentMethod?: string;
  photos?: string;
  originalPrice?: string;
  latitude?: string;
  longitude?: string;
}

/** Messages d'erreur explicites pour l'API */
const ERROR_MESSAGES: Record<string, string> = {
  'Solde insuffisant': 'Votre solde de crédits est insuffisant pour ce type de publication. Achetez des crédits puis réessayez.',
  'insuffisant': 'Votre solde de crédits est insuffisant pour ce type de publication. Achetez des crédits puis réessayez.',
  'Limite du plan': 'Vous avez atteint le quota de publications actives de votre plan. Passez au plan Pro ou Premium, ou désactivez des annonces.',
  'publications actives': 'Quota de publications actives atteint pour votre plan vendeur. Consultez la page Abonnement pour changer de plan.',
  'credit': 'Problème de crédits. Vérifiez votre solde ou achetez des crédits.',
  'Category not found': 'La catégorie choisie n\'existe plus. Rechargez la page et sélectionnez une autre catégorie.',
  'Tarif not found': 'Le type de publication n\'est plus disponible. Rechargez la page et choisissez un autre type.',
  'inconnu ou inactif': 'Ce type de publication n\'existe pas ou n\'est plus proposé. Rechargez la page.',
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
  planStatus: SellerSubscriptionStatus | null = null;
  /** CREDITS ou SUBSCRIPTION à l'enregistrement */
  publicationPaymentMethod: 'CREDITS' | 'SUBSCRIPTION' = 'CREDITS';
  readonly MAX_ANNONCE_DAYS = 365;
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
  serverWarnings: Record<string, string> = {};
  stepValidating = false;
  /** Feedback fichier refusé (type ou taille) */
  fileRejectMessage = '';
  /** Import Excel / PDF */
  importAnalysis: ImportFileAnalysis | null = null;
  importParsing = false;
  importTemplateBusy = false;
  importSuccessMessage = '';
  /** Lignes sélectionnées dans l’aperçu (numéro de ligne fichier). */
  importSelectedLines = new Set<number>();
  /** Publication groupée après validation de l’aperçu. */
  importBatchActive = false;
  importBatchRows: ResolvedAnnonceImport[] = [];
  importBatchPublishing = false;
  importBatchProgress = '';
  readonly MAX_FILE_SIZE_MB = 5;
  readonly MAX_PHOTOS = 5;
  readonly ALLOWED_EXT = 'JPG, PNG, WebP, GIF';
  readonly totalSteps = TOTAL_STEPS;

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private categoryService: CategoryService,
    private creditService: CreditService,
    private sellerPlanService: SellerPlanService,
    private authService: AuthService,
    private annonceImportService: AnnonceImportService,
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
    this.sellerPlanService.getStatus().subscribe({
      next: (s) => {
        this.planStatus = s;
        this.creditBalance = s.creditBalance;
      },
      error: () => {}
    });
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

  selectPublicationType(tarif: PublicationTarif): void {
    this.annonce.publicationType = tarif.typeName;
    this.updateSelectedTarif();
  }

  isTarifSelected(t: PublicationTarif): boolean {
    return this.annonce.publicationType === t.typeName;
  }

  durationLabel(t: PublicationTarif): string {
    if (t.durationDays != null && t.durationDays > 0) {
      return t.durationDays + ' j';
    }
    return 'Illimité';
  }

  get creditCost(): number {
    if (this.importBatchActive && this.importBatchRows.length > 0) {
      return this.importBatchRows.reduce(
        (sum, row) => sum + this.tarifCreditPrice(row.publicationType),
        0
      );
    }
    return this.tarifCreditPrice(this.annonce.publicationType);
  }

  private tarifCreditPrice(typeName: string): number {
    const t = this.tarifs.find((x) => x.typeName === typeName);
    if (!t || t.price == null) return 0;
    return typeof t.price === 'number' ? t.price : Number(t.price);
  }

  get hasEnoughCredits(): boolean {
    return this.creditBalance >= this.creditCost;
  }

  get importPreviewRows(): ImportPreviewRow[] {
    return this.importAnalysis?.previews ?? [];
  }

  get importValidRowCount(): number {
    return this.importPreviewRows.filter((p) => p.resolved && p.errors.length === 0).length;
  }

  get importErrorRowCount(): number {
    return this.importPreviewRows.filter((p) => p.errors.length > 0 || !p.resolved).length;
  }

  get importSelectedCount(): number {
    return this.importSelectedLines.size;
  }

  get importBatchTopCount(): number {
    return this.importBatchRows.filter((row) => this.isTopPublicationType(row.publicationType)).length;
  }

  private isTopPublicationType(typeName: string): boolean {
    return !!this.tarifs.find((t) => t.typeName === typeName)?.topPublication;
  }

  get canPublishBatchWithSubscription(): boolean {
    if (!this.canUseSubscription) {
      return false;
    }
    const ps = this.planStatus;
    if (!ps) {
      return false;
    }
    if (!ps.unlimitedPublications) {
      const needed = (ps.activePublicationsCount ?? 0) + this.importBatchRows.length;
      if (needed > (ps.maxActivePublications ?? 0)) {
        return false;
      }
    }
    if (this.importBatchTopCount > (ps.boostsRemaining ?? 0)) {
      return false;
    }
    return true;
  }

  get paysWithSubscription(): boolean {
    return this.publicationPaymentMethod === 'SUBSCRIPTION';
  }

  get canUseSubscription(): boolean {
    const s = this.planStatus;
    return !!s?.canPayWithSubscription;
  }

  get subscriptionQuotaReached(): boolean {
    const s = this.planStatus;
    if (!s || s.unlimitedPublications) {
      return false;
    }
    return !s.canPayWithSubscription && !!s.subscriptionPeriodActive;
  }

  get selectedTarifIsTop(): boolean {
    return !!this.selectedTarif?.topPublication;
  }

  get hasBoostForTop(): boolean {
    const s = this.planStatus;
    return (s?.boostsRemaining ?? 0) > 0;
  }

  get canPublishWithCurrentPayment(): boolean {
    if (this.importBatchActive && this.importBatchRows.length > 0) {
      if (this.paysWithSubscription) {
        return this.canPublishBatchWithSubscription;
      }
      return this.hasEnoughCredits;
    }
    if (this.paysWithSubscription) {
      if (!this.canUseSubscription) {
        return false;
      }
      if (this.selectedTarifIsTop && !this.hasBoostForTop) {
        return false;
      }
      return true;
    }
    return this.hasEnoughCredits;
  }

  selectPaymentMethod(method: 'CREDITS' | 'SUBSCRIPTION'): void {
    if (method === 'SUBSCRIPTION' && !this.canUseSubscription) {
      return;
    }
    this.publicationPaymentMethod = method;
  }

  validateStep1(): boolean {
    if (this.importBatchActive) {
      if (this.importBatchRows.length === 0) {
        this.error = 'Aucune annonce sélectionnée dans l’import.';
        return false;
      }
      return true;
    }
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
    return Object.keys(this.errors).length === 0;
  }

  validateStep2Visibility(): boolean {
    this.errors = {};
    if (!this.importBatchActive && !(this.annonce.publicationType || '').trim()) {
      this.errors['publicationType'] = 'Veuillez choisir un type de publication.';
    }
    if (this.paysWithSubscription && !this.canUseSubscription) {
      this.errors['paymentMethod'] =
        'Abonnement indisponible (quota ou période). Choisissez les crédits ou changez de plan.';
    } else if (!this.paysWithSubscription && this.creditCost > 0 && !this.hasEnoughCredits) {
      this.errors['paymentMethod'] = `Solde insuffisant (${this.creditCost} cr. requis, ${this.creditBalance} cr. disponibles).`;
    } else if (
      !this.importBatchActive &&
      this.paysWithSubscription &&
      this.selectedTarifIsTop &&
      !this.hasBoostForTop
    ) {
      this.errors['publicationType'] =
        'Aucun boost top publication restant. Payez en crédits ou choisissez un autre type.';
    } else if (this.importBatchActive && this.paysWithSubscription && !this.canPublishBatchWithSubscription) {
      if (this.importBatchTopCount > (this.planStatus?.boostsRemaining ?? 0)) {
        this.errors['publicationType'] =
          `Top publications : ${this.importBatchTopCount} requis, ${this.planStatus?.boostsRemaining ?? 0} boost(s) restant(s).`;
      } else {
        this.errors['paymentMethod'] =
          'Quota de publications insuffisant pour publier toutes les annonces importées.';
      }
    }
    return Object.keys(this.errors).length === 0;
  }

  validateStep3Photos(): boolean {
    if (this.importBatchActive) {
      this.errors = {};
      return true;
    }
    this.errors = {};
    if (this.photoFiles.length === 0) {
      this.errors['photos'] = 'Ajoutez au moins une photo.';
    }
    return Object.keys(this.errors).length === 0;
  }

  goToStep(step: number): void {
    if (this.stepValidating) {
      return;
    }
    if (step >= 1 && step <= TOTAL_STEPS && step < this.currentStep) {
      this.currentStep = step;
      this.error = '';
    }
  }

  nextStep(): void {
    if (this.stepValidating) {
      return;
    }
    if (this.currentStep === 1) {
      if (!this.validateStep1()) {
        return;
      }
      if (this.importBatchActive) {
        this.currentStep = 2;
        return;
      }
      this.stepValidating = true;
      this.error = '';
      this.annonceService.validateCreateDetails(this.buildPayload()).subscribe({
        next: (res) => {
          this.stepValidating = false;
          if (!this.applyValidationResponse(res)) {
            return;
          }
          this.currentStep = 2;
        },
        error: (err) => {
          this.stepValidating = false;
          this.showErrorPopup(this.getApiErrorMessage(err));
        }
      });
      return;
    }
    if (this.currentStep === 2) {
      if (!this.validateStep2Visibility()) {
        return;
      }
      if (this.importBatchActive) {
        this.currentStep = 3;
        return;
      }
      this.stepValidating = true;
      this.error = '';
      this.annonceService.validateCreateVisibility(this.buildPayload()).subscribe({
        next: (res) => {
          this.stepValidating = false;
          if (!this.applyValidationResponse(res)) {
            return;
          }
          this.currentStep = 3;
        },
        error: (err) => {
          this.stepValidating = false;
          this.showErrorPopup(this.getApiErrorMessage(err));
        }
      });
      return;
    }
    if (this.currentStep === 3) {
      if (!this.validateStep3Photos()) {
        return;
      }
      if (this.importBatchActive) {
        this.currentStep = 4;
        return;
      }
      this.stepValidating = true;
      this.error = '';
      this.annonceService.validateCreatePhotos(this.photoFiles).subscribe({
        next: (res) => {
          this.stepValidating = false;
          if (!this.applyValidationResponse(res)) {
            return;
          }
          this.currentStep = 4;
        },
        error: (err) => {
          this.stepValidating = false;
          this.showErrorPopup(this.getApiErrorMessage(err));
        }
      });
      return;
    }
    if (this.currentStep < TOTAL_STEPS) {
      this.currentStep++;
    }
  }

  private buildPayload(): Record<string, unknown> {
    return {
      ...this.annonce,
      images: [] as string[],
      paymentMethod: this.publicationPaymentMethod
    };
  }

  private applyValidationResponse(res: AnnonceValidationResponse): boolean {
    this.errors = {};
    this.serverWarnings = res.warnings ?? {};
    if (res.valid) {
      return true;
    }
    const errs = res.errors ?? {};
    for (const [key, msg] of Object.entries(errs)) {
      if (key === '_form') {
        this.error = msg;
      } else {
        (this.errors as Record<string, string>)[key] = msg;
      }
    }
    if (!this.error && Object.keys(this.errors).length > 0) {
      this.error = 'Corrigez les champs signalés avant de continuer.';
    }
    this.scrollToError = true;
    return false;
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
    if (this.importBatchActive && this.importBatchRows.length > 0) {
      this.publishImportBatch();
      return;
    }
    if (this.paysWithSubscription) {
      if (!this.canUseSubscription) {
        this.error = this.planStatus?.subscriptionPeriodActive === false
          ? 'Votre abonnement n\'est plus actif. Renouvelez-le ou payez en crédits.'
          : `Quota du plan ${this.planStatus?.planLabel ?? ''} atteint (${this.planStatus?.activePublicationsCount}/${this.planStatus?.maxActivePublications} publications actives).`;
        Swal.fire({
          title: 'Abonnement',
          text: this.error,
          icon: 'warning',
          confirmButtonText: 'Voir l\'abonnement',
          showCancelButton: true,
          cancelButtonText: 'Fermer'
        }).then((r) => {
          if (r.isConfirmed) {
            this.router.navigate(['/monetisation'], { queryParams: { tab: 'abonnement' } });
          }
        });
        return;
      }
      if (this.selectedTarifIsTop && !this.hasBoostForTop) {
        this.error = 'Aucun boost top publication restant sur votre plan ce mois-ci. Choisissez un autre type ou payez en crédits.';
        this.showErrorPopup(this.error);
        return;
      }
    } else if (!this.hasEnoughCredits) {
      this.error = `Solde insuffisant : il vous faut ${this.creditCost} crédits (votre solde : ${this.creditBalance} crédits). Rendez-vous dans « Acheter des crédits » pour recharger votre compte.`;
      this.showErrorPopup(this.error);
      return;
    }
    if (!this.validateStep1() || !this.validateStep2Visibility() || !this.validateStep3Photos()) {
      this.error = 'Veuillez corriger les champs signalés en rouge avant de publier.';
      this.showErrorPopup(this.error);
      return;
    }
    this.loading = true;
    this.loadingPhase = 'creating';
    const payload = this.buildPayload();
    this.annonceService.validateCreateConfirm(payload).subscribe({
      next: (confirmRes) => {
        if (!confirmRes.valid) {
          this.loading = false;
          this.loadingPhase = 'idle';
          this.applyValidationResponse(confirmRes);
          this.showErrorPopup(this.error || 'Publication impossible : vérifiez vos informations.');
          return;
        }
        this.createAfterValidation(payload);
      },
      error: (err) => {
        this.loading = false;
        this.loadingPhase = 'idle';
        this.showErrorPopup(this.getApiErrorMessage(err));
      }
    });
  }

  private createAfterValidation(payload: Record<string, unknown>): void {
    this.annonceService.createAnnonce(payload).subscribe({
      next: (createdAnnonce) => {
        if (this.photoFiles.length > 0) {
          this.loadingPhase = 'uploading';
          this.annonceService.uploadPhotos(createdAnnonce.publicId, this.photoFiles).subscribe({
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

  get stepProgressPercent(): number {
    return ((this.currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
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
    if (err?.status === 422) {
      if (str) return str;
      return ERROR_MESSAGES['Solde insuffisant'];
    }
    if (err?.status === 0 || str === 'Http failure response for') return ERROR_MESSAGES['Network Error'];
    if (err?.status === 400 && !str) return 'Données invalides. Vérifiez le titre, le prix, la catégorie et le type de publication.';
    return str || 'Une erreur est survenue. Vérifiez vos informations et réessayez.';
  }

  private finishSuccess(createdAnnonce: any) {
    this.loading = false;
    this.loadingPhase = 'idle';
    if (!this.paysWithSubscription) {
      this.creditBalance -= this.creditCost;
      this.authService.refreshCreditBalance(this.creditBalance);
    } else if (this.planStatus && this.selectedTarifIsTop) {
      this.planStatus = {
        ...this.planStatus,
        boostsRemaining: Math.max(0, (this.planStatus.boostsRemaining ?? 0) - 1)
      };
    }
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

  async downloadImportTemplateXlsx(): Promise<void> {
    if (!this.categories.length) {
      this.showErrorPopup('Chargement des catégories en cours ou liste vide.');
      return;
    }
    this.importTemplateBusy = true;
    try {
      await this.annonceImportService.downloadExcelTemplate(this.categories);
    } catch (e) {
      this.showErrorPopup(`Modèle Excel : ${(e as Error).message || 'erreur'}`);
    } finally {
      this.importTemplateBusy = false;
    }
  }

  downloadImportTemplatePdf(): void {
    if (!this.categories.length) {
      this.showErrorPopup('Chargement des catégories en cours ou liste vide.');
      return;
    }
    try {
      this.annonceImportService.downloadPdfTemplate(this.categories);
    } catch (e) {
      this.showErrorPopup(`Modèle PDF : ${(e as Error).message || 'erreur'}`);
    }
  }

  async onImportFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importParsing = true;
    this.importAnalysis = null;
    this.importSuccessMessage = '';
    this.importBatchActive = false;
    this.importBatchRows = [];
    this.importSelectedLines.clear();
    try {
      const pubNames = this.tarifs.map((t) => t.typeName);
      this.importAnalysis = await this.annonceImportService.analyzeImportFile(file, this.categories, pubNames);
      this.selectAllValidImportRows();
    } catch (e) {
      this.importAnalysis = {
        fileName: file.name,
        format: 'unknown',
        headersFound: [],
        previews: [],
        firstValidPreviewIndex: null,
        globalErrors: [(e as Error).message || 'Erreur de lecture du fichier.']
      };
    } finally {
      this.importParsing = false;
    }
  }

  isImportRowSelectable(row: ImportPreviewRow): boolean {
    return !!row.resolved && row.errors.length === 0;
  }

  isImportRowSelected(lineNumber: number): boolean {
    return this.importSelectedLines.has(lineNumber);
  }

  toggleImportRowSelection(row: ImportPreviewRow): void {
    if (!this.isImportRowSelectable(row)) {
      return;
    }
    if (this.importSelectedLines.has(row.lineNumber)) {
      this.importSelectedLines.delete(row.lineNumber);
    } else {
      this.importSelectedLines.add(row.lineNumber);
    }
  }

  selectAllValidImportRows(): void {
    this.importSelectedLines.clear();
    for (const row of this.importPreviewRows) {
      if (this.isImportRowSelectable(row)) {
        this.importSelectedLines.add(row.lineNumber);
      }
    }
  }

  clearImportRowSelection(): void {
    this.importSelectedLines.clear();
  }

  getSelectedImportRows(): ResolvedAnnonceImport[] {
    if (!this.importAnalysis) {
      return [];
    }
    return this.importAnalysis.previews
      .filter((p) => this.importSelectedLines.has(p.lineNumber) && p.resolved)
      .map((p) => p.resolved!);
  }

  importRowCategoryName(row: ImportPreviewRow): string {
    if (!row.resolved) {
      return '—';
    }
    return this.annonceImportService.categoryLabel(row.resolved.categoryId, this.categories);
  }

  importRowConditionLabel(row: ImportPreviewRow): string {
    if (!row.resolved) {
      return '—';
    }
    return this.annonceImportService.conditionLabel(row.resolved.condition);
  }

  getImportCategoryLabel(categoryId: number): string {
    return this.annonceImportService.categoryLabel(categoryId, this.categories);
  }

  confirmImportBatch(): void {
    const rows = this.getSelectedImportRows();
    if (!rows.length) {
      this.showErrorPopup('Sélectionnez au moins une ligne valide dans l’aperçu.');
      return;
    }
    this.importBatchActive = true;
    this.importBatchRows = rows;
    this.importSuccessMessage = `${rows.length} annonce(s) validée(s) — choisissez le mode de paiement puis confirmez la publication.`;
    this.error = '';
    this.currentStep = 2;
  }

  applyImportRowToForm(row: ImportPreviewRow): void {
    if (!row.resolved) {
      return;
    }
    this.importBatchActive = false;
    this.importBatchRows = [];
    this.annonceImportService.applyToAnnonce(this.annonce, row.resolved);
    this.updateSelectedTarif();
    this.importSuccessMessage = `Ligne ${row.lineNumber} appliquée au formulaire manuel.`;
  }

  cancelImportBatch(): void {
    this.importBatchActive = false;
    this.importBatchRows = [];
    this.importSuccessMessage = '';
  }

  clearImportState(): void {
    this.importAnalysis = null;
    this.importSuccessMessage = '';
    this.importSelectedLines.clear();
    this.cancelImportBatch();
  }

  importFormatLabel(f: string): string {
    if (f === 'excel') return 'Excel';
    if (f === 'pdf') return 'PDF';
    return f;
  }

  private publishImportBatch(): void {
    if (!this.validateStep1() || !this.validateStep2Visibility()) {
      this.showErrorPopup(this.error || 'Vérifiez la sélection et le mode de paiement.');
      return;
    }
    if (!this.canPublishWithCurrentPayment) {
      this.showErrorPopup(
        this.paysWithSubscription
          ? 'Publication impossible : quota abonnement ou boosts insuffisants pour toutes les annonces.'
          : `Solde insuffisant : ${this.creditCost} cr. requis pour ${this.importBatchRows.length} annonce(s).`
      );
      return;
    }

    this.loading = true;
    this.loadingPhase = 'creating';
    this.importBatchPublishing = true;
    let created = 0;
    let creditsSpent = 0;
    let topsUsed = 0;

    from(this.importBatchRows)
      .pipe(
        concatMap((row, index) => {
          this.importBatchProgress = `Publication ${index + 1} / ${this.importBatchRows.length}…`;
          const payload = this.annonceImportService.buildCreatePayload(row, this.publicationPaymentMethod);
          return this.annonceService.validateCreateConfirm(payload).pipe(
            concatMap((confirmRes) => {
              if (!confirmRes.valid) {
                const msg =
                  Object.values(confirmRes.errors ?? {}).join(' ') ||
                  `Ligne « ${row.title} » : validation refusée.`;
                throw new Error(msg);
              }
              return this.annonceService.createAnnonce(payload).pipe(
                tap(() => {
                  created++;
                  if (!this.paysWithSubscription) {
                    creditsSpent += this.tarifCreditPrice(row.publicationType);
                  } else if (this.isTopPublicationType(row.publicationType)) {
                    topsUsed++;
                  }
                })
              );
            })
          );
        }),
        last()
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.loadingPhase = 'idle';
          this.importBatchPublishing = false;
          this.importBatchProgress = '';
          if (!this.paysWithSubscription && creditsSpent > 0) {
            this.creditBalance -= creditsSpent;
            this.authService.refreshCreditBalance(this.creditBalance);
          } else if (this.planStatus && topsUsed > 0) {
            this.planStatus = {
              ...this.planStatus,
              boostsRemaining: Math.max(0, (this.planStatus.boostsRemaining ?? 0) - topsUsed),
              activePublicationsCount: (this.planStatus.activePublicationsCount ?? 0) + created
            };
          } else if (this.planStatus) {
            this.planStatus = {
              ...this.planStatus,
              activePublicationsCount: (this.planStatus.activePublicationsCount ?? 0) + created
            };
          }
          Swal.fire(
            'Import terminé',
            `${created} annonce(s) créée(s). Ajoutez les photos depuis votre tableau de bord si besoin.`,
            'success'
          ).then(() => this.router.navigate(['/dashboard']));
        },
        error: (err) => {
          this.loading = false;
          this.loadingPhase = 'idle';
          this.importBatchPublishing = false;
          this.importBatchProgress = '';
          const partial =
            created > 0
              ? `${created} annonce(s) publiée(s) avant l’erreur. `
              : '';
          this.showErrorPopup(partial + this.getApiErrorMessage(err));
        }
      });
  }
}
