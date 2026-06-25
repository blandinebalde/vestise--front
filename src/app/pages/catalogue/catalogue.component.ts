import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AnnonceService, Annonce, AnnonceFilter } from '../../services/annonce.service';
import { CategoryService, Category } from '../../services/category.service';
import { imageUrlFor } from '../../config/api.config';

const PAGE_SIZE = 20;

export type CatalogueViewMode = 'grid' | 'list';
export type CatalogueSortMode = 'recent' | 'price_asc' | 'price_desc' | 'popular';

interface ConditionOption {
  value: string;
  label: string;
}

interface EtatStyle {
  bg: string;
  color: string;
  label: string;
}

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './catalogue.component.html',
  styleUrls: ['./catalogue.component.css']
})
export class CatalogueComponent implements OnInit, OnDestroy {
  annonces: Annonce[] = [];
  categories: Category[] = [];
  filter: AnnonceFilter = {
    page: 0,
    pageSize: PAGE_SIZE,
    sortBy: 'createdAt',
    sortDir: 'DESC'
  };

  viewMode: CatalogueViewMode = 'grid';
  sortMode: CatalogueSortMode = 'recent';
  selectedCategoryId: number | null = null;
  selectedLocations = new Set<string>();

  /** Recherche de catégorie dans la sidebar. */
  categorySearch = '';
  /** Nombre de catégories visibles (incrémenté par pas de 5 via « Voir plus »). */
  private readonly categoryStep = 5;
  categoryLimit = this.categoryStep;

  loading = false;
  totalElements: number | null = null;
  totalPages = 0;
  currentPage = 0;

  imageFailedIds = new Set<string>();
  likedIds = new Set<string>();

  readonly imageUrlFor = imageUrlFor;

  readonly conditionFilters: ConditionOption[] = [
    { value: 'NEUF', label: 'Neuf avec étiquette' },
    { value: 'TRES_BON_ETAT', label: 'Très bon état' },
    { value: 'BON_ETAT', label: 'Bon état' },
    { value: 'OCCASION', label: 'Satisfaisant' }
  ];

  readonly sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  readonly locationOptions = ['Dakar', 'Thiès', 'Saint-Louis'];

  private readonly placeholderPalettes = [
    { bg: '#EEEDFE', iconColor: '#7F77DD' },
    { bg: '#FAECE7', iconColor: '#D85A30' },
    { bg: '#E1F5EE', iconColor: '#1D9E75' },
    { bg: '#FAEEDA', iconColor: '#BA7517' },
    { bg: '#EAF3DE', iconColor: '#639922' },
    { bg: '#FBEAF0', iconColor: '#D4537E' }
  ];

  private readonly sellerPalettes = [
    { bg: '#EEEDFE', text: '#534AB7' },
    { bg: '#FAECE7', text: '#712B13' },
    { bg: '#E1F5EE', text: '#085041' },
    { bg: '#FAEEDA', text: '#633806' },
    { bg: '#EAF3DE', text: '#27500A' },
    { bg: '#FBEAF0', text: '#72243E' }
  ];

