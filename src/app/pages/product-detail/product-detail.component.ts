import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="product-detail" *ngIf="annonce">
      <div class="container">
        <div class="product-layout">
          <div class="product-images">
            <div class="main-image">
              <img [src]="getImageUrl(selectedImage)" [alt]="annonce.title">
            </div>
            <div class="thumbnail-images" *ngIf="annonce.images.length > 1">
              <img *ngFor="let img of annonce.images" 
                   [src]="getImageUrl(img)" 
                   [class.active]="img === selectedImage"
                   (click)="selectedImage = img"
                   [alt]="annonce.title">
            </div>
          </div>
          
          <div class="product-info">
            <span class="badge" [ngClass]="'badge-' + annonce.publicationType.toLowerCase()">
              {{ getPublicationTypeLabel(annonce.publicationType) }}
            </span>
            <h1>{{ annonce.title }}</h1>
            <p class="price">{{ annonce.price | number }} FCFA</p>
            
            <div class="product-details">
              <div class="detail-item" *ngIf="annonce.category">
                <strong>Catégorie:</strong> {{ getCategoryLabel(annonce.category) }}
              </div>
              <div class="detail-item" *ngIf="annonce.size">
                <strong>Taille:</strong> {{ annonce.size }}
              </div>
              <div class="detail-item" *ngIf="annonce.brand">
                <strong>Marque:</strong> {{ annonce.brand }}
              </div>
              <div class="detail-item" *ngIf="annonce.condition">
                <strong>État:</strong> {{ getConditionLabel(annonce.condition) }}
              </div>
              <div class="detail-item" *ngIf="annonce.color">
                <strong>Couleur:</strong> {{ annonce.color }}
              </div>
              <div class="detail-item" *ngIf="annonce.location">
                <strong>Localisation:</strong> {{ annonce.location }}
              </div>
            </div>
            
            <div class="description">
              <h3>Description</h3>
              <p>{{ annonce.description || 'Aucune description disponible.' }}</p>
            </div>
            
            <div class="seller-info">
              <h3>Vendeur</h3>
              <p><strong>{{ annonce.sellerName }}</strong></p>
            </div>
            
            <div class="product-actions">
              <a [href]="getWhatsAppLink()" 
                 class="btn btn-whatsapp btn-large" 
                 target="_blank"
                 (click)="contactSeller()">
                📱 Contacter via WhatsApp
              </a>
              <a [href]="'tel:' + annonce.sellerPhone" 
                 class="btn btn-primary btn-large">
                📞 Appeler le vendeur
              </a>
            </div>
            
            <div class="share-section">
              <h4>Partager cette annonce</h4>
              <div class="share-buttons">
                <a [href]="getFacebookShareLink()" target="_blank" class="share-btn facebook">
                  Facebook
                </a>
                <a [href]="getWhatsAppShareLink()" target="_blank" class="share-btn whatsapp">
                  WhatsApp
                </a>
                <button (click)="copyLink()" class="share-btn copy">
                  Copier le lien
                </button>
              </div>
            </div>
            
            <div class="product-stats">
              <span>{{ annonce.viewCount }} vues</span>
              <span>{{ annonce.contactCount }} contacts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="loading" *ngIf="!annonce">
      <p>Chargement...</p>
    </div>
  `,
  styles: [`
    .product-detail {
      padding: 2rem 0;
    }
    
    .product-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
    }
    
    .product-images {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .main-image {
      width: 100%;
      height: 500px;
      overflow: hidden;
      border-radius: 12px;
      background: var(--border-color);
    }
    
    .main-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .thumbnail-images {
      display: flex;
      gap: 0.5rem;
    }
    
    .thumbnail-images img {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 8px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.3s ease;
    }
    
    .thumbnail-images img.active {
      border-color: var(--primary-color);
    }
    
    .product-info h1 {
      margin: 1rem 0;
    }
    
    .price {
      font-size: 2.5rem;
      font-weight: 600;
      color: var(--primary-color);
      margin: 1rem 0;
    }
    
    .product-details {
      background: var(--background-light);
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1.5rem 0;
    }
    
    .detail-item {
      margin-bottom: 0.75rem;
    }
    
    .description {
      margin: 2rem 0;
    }
    
    .seller-info {
      background: var(--background-light);
      padding: 1rem;
      border-radius: 8px;
      margin: 1.5rem 0;
    }
    
    .product-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .btn-large {
      padding: 1rem 2rem;
      font-size: 1.1rem;
    }
    
    .share-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--background-light);
      border-radius: 8px;
    }
    
    .share-section h4 {
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    
    .share-buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .share-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.3s ease;
    }
    
    .share-btn:hover {
      transform: translateY(-2px);
    }
    
    .share-btn.facebook {
      background: #1877F2;
      color: white;
    }
    
    .share-btn.whatsapp {
      background: #25D366;
      color: white;
    }
    
    .share-btn.copy {
      background: var(--text-light);
      color: white;
    }
    
    .product-stats {
      display: flex;
      gap: 2rem;
      color: var(--text-light);
      font-size: 0.9rem;
    }
    
    .loading {
      text-align: center;
      padding: 4rem;
    }
    
    @media (max-width: 768px) {
      .product-layout {
        grid-template-columns: 1fr;
      }
      
      .main-image {
        height: 300px;
      }
    }
  `]
})
export class ProductDetailComponent implements OnInit {
  annonce: Annonce | null = null;
  selectedImage: string = '';

  constructor(
    private route: ActivatedRoute,
    private annonceService: AnnonceService,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnnonce(Number(id));
    }
  }

  loadAnnonce(id: number) {
    this.annonceService.getAnnonceById(id).subscribe({
      next: (annonce) => {
        this.annonce = annonce;
        if (annonce.images.length > 0) {
          this.selectedImage = annonce.images[0];
        }
      },
      error: (err) => {
        console.error('Error loading annonce:', err);
        this.router.navigate(['/']);
      }
    });
  }

  contactSeller() {
    if (this.annonce) {
      this.annonceService.contactSeller(this.annonce.id).subscribe();
    }
  }

  getWhatsAppLink(): string {
    if (!this.annonce) return '';
    const message = encodeURIComponent(`Bonjour, je suis intéressé(e) par votre annonce: ${this.annonce.title}`);
    return `https://wa.me/${this.annonce.sellerPhone.replace(/[^0-9]/g, '')}?text=${message}`;
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

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'FEMME': 'Femmes',
      'HOMME': 'Hommes',
      'ACCESSOIRE': 'Accessoires',
      'PROMOTION': 'Promotions'
    };
    return labels[category] || category;
  }

  getConditionLabel(condition: string): string {
    const labels: { [key: string]: string } = {
      'NEUF': 'Neuf',
      'OCCASION': 'Occasion',
      'TRES_BON_ETAT': 'Très bon état',
      'BON_ETAT': 'Bon état'
    };
    return labels[condition] || condition;
  }

  getFacebookShareLink(): string {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.annonce?.title || '');
    return `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
  }

  getWhatsAppShareLink(): string {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Découvrez cette annonce: ${this.annonce?.title || ''}`);
    return `https://wa.me/?text=${text}%20${url}`;
  }

  copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Lien copié dans le presse-papiers !');
    });
  }
}
