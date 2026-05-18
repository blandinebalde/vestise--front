import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AnnonceService, Annonce, AnnonceFilter } from '../../services/annonce.service';
import { CategoryService, Category } from '../../services/category.service';
import { API_BASE_URL } from '../../config/api.config';

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
  advancedFiltersOpen = false;

  loading = false;
  loadingMore = false;
  totalElements: number | null = null;
  totalPages = 0;
  currentPage = 0;

  /** Favoris locaux (session) — clé = publicId */
  likedIds = new Set<string>();

  readonly conditionPills: ConditionOption[] = [
    { value: '', label: 'Tous' },
    { value: 'NEUF', label: 'Neuf' },
    { value: 'TRES_BON_ETAT', label: 'Très bon' },
    { value: 'BON_ETAT', label: 'Bon état' },
    { value: 'OCCASION', label: 'Occasion' }
  ];

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get countLabel(): string {
    const n = this.totalElements ?? this.annonces.length;
    return n + ' article' + (n > 1 ? 's' : '');
  }

  get hasMore(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  onSearchInput(): void {
    this.searchSubject.next();
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
    this.filter.condition = value || undefined;
    this.applyFilters();
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

  loadAnnonces(append = false): void {
    if (append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    this.annonceService.getAnnonces(this.filter).subscribe({
      next: (response) => {
        if (append) {
          this.annonces = [...this.annonces, ...response.content];
        } else {
          this.annonces = response.content;
        }
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.currentPage = response.number ?? 0;
        this.loading = false;
        this.loadingMore = false;
      },
      error: (err) => {
        console.error('Error loading annonces:', err);
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  applyFilters(): void {
    this.filter.page = 0;
    this.loadAnnonces(false);
  }

  loadMore(): void {
    if (!this.hasMore || this.loadingMore) {
      return;
    }
    this.filter.page = (this.filter.page ?? 0) + 1;
    this.loadAnnonces(true);
  }

  resetFilters(): void {
    this.sortMode = 'recent';
    this.selectedCategoryId = null;
    this.advancedFiltersOpen = false;
    this.filter = {
      page: 0,
      pageSize: PAGE_SIZE,
      sortBy: 'createdAt',
      sortDir: 'DESC'
    };
    this.loadAnnonces(false);
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
    if (!image) {
      return '';
    }
    if (image.startsWith('http')) {
      return image;
    }
    return `${API_BASE_URL}/${image}`;
  }

  hasImage(annonce: Annonce): boolean {
    return (annonce.images?.length ?? 0) > 0 && !!annonce.images[0];
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

  displayRating(annonce: Annonce): string {
    if (annonce.viewCount > 0) {
      return Math.min(5, 3.5 + Math.log10(annonce.viewCount + 1) * 0.4).toFixed(1);
    }
    return '4.5';
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
