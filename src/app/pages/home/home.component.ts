import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnnonceService, Annonce, AnnonceFilter } from '../../services/annonce.service';
import { CategoryService, Category } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';
import { NavigationService } from '../../services/navigation.service';
import { API_BASE_URL } from '../../config/api.config';

export type HomeSort = 'recent' | 'priceAsc' | 'priceDesc';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  annonces: Annonce[] = [];
  categories: Category[] = [];
  selectedCategoryId: number | null = null;
  homeSort: HomeSort = 'recent';
  totalAnnoncesPlateforme: number | null = null;

  get statAnnoncesLabel(): string {
    const t = this.totalAnnoncesPlateforme;
    if (t == null) return '—';
    if (t >= 1_000_000) return `${Math.floor(t / 1_000_000)}M+`;
    if (t >= 10_000) return `${Math.round(t / 1000)}k+`;
    if (t >= 1000) return `${(t / 1000).toFixed(1).replace('.0', '')}k+`;
    return `${t}`;
  }

  constructor(
    private annonceService: AnnonceService,
    private categoryService: CategoryService,
    public authService: AuthService,
    public navigationService: NavigationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadMarketTotal();
    this.loadAnnonces();
  }

  private loadMarketTotal(): void {
    this.annonceService.getAnnonces({ page: 0, pageSize: 1 }).subscribe({
      next: (res) => (this.totalAnnoncesPlateforme = res.totalElements ?? null),
      error: () => (this.totalAnnoncesPlateforme = null)
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (list) => (this.categories = list || []),
      error: () => (this.categories = [])
    });
  }

  selectCategory(id: number | null): void {
    this.selectedCategoryId = id;
    this.loadAnnonces();
  }

  onSortChange(): void {
    this.loadAnnonces();
  }

  loadAnnonces(): void {
    const useTop =
      this.selectedCategoryId == null && this.homeSort === 'recent';

    if (useTop) {
      this.annonceService.getTopAnnonces('Top Pub', 12).subscribe({
        next: (list) => {
          let arr = list?.length ? list : [];
          if (arr.length === 0) {
            this.loadAnnoncesPaged();
          } else {
            this.annonces = this.applyClientSort(arr);
          }
        },
        error: () => this.loadAnnoncesPaged()
      });
    } else {
      this.loadAnnoncesPaged();
    }
  }

  private loadAnnoncesPaged(): void {
    const f: AnnonceFilter = {
      page: 0,
      pageSize: 12,
      categoryId: this.selectedCategoryId ?? undefined,
      ...this.sortParams()
    };
    this.annonceService.getAnnonces(f).subscribe({
      next: (res) => {
        const content = res.content || [];
        this.annonces = this.applyClientSort(content);
      },
      error: () => (this.annonces = [])
    });
  }

  /** L'API catalogue impose un tri par crédits ; on applique prix côté client si demandé. */
  private applyClientSort(list: Annonce[]): Annonce[] {
    if (this.homeSort === 'priceAsc') {
      return [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    }
    if (this.homeSort === 'priceDesc') {
      return [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
    return list;
  }

  private sortParams(): Pick<AnnonceFilter, 'sortBy' | 'sortDir'> {
    switch (this.homeSort) {
      case 'priceAsc':
        return { sortBy: 'price', sortDir: 'ASC' };
      case 'priceDesc':
        return { sortBy: 'price', sortDir: 'DESC' };
      default:
        return { sortBy: 'createdAt', sortDir: 'DESC' };
    }
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}/${image}`;
  }

  hasImage(annonce: Annonce): boolean {
    return (annonce.images?.length ?? 0) > 0 && !!annonce.images[0];
  }

  getConditionLabel(condition: string | undefined): string {
    if (!condition) return '';
    const labels: { [key: string]: string } = {
      NEUF: 'Neuf',
      OCCASION: 'Occasion',
      TRES_BON_ETAT: 'Très bon état',
      BON_ETAT: 'Bon état'
    };
    return labels[condition] || condition;
  }

  /** Au plus 2 badges : promo éventuelle, puis état / taille. */
  badgesFor(annonce: Annonce): { text: string; klass: string }[] {
    const out: { text: string; klass: string }[] = [];
    if (annonce.toutDoitPartir) {
      out.push({ text: 'Promo', klass: 'home-card__badge home-card__badge--promo' });
    }
    const cond = this.getConditionLabel(annonce.condition);
    if (cond) {
      out.push({ text: cond, klass: 'home-card__badge home-card__badge--state' });
    }
    if (annonce.size?.trim()) {
      out.push({ text: annonce.size.trim(), klass: 'home-card__badge home-card__badge--size' });
    }
    if (out.length === 0 && annonce.categoryName) {
      out.push({ text: annonce.categoryName, klass: 'home-card__badge home-card__badge--cat' });
    }
    return out.slice(0, 2);
  }

  mediaTintClass(annonce: Annonce): string {
    const idx = Math.abs(Number(annonce.categoryId) || 0) % 4;
    return `home-card__media--tint-${idx}`;
  }

  sellerInitials(name: string | undefined): string {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  shortenSeller(name: string | undefined): string {
    if (!name) return '';
    const max = 18;
    return name.length > max ? name.slice(0, max - 1) + '…' : name;
  }

  goCatalogue(extra?: Record<string, string | number>): void {
    this.router.navigate(['/catalogue'], { queryParams: extra || {} });
  }
}
