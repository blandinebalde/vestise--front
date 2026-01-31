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
    sortBy: 'publicationType',
    sortDir: 'DESC'
  };
  loading = false;
  filtersOpen = false;
  totalElements: number | null = null;
  totalPages = 0;
  currentPage = 0;

  private searchSubject = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private annonceService: AnnonceService,
    private categoryService: CategoryService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => this.categories = categories,
      error: (err) => console.error('Error loading categories:', err)
    });
    this.route.queryParams.subscribe(params => {
      if (params['categoryId']) {
        this.filter.categoryId = Number(params['categoryId']);
      }
      if (params['minPrice'] !== undefined && params['minPrice'] !== '') {
        this.filter.minPrice = Number(params['minPrice']);
      }
      if (params['maxPrice'] !== undefined && params['maxPrice'] !== '') {
        this.filter.maxPrice = Number(params['maxPrice']);
      }
      this.loadAnnonces();
    });
    this.searchSubject.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe(() => this.applyFilters());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput() {
    this.searchSubject.next();
  }

  loadAnnonces() {
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

  get firstItemIndex(): number {
    if (this.totalElements === null || this.totalElements === 0) return 0;
    return this.currentPage * (this.filter.pageSize ?? PAGE_SIZE) + 1;
  }

  get lastItemIndex(): number {
    if (this.totalElements === null || this.totalElements === 0) return 0;
    const size = this.filter.pageSize ?? PAGE_SIZE;
    return Math.min((this.currentPage + 1) * size, this.totalElements);
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages) return;
    this.filter.page = page;
    this.loadAnnonces();
  }

  applyFilters() {
    this.filter.page = 0;
    this.loadAnnonces();
  }

  resetFilters() {
    this.filter = {
      page: 0,
      pageSize: PAGE_SIZE,
      sortBy: 'publicationType',
      sortDir: 'DESC'
    };
    this.filter.toutDoitPartir = false;
    this.loadAnnonces();
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) {
      return image;
    }
    return `${API_BASE_URL}/${image}`;
  }

  getPublicationTypeLabel(type: string): string {
    return type || '';
  }

  getPublicationTypeClass(type: string): string {
    return (type || '').toLowerCase().replace(/\s+/g, '-');
  }
}
