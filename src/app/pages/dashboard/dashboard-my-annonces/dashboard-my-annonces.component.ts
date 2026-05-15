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

  @Output() listChanged = new EventEmitter<void>();

  @ViewChild('photoPicker') photoPicker?: ElementRef<HTMLInputElement>;

  private pendingPhotoPublicId: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** Annonce affichée dans la popup « Détails » (vendeur). */
  detailPopupAnnonce: Annonce | null = null;

  /** Menu « ⋮ » ouvert pour cette annonce (publicId). */
  openMenuPublicId: string | null = null;

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
    this.openMenuPublicId = this.openMenuPublicId === id ? null : id;
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
      !this.loadingList &&
      this.totalElements === 0 &&
      !this.searchApplied &&
      this.statusFilter === 'ALL'
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
    if (this.vendeurActions) {
      this.fetchPage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vendeurActions']?.currentValue === true && changes['vendeurActions']?.previousValue === false) {
      this.fetchPage();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
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
    return a.status === 'APPROVED';
  }

  canEdit(a: Annonce): boolean {
    return a.status !== 'SOLD';
  }

  canDelete(a: Annonce): boolean {
    return a.status === 'PENDING' || a.status === 'REJECTED';
  }

  canAddPhotos(a: Annonce): boolean {
    return a.status !== 'SOLD';
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