  private searchSubject = new Subject<void>();
  private priceSubject = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private annonceService: AnnonceService,
    private categoryService: CategoryService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories.filter((c) => c.active !== false)),
      error: (err) => console.error('Error loading categories:', err)
    });

    this.route.queryParams.subscribe((params) => {
      if (params['categoryId']) {
        this.selectedCategoryId = Number(params['categoryId']);
        this.filter.categoryId = this.selectedCategoryId;
      }
      if (params['minPrice'] !== undefined && params['minPrice'] !== '') {
        this.filter.minPrice = Number(params['minPrice']);
      }
      if (params['maxPrice'] !== undefined && params['maxPrice'] !== '') {
        this.filter.maxPrice = Number(params['maxPrice']);
      }
      this.loadAnnonces();
    });

    this.searchSubject.pipe(debounceTime(400), takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
    this.priceSubject.pipe(debounceTime(400), takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Catégories filtrées par la recherche sidebar. */
  get filteredCategories(): Category[] {
    const q = this.categorySearch.trim().toLowerCase();
    if (!q) {
      return this.categories;
    }
    return this.categories.filter((c) => (c.name || '').toLowerCase().includes(q));
  }

  /** Sous-ensemble visible (limité à categoryLimit). */
  get visibleCategories(): Category[] {
    return this.filteredCategories.slice(0, this.categoryLimit);
  }

  get hasMoreCategories(): boolean {
    return this.filteredCategories.length > this.categoryLimit;
  }

  get remainingCategoriesCount(): number {
    return Math.max(0, this.filteredCategories.length - this.categoryLimit);
  }

  showMoreCategories(): void {
    this.categoryLimit += this.categoryStep;
  }

  onCategorySearchChange(): void {
    this.categoryLimit = this.categoryStep;
  }

  get displayedAnnonces(): Annonce[] {
    if (this.selectedLocations.size === 0) {
      return this.annonces;
    }
    return this.annonces.filter((a) => {
      const loc = (a.location || '').toLowerCase();
      return [...this.selectedLocations].some((sel) => loc.includes(sel.toLowerCase()));
    });
  }

  get countLabel(): string {
    const n =
      this.selectedLocations.size > 0
        ? this.displayedAnnonces.length
        : (this.totalElements ?? this.annonces.length);
    return n + ' article' + (n > 1 ? 's' : '');
  }

  get pageNumbers(): number[] {
    const maxButtons = 5;
    const total = this.totalPages;
    if (total <= maxButtons) {
      return Array.from({ length: total }, (_, i) => i);
    }
    let start = Math.max(0, this.currentPage - 2);
    const end = Math.min(total - 1, start + maxButtons - 1);
    start = Math.max(0, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  onSearchInput(): void {
    this.searchSubject.next();
  }

  onPriceChange(): void {
    this.priceSubject.next();
  }

  setView(mode: CatalogueViewMode): void {
    this.viewMode = mode;
  }

  selectCategory(catId: number | null): void {
    this.selectedCategoryId = catId;
    this.filter.categoryId = catId ?? undefined;
    this.applyFilters();
  }

  selectCondition(value: string): void {
    if (this.filter.condition === value) {
      this.filter.condition = undefined;
    } else {
      this.filter.condition = value;
    }
    this.applyFilters();
  }

  selectSize(size: string): void {
    if (this.filter.size === size) {
      this.filter.size = undefined;
    } else {
      this.filter.size = size;
    }
    this.applyFilters();
  }

  isSizeActive(size: string): boolean {
    return this.filter.size === size;
  }

  toggleLocation(loc: string): void {
    if (this.selectedLocations.has(loc)) {
      this.selectedLocations.delete(loc);
    } else {
      this.selectedLocations.add(loc);
    }
    this.selectedLocations = new Set(this.selectedLocations);
  }

  isLocationActive(loc: string): boolean {
    return this.selectedLocations.has(loc);
  }

  isCategoryActive(catId: number | null): boolean {
    return this.selectedCategoryId === catId;
  }

  isConditionActive(value: string): boolean {
    return (this.filter.condition ?? '') === value;
  }

  onSortChange(): void {
    switch (this.sortMode) {
      case 'price_asc':
        this.filter.sortBy = 'price';
        this.filter.sortDir = 'ASC';
        break;
      case 'price_desc':
        this.filter.sortBy = 'price';
        this.filter.sortDir = 'DESC';
        break;
      case 'popular':
        this.filter.sortBy = 'viewCount';
        this.filter.sortDir = 'DESC';
        break;
      default:
        this.filter.sortBy = 'createdAt';
        this.filter.sortDir = 'DESC';
    }
    this.applyFilters();
  }

  loadAnnonces(): void {
    this.loading = true;

    this.annonceService.getAnnonces(this.filter).subscribe({
      next: (response) => {
        this.annonces = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.currentPage = response.number ?? 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading annonces:', err);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filter.page = 0;
    this.loadAnnonces();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }
    this.filter.page = page;
    this.loadAnnonces();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetFilters(): void {
    this.sortMode = 'recent';
    this.selectedCategoryId = null;
    this.selectedLocations = new Set();
    this.categorySearch = '';
    this.categoryLimit = this.categoryStep;
    this.filter = {
      page: 0,
      pageSize: PAGE_SIZE,
      sortBy: 'createdAt',
      sortDir: 'DESC'
    };
    this.loadAnnonces();
  }

  toggleLike(publicId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.likedIds.has(publicId)) {
      this.likedIds.delete(publicId);
    } else {
      this.likedIds.add(publicId);
    }
  }

  isLiked(publicId: string): boolean {
    return this.likedIds.has(publicId);
  }

  getImageUrl(image: string): string {
    return imageUrlFor(image);
  }

  onImageError(publicId: string): void {
    this.imageFailedIds.add(publicId);
  }

  imageFailed(publicId: string): boolean {
    return this.imageFailedIds.has(publicId);
  }

  hasImage(annonce: Annonce): boolean {
    return (annonce.images?.length ?? 0) > 0 && !!annonce.images[0];
  }

  showProductImage(annonce: Annonce): boolean {
    return this.hasImage(annonce) && !this.imageFailed(annonce.publicId);
  }

  placeholderStyle(annonce: Annonce): { bg: string; iconColor: string } {
    const idx = (annonce.categoryId ?? annonce.title?.length ?? 0) % this.placeholderPalettes.length;
    return this.placeholderPalettes[idx];
  }

  sellerStyle(annonce: Annonce): { bg: string; text: string } {
    const idx = (annonce.sellerName?.length ?? 0) % this.sellerPalettes.length;
    return this.sellerPalettes[idx];
  }

  sellerInitials(annonce: Annonce): string {
    const name = (annonce.sellerName || 'V').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  etatStyle(annonce: Annonce): EtatStyle {
    switch (annonce.condition) {
      case 'NEUF':
        return { bg: '#EEEDFE', color: '#3C3489', label: 'Neuf' };
      case 'TRES_BON_ETAT':
        return { bg: '#E1F5EE', color: '#085041', label: 'Très bon état' };
      case 'BON_ETAT':
        return { bg: '#FAEEDA', color: '#633806', label: 'Bon état' };
      case 'OCCASION':
        return { bg: '#FAECE7', color: '#712B13', label: 'Occasion' };
      default:
        return { bg: '#f0eef8', color: '#6b6580', label: '—' };
    }
  }

  showEtatBadge(annonce: Annonce): boolean {
    return !!annonce.condition;
  }

  isBoosted(annonce: Annonce): boolean {
    const t = (annonce.publicationType || '').toLowerCase();
    return t.includes('top') || t.includes('premium') || t.includes('boost');
  }

  isNewCondition(annonce: Annonce): boolean {
    return annonce.condition === 'NEUF';
  }

  isSold(annonce: Annonce): boolean {
    const s = (annonce.status || '').toUpperCase();
    return s === 'SOLD' || s === 'RESERVED';
  }

  soldBadgeLabel(annonce: Annonce): string {
    return (annonce.status || '').toUpperCase() === 'RESERVED' ? 'Réservé' : 'Vendu';
  }

  shortSellerName(annonce: Annonce): string {
    const name = (annonce.sellerName || 'Vendeur').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return parts[0] + ' ' + parts[1].charAt(0) + '.';
    }
    return name;
  }

  formatPrice(price: number): string {
    return (price ?? 0).toLocaleString('fr-FR');
  }

  onCardClick(event: MouseEvent, publicId: string): void {
    const target = event.target as HTMLElement;
    if (target.closest('.cat-like-btn, .cat-buy-btn')) {
      return;
    }
  }
}
