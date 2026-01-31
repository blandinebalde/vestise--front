import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import { ConversationService } from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { API_BASE_URL } from '../../config/api.config';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit, AfterViewInit {
  annonce: Annonce | null = null;
  selectedImage = '';
  canAddToCart = false;
  inCart = false;
  addedToCart = false;

  /** Google AdSense : à remplir pour afficher les annonces (ex: ca-pub-XXXXXXXX) */
  adClientId = '';
  /** Google AdSense : numéro du slot (ex: XXXXXXXXXX) */
  adSlotId = '';

  constructor(
    private route: ActivatedRoute,
    private annonceService: AnnonceService,
    private conversationService: ConversationService,
    public authService: AuthService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnnonce(Number(id));
    }
  }

  ngAfterViewInit() {
    if (!this.adSlotId || !this.adClientId) return;
    this.loadAdSense();
  }

  private loadAdSense() {
    if (typeof document === 'undefined') return;
    const id = 'adsbygoogle-script';
    if (document.getElementById(id)) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (_) {}
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.adClientId}`;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (_) {}
    };
    document.head.appendChild(script);
  }

  loadAnnonce(id: number) {
    this.annonceService.getAnnonceById(id).subscribe({
      next: (annonce) => {
        this.annonce = annonce;
        if (annonce.images?.length) {
          this.selectedImage = annonce.images[0];
        }
        const user = this.authService.getCurrentUser();
        this.canAddToCart =
          this.authService.isAuthenticated() &&
          !!user &&
          user.id !== annonce.sellerId &&
          annonce.status !== 'SOLD';
        if (this.canAddToCart) {
          this.cartService.getCart().subscribe({
            next: (items) => {
              this.inCart = (items ?? []).some((a) => a.id === annonce.id);
            },
            error: () => {}
          });
        }
        if (this.adClientId && this.adSlotId) {
          setTimeout(() => this.loadAdSense(), 100);
        }
      },
      error: () => this.router.navigate(['/'])
    });
  }

  addToCart() {
    if (!this.annonce) return;
    this.cartService.addToCart(this.annonce.id).subscribe({
      next: () => {
        this.addedToCart = true;
        this.inCart = true;
      },
      error: (err) =>
        alert(err.error?.message ?? "Impossible d'ajouter au panier.")
    });
  }

  openChat() {
    if (!this.annonce) return;
    this.conversationService.getOrCreate(this.annonce.id).subscribe({
      next: (conv) => this.router.navigate(['/chat', conv.id]),
      error: (err) =>
        alert(err.error?.message ?? "Impossible d'ouvrir le chat.")
    });
  }

  contactSeller() {
    if (this.annonce) {
      this.annonceService.contactSeller(this.annonce.id).subscribe();
    }
  }

  getWhatsAppLink(): string {
    if (!this.annonce) return '';
    const msg = encodeURIComponent(
      `Bonjour, je suis intéressé(e) par: ${this.annonce.title}`
    );
    const phone = this.annonce.sellerPhone?.replace(/[^0-9]/g, '') ?? '';
    return `https://wa.me/${phone}?text=${msg}`;
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}/${image}`;
  }

  getPublicationTypeLabel(type: string): string {
    return type ?? '';
  }

  getPublicationTypeClass(type: string): string {
    return (type ?? '').toLowerCase().replace(/\s+/g, '-');
  }

  getConditionLabel(condition: string): string {
    const labels: Record<string, string> = {
      NEUF: 'Neuf',
      OCCASION: 'Occasion',
      TRES_BON_ETAT: 'Très bon état',
      BON_ETAT: 'Bon état'
    };
    return labels[condition] ?? condition;
  }

  getFacebookShareLink(): string {
    const url = encodeURIComponent(window.location.href);
    return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  }

  getWhatsAppShareLink(): string {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Découvrez cette annonce: ${this.annonce?.title ?? ''}`
    );
    return `https://wa.me/?text=${text}%20${url}`;
  }

  copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Lien copié.');
    });
  }
}
