import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnnonceService, Annonce, AnnonceFilter } from '../../services/annonce.service';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="catalogue-page">
      <div class="container">
        <h1 class="page-title">Catalogue</h1>
        
        <div class="catalogue-layout">
          <aside class="filters">
            <h3>Filtres</h3>
            
            <div class="form-group">
              <label class="form-label">Recherche</label>
              <input type="text" class="form-control" [(ngModel)]="filter.search" 
                     (ngModelChange)="applyFilters()" placeholder="Rechercher...">
            </div>
            
            <div class="form-group">
              <label class="form-label">Catégorie</label>
              <select class="form-control" [(ngModel)]="filter.category" (ngModelChange)="applyFilters()">
                <option value="">Toutes</option>
                <option value="FEMME">Femmes</option>
                <option value="HOMME">Hommes</option>
                <option value="ACCESSOIRE">Accessoires</option>
                <option value="PROMOTION">Promotions</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Prix min</label>
              <input type="number" class="form-control" [(ngModel)]="filter.minPrice" 
                     (ngModelChange)="applyFilters()" placeholder="0">
            </div>
            
            <div class="form-group">
              <label class="form-label">Prix max</label>
              <input type="number" class="form-control" [(ngModel)]="filter.maxPrice" 
                     (ngModelChange)="applyFilters()" placeholder="1000000">
            </div>
            
            <div class="form-group">
              <label class="form-label">Taille</label>
              <select class="form-control" [(ngModel)]="filter.size" (ngModelChange)="applyFilters()">
                <option value="">Toutes</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Marque</label>
              <input type="text" class="form-control" [(ngModel)]="filter.brand" 
                     (ngModelChange)="applyFilters()" placeholder="Marque...">
            </div>
            
            <div class="form-group">
              <label class="form-label">État</label>
              <select class="form-control" [(ngModel)]="filter.condition" (ngModelChange)="applyFilters()">
                <option value="">Tous</option>
                <option value="NEUF">Neuf</option>
                <option value="OCCASION">Occasion</option>
                <option value="TRES_BON_ETAT">Très bon état</option>
                <option value="BON_ETAT">Bon état</option>
              </select>
            </div>
            
            <button class="btn btn-outline" (click)="resetFilters()">Réinitialiser</button>
          </aside>
          
          <main class="annonces-list">
            <div class="annonces-grid" *ngIf="annonces.length > 0">
              <div *ngFor="let annonce of annonces" class="annonce-card card" 
                   [routerLink]="['/produit', annonce.id]">
                <div class="annonce-image">
                  <img [src]="getImageUrl(annonce.images[0])" [alt]="annonce.title" 
                       *ngIf="annonce.images.length > 0">
                  <div class="no-image" *ngIf="annonce.images.length === 0">Pas d'image</div>
                  <span class="badge" [ngClass]="'badge-' + annonce.publicationType.toLowerCase()">
                    {{ getPublicationTypeLabel(annonce.publicationType) }}
                  </span>
                </div>
                <div class="annonce-content">
                  <h3>{{ annonce.title }}</h3>
                  <p class="price">{{ annonce.price | number }} FCFA</p>
                  <p class="location" *ngIf="annonce.location">{{ annonce.location }}</p>
                </div>
              </div>
            </div>
            
            <div class="no-results" *ngIf="annonces.length === 0 && !loading">
              <p>Aucune annonce trouvée</p>
            </div>
            
            <div class="loading" *ngIf="loading">
              <p>Chargement...</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .catalogue-page {
      padding: 2rem 0;
    }
    
    .page-title {
      margin-bottom: 2rem;
    }
    
    .catalogue-layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 2rem;
    }
    
    .filters {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: var(--shadow);
      height: fit-content;
      position: sticky;
      top: 100px;
    }
    
    .filters h3 {
      margin-bottom: 1.5rem;
    }
    
    .annonces-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 2rem;
    }
    
    .annonce-card {
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
    
    .annonce-image {
      position: relative;
      width: 100%;
      height: 250px;
      overflow: hidden;
    }
    
    .annonce-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .no-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--border-color);
      color: var(--text-light);
    }
    
    .annonce-image .badge {
      position: absolute;
      top: 10px;
      right: 10px;
    }
    
    .annonce-content {
      padding: 1rem;
    }
    
    .annonce-content h3 {
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    
    .price {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--primary-color);
      margin-bottom: 0.5rem;
    }
    
    .no-results,
    .loading {
      text-align: center;
      padding: 4rem;
      color: var(--text-light);
    }
    
    @media (max-width: 768px) {
      .catalogue-layout {
        grid-template-columns: 1fr;
      }
      
      .filters {
        position: static;
      }
    }
  `]
})
export class CatalogueComponent implements OnInit {
  annonces: Annonce[] = [];
  filter: AnnonceFilter = {
    page: 0,
    pageSize: 20
  };
  loading = false;

  constructor(
    private annonceService: AnnonceService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.filter.category = params['category'];
      }
      this.loadAnnonces();
    });
  }

  loadAnnonces() {
    this.loading = true;
    this.annonceService.getAnnonces(this.filter).subscribe({
      next: (response) => {
        this.annonces = response.content;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading annonces:', err);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.filter.page = 0;
    this.loadAnnonces();
  }

  resetFilters() {
    this.filter = { page: 0, pageSize: 20 };
    this.loadAnnonces();
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) {
      return image;
    }
    return `http://localhost:8080/${image}`;
  }

  getPublicationTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'STANDARD': 'Standard',
      'PREMIUM': 'Premium',
      'TOP_PUB': 'Top Pub'
    };
    return labels[type] || type;
  }
}
