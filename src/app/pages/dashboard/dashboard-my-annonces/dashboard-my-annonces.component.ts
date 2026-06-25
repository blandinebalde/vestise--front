import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AnnonceService, Annonce, MyAnnoncesSummary } from '../../../services/annonce.service';
import { CreditLedgerEntry } from '../../../services/credit.service';
import Swal from 'sweetalert2';
import {
  getDashboardImageUrl,
  getPublicationTypeClass,
  getPublicationTypeLabel,
  getStatusLabel
} from '../dashboard-view.utils';

@Component({
  selector: 'app-dashboard-my-annonces',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-my-annonces.component.html',
  styleUrls: ['./dashboard-my-annonces.component.css', '../dashboard.component.css']
})
export class DashboardMyAnnoncesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() annonces: Annonce[] = [];
  @Input() creditLedger: CreditLedgerEntry[] = [];
  /** Affiche l'état vide « première annonce » (vendeur uniquement). */
  @Input() showVendeurEmptyState = false;
  /** Colonne actions enrichie (vendeur) : modifier, supprimer, photos, lien… */
  @Input() vendeurActions = false;
  /** Compteurs pour les pastilles de filtre (tableau de bord vendeur). */
  @Input() sellerSummary: MyAnnoncesSummary | null = null;
  /** Filtre statut imposé (ex. PENDING sur le dashboard) — masque la barre de filtres. */
  @Input() lockedStatusFilter: string | null = null;
  /** Filtre statut initial (page Mes annonces, ex. depuis un lien ?status=PENDING). */
  @Input() initialStatusFilter: string | null = null;
  /** Affiche la colonne latérale « Crédits ». */
  @Input() showCreditLedger = true;
  /** Affiche recherche + filtres par statut. */
  @Input() showToolbar = true;
  /** Titre de la section liste. */
  @Input() sectionTitle = 'Mes annonces';

  @Output() listChanged = new EventEmitter<void>();

  @ViewChild('photoPicker') photoPicker?: ElementRef<HTMLInputElement>;

  private pendingPhotoPublicId: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** Annonce affichée dans la popup « Détails » (vendeur). */
  detailPopupAnnonce: Annonce | null = null;

  /** Menu « ⋮ » ouvert pour cette annonce (publicId). */
  openMenuPublicId: string | null = null;

  /**
   * Position calculée (fixed) du menu déroulant : évite que le conteneur scrollable
   * de la table (overflow) ne rogne le menu. Recalculée à chaque ouverture.
   */
  menuStyle: { [key: string]: string } = {};

  /** Liste serveur (mode vendeur). */
  pagedAnnonces: Annonce[] = [];
  loadingList = false;
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  statusFilter: string = 'ALL';
  searchDraft = '';
  searchApplied = '';

  readonly statusFilters: { id: string; label: string }[] = [
    { id: 'ALL', label: 'Toutes' },
    { id: 'PENDING', label: 'En attente' },
    { id: 'APPROVED', label: 'En ligne' },
    { id: 'RESERVED', label: 'Réservées' },
    { id: 'REJECTED', label: 'Rejetées' },
    { id: 'SOLD', label: 'Vendues' },
    { id: 'EXPIRED', label: 'Expirées' }
  ];

  readonly pageSizeOptions = [10, 20, 50];

  getImageUrl = getDashboardImageUrl;
  getPublicationTypeLabel = getPublicationTypeLabel;
  getPublicationTypeClass = getPublicationTypeClass;
  getStatusLabel = getStatusLabel;

  ledgerMovementLabel(type: string): string {
    switch (type) {
      case 'CREDIT_PURCHASE':
        return 'Achat de crédits';
      case 'DEBIT_PUBLICATION':
        return 'Publication (annonce)';
      default:
        return type;
    }
  }

  constructor(private annonceService: AnnonceService) {}

  trackByPublicId(_index: number, a: Annonce): string {
    return a.publicId;
  }

  toggleRowMenu(a: Annonce, ev: Event): void {
    ev.stopPropagation();
    const id = a.publicId;
    if (this.openMenuPublicId === id) {
      this.openMenuPublicId = null;
      return;
    }
    this.openMenuPublicId = id;
    const trigger = (ev.currentTarget as HTMLElement) ?? (ev.target as HTMLElement)?.closest?.('.row-menu__trigger');
    if (trigger) {
      this.positionMenu(trigger as HTMLElement);
    }
  }

  /**
   * Positionne le menu en `fixed` à partir du bouton déclencheur, aligné à droite,
   * et l'ouvre vers le haut quand l'espace sous le bouton est insuffisant.
   */
  private positionMenu(trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 200;
    const estimatedHeight = 300;
    const gap = 6;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;

    if (openUp) {
      this.menuStyle = {
        position: 'fixed',
        left: `${left}px`,
        bottom: `${window.innerHeight - rect.top + gap}px`,
        top: 'auto',
        'max-height': `${Math.max(160, rect.top - gap - 8)}px`
      };
    } else {
      this.menuStyle = {
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.bottom + gap}px`,
        bottom: 'auto',
        'max-height': `${Math.max(160, spaceBelow - gap - 8)}px`
      };
    }
  }

  closeRowMenu(): void {
    this.openMenuPublicId = null;
  }

  isRowMenuOpen(a: Annonce): boolean {
    return this.openMenuPublicId === a.publicId;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.openMenuPublicId || !this.vendeurActions) return;
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.row-menu')) return;
    this.closeRowMenu();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.openMenuPublicId) {
      this.closeRowMenu();
    }
  }

  openDetailsPopup(a: Annonce, ev?: Event): void {
    ev?.stopPropagation();
    this.closeRowMenu();
    this.detailPopupAnnonce = a;
  }

  closeDetailsPopup(): void {
    this.detailPopupAnnonce = null;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') return;
    if (this.openMenuPublicId) {
      this.closeRowMenu();
      return;
    }
    if (this.detailPopupAnnonce) {
      this.closeDetailsPopup();
    }
  }

  /** Texte description affiché dans la popup (tronqué au-delà de 4000 caractères). */
  descriptionForPopup(a: Annonce): string {
    const d = (a.description || '').trim();
    if (!d) return '—';
    return d.length > 4000 ? d.slice(0, 4000) + '…' : d;
  }

  get rows(): Annonce[] {
    return this.vendeurActions ? this.pagedAnnonces : this.annonces ?? [];
  }

  get listSubtitle(): string {
    if (this.vendeurActions) {
      if (this.loadingList) return 'Chargement…';
      if (this.totalElements > 0) {
        const suffix = this.searchApplied || this.statusFilter !== 'ALL' ? ' (filtre actif)' : '';
        return `${this.totalElements} annonce${this.totalElements > 1 ? 's' : ''}${suffix}`;
      }
      return '';
    }
    if ((this.annonces?.length ?? 0) > 0) {
      return `${this.annonces!.length} annonce${this.annonces!.length > 1 ? 's' : ''}`;
    }
    return '';
  }

  get showDataGrid(): boolean {
    if (this.vendeurActions) {
      return this.loadingList || this.rows.length > 0;
    }
    return (this.annonces?.length ?? 0) > 0;
  }

  get pageRangeText(): string {
    if (!this.vendeurActions || this.totalElements === 0) return '';
    const from = this.currentPage * this.pageSize + 1;
    const to = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
    return `${from}–${to} sur ${this.totalElements}`;
  }

  get showFirstPublishEmpty(): boolean {
    return (
      this.showVendeurEmptyState &&
      this.vendeurActions &&
      !this.lockedStatusFilter &&
      !this.loadingList &&
      this.totalElements === 0 &&
      !this.searchApplied &&
      this.statusFilter === 'ALL'
    );
  }

  get showPendingEmpty(): boolean {
    return (
      this.vendeurActions &&
      !!this.lockedStatusFilter &&
      !this.loadingList &&
      this.totalElements === 0
    );
  }

  get showFilteredEmpty(): boolean {
    return (
      this.vendeurActions &&
      !this.loadingList &&
      this.totalElements === 0 &&
      (!!this.searchApplied || this.statusFilter !== 'ALL')
    );
  }

  ngOnInit(): void {
    if (this.lockedStatusFilter) {
      this.statusFilter = this.lockedStatusFilter;
    } else if (this.initialStatusFilter && this.isValidStatusFilter(this.initialStatusFilter)) {
      this.statusFilter = this.initialStatusFilter;
    }
    if (this.vendeurActions) {
      this.fetchPage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedStatusFilter']?.currentValue) {
      this.statusFilter = changes['lockedStatusFilter'].currentValue;
      if (this.vendeurActions) {
        this.currentPage = 0;
        this.fetchPage();
      }
    }
    if (changes['initialStatusFilter']?.currentValue && !this.lockedStatusFilter) {
      const next = changes['initialStatusFilter'].currentValue;
      if (this.isValidStatusFilter(next)) {
        this.statusFilter = next;
        if (this.vendeurActions) {
          this.currentPage = 0;
          this.fetchPage();
        }
      }
    }
    if (changes['vendeurActions']?.currentValue === true && changes['vendeurActions']?.previousValue === false) {
      this.fetchPage();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  private isValidStatusFilter(id: string): boolean {
    return this.statusFilters.some((f) => f.id === id);
  }

  countForFilter(id: string): number | null {
    const s = this.sellerSummary;
    if (!s) return null;
    switch (id) {
      case 'ALL':
        return s.totalCount;
      case 'PENDING':
        return s.pendingCount;
      case 'APPROVED':
        return s.approvedCount;
      case 'RESERVED':
        return s.reservedCount ?? 0;
      case 'REJECTED':
        return s.rejectedCount;
      case 'SOLD':
        return s.soldCount;
      case 'EXPIRED':
        return s.expiredCount;
      default:
        return null;
    }
  }

  setStatusFilter(id: string): void {
    if (this.lockedStatusFilter) return;
    if (this.statusFilter === id) return;
    this.statusFilter = id;
    this.currentPage = 0;
    this.fetchPage();
  }

  onSearchDraftChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const next = (this.searchDraft || '').trim();
      if (next === this.searchApplied) return;
      this.searchApplied = next;
      this.currentPage = 0;
      this.fetchPage();
    }, 400);
  }

  resetFilters(): void {
    if (this.lockedStatusFilter) return;
    this.statusFilter = 'ALL';
    this.searchDraft = '';
    this.searchApplied = '';
    this.currentPage = 0;
    this.fetchPage();
  }

  clearSearch(): void {
    this.searchDraft = '';
    if (!this.searchApplied) return;
    this.searchApplied = '';
    this.currentPage = 0;
    this.fetchPage();
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.fetchPage();
  }

  goPrev(): void {
    if (this.currentPage <= 0) return;
    this.currentPage--;
    this.fetchPage();
  }

  goNext(): void {
    if (this.currentPage >= this.totalPages - 1) return;
    this.currentPage++;
    this.fetchPage();
  }

  fetchPage(): void {
    if (!this.vendeurActions) return;
    this.loadingList = true;
    this.annonceService
      .getMyAnnonces(this.currentPage, this.pageSize, {
        status: this.statusFilter,
        search: this.searchApplied || undefined
      })
      .subscribe({
        next: (res) => {
          this.totalElements = res.totalElements;
          this.totalPages = res.totalPages;
          if (this.totalPages > 0 && this.currentPage > this.totalPages - 1) {
            this.currentPage = this.totalPages - 1;
            this.loadingList = false;
            this.fetchPage();
            return;
          }
          this.currentPage = res.number;
          this.pagedAnnonces = res.content ?? [];
          this.detailPopupAnnonce = null;
          this.closeRowMenu();
          this.loadingList = false;
        },
        error: () => {
          this.loadingList = false;
          this.pagedAnnonces = [];
          this.totalElements = 0;
          this.totalPages = 0;
        }
      });
  }

  canPublicDetail(a: Annonce): boolean {
    return a.status === 'APPROVED' || a.status === 'RESERVED' || a.status === 'SOLD';
  }

  canEdit(a: Annonce): boolean {
    return a.status !== 'SOLD' && a.status !== 'RESERVED';
  }

  canDelete(a: Annonce): boolean {
    return a.status === 'PENDING' || a.status === 'REJECTED';
  }

  canAddPhotos(a: Annonce): boolean {
    return a.status !== 'SOLD' && a.status !== 'RESERVED';
  }

  isReserved(a: Annonce): boolean {
    return a.status === 'RESERVED';
  }

  confirmSale(a: Annonce): void {
    Swal.fire({
      title: 'Clôturer la vente ?',
      text: `Marquer « ${a.title} » comme vendu à ${a.buyerName || "l'acheteur"}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmer la vente',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#7f77dd'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.annonceService.confirmSaleBySeller(a.publicId).subscribe({
        next: () => {
          this.closeDetailsPopup();
          this.closeRowMenu();
          Swal.fire({ icon: 'success', title: 'Vente clôturée', timer: 1600, showConfirmButton: false });
          this.listChanged.emit();
          this.fetchPage();
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            (err.error && typeof err.error === 'object' && (err.error as { message?: string }).message) ||
            err.message ||
            'Action impossible';
          Swal.fire({ icon: 'error', title: 'Clôture', text: msg });
        }
      });
    });
  }

  cancelSale(a: Annonce): void {
    Swal.fire({
      title: 'Remettre en vente ?',
      text: "L'acheteur se désiste : l'annonce redevient visible dans le catalogue.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remettre en ligne',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#b45309'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.annonceService.cancelSaleBySeller(a.publicId).subscribe({
        next: () => {
          this.closeDetailsPopup();
          this.closeRowMenu();
          Swal.fire({ icon: 'success', title: 'Annonce remise en vente', timer: 1600, showConfirmButton: false });
          this.listChanged.emit();
          this.fetchPage();
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            (err.error && typeof err.error === 'object' && (err.error as { message?: string }).message) ||
            err.message ||
            'Action impossible';
          Swal.fire({ icon: 'error', title: 'Annulation', text: msg });
        }
      });
    });
  }

  copyPublicLink(a: Annonce): void {
    const url = `${window.location.origin}/produit/${a.publicId}`;
    navigator.clipboard.writeText(url).then(
      () => {
        Swal.fire({ icon: 'success', title: 'Lien copié', timer: 1400, showConfirmButton: false });
      },
      () => {
        Swal.fire({ icon: 'info', title: 'Lien', text: url });
      }
    );
  }

  startPhotos(a: Annonce): void {
    this.pendingPhotoPublicId = a.publicId;
    this.photoPicker?.nativeElement.click();
  }

  onPhotoFilesSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const pid = this.pendingPhotoPublicId;
    this.pendingPhotoPublicId = null;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!pid || files.length === 0) return;

    this.annonceService.uploadPhotos(pid, files).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Photos ajoutées', timer: 1600, showConfirmButton: false });
        this.listChanged.emit();
        this.fetchPage();
      },
      error: (err: HttpErrorResponse) => {
        const msg =
          (err.error && typeof err.error === 'object' && (err.error as { message?: string }).message) ||
          err.message ||
          'Échec de l’envoi des photos';
        Swal.fire({ icon: 'error', title: 'Photos', text: msg });
      }
    });
  }

  confirmDelete(a: Annonce): void {
    Swal.fire({
      title: 'Supprimer cette annonce ?',
      text: 'Cette action est définitive.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#b91c1c'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.annonceService.deleteMyAnnonce(a.publicId).subscribe({
        next: () => {
          this.closeDetailsPopup();
          Swal.fire({ icon: 'success', title: 'Annonce supprimée', timer: 1600, showConfirmButton: false });
          this.listChanged.emit();
          if (this.pagedAnnonces.length <= 1 && this.currentPage > 0) {
            this.currentPage--;
          }
          this.fetchPage();
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            (err.error && typeof err.error === 'object' && (err.error as { message?: string }).message) ||
            (typeof err.error === 'string' ? err.error : null) ||
            err.message ||
            'Suppression impossible';
          Swal.fire({ icon: 'error', title: 'Suppression', text: msg });
        }
      });
    });
  }
}
