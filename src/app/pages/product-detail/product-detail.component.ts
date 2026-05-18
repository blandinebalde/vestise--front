import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import {
  ConversationService,
  ConversationDTO,
  MessageDTO
} from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { API_BASE_URL } from '../../config/api.config';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface InfoRow {
  icon: string;
  label: string;
  value: string;
  valueClass?: string;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('chatMessagesEl') chatMessagesEl?: ElementRef<HTMLElement>;

  annonce: Annonce | null = null;
  loading = true;
  selectedImageIndex = 0;
  liked = false;
  canAddToCart = false;
  inCart = false;
  addedToCart = false;

  chatOpen = false;
  chatLoading = false;
  conversation: ConversationDTO | null = null;
  newMessage = '';
  sending = false;

  adClientId = '';
  adSlotId = '';

  private readonly placeholderPalettes = [
    { bg: '#EEEDFE', icon: '#7F77DD' },
    { bg: '#FAECE7', icon: '#D85A30' },
    { bg: '#E1F5EE', icon: '#1D9E75' },
    { bg: '#FAEEDA', icon: '#BA7517' }
  ];

  private readonly sellerPalettes = [
    { bg: '#EEEDFE', text: '#3C3489' },
    { bg: '#FAECE7', text: '#712B13' },
    { bg: '#E1F5EE', text: '#085041' },
    { bg: '#FBEAF0', text: '#72243E' }
  ];

  constructor(
    private route: ActivatedRoute,
    private annonceService: AnnonceService,
    private conversationService: ConversationService,
    public authService: AuthService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnnonce(id);
    } else {
      this.loading = false;
      this.router.navigate(['/catalogue']);
    }
  }

  ngAfterViewInit(): void {
    if (!this.adSlotId || !this.adClientId) return;
    this.loadAdSense();
  }

  get selectedImage(): string {
    const imgs = this.annonce?.images ?? [];
    return imgs[this.selectedImageIndex] ?? imgs[0] ?? '';
  }

  get imageCount(): number {
    return this.annonce?.images?.length ?? 0;
  }

  get isSold(): boolean {
    return this.annonce?.status === 'SOLD';
  }

  get isBoosted(): boolean {
    const t = (this.annonce?.publicationType || '').toLowerCase();
    return t.includes('top') || t.includes('premium') || t.includes('boost');
  }

  get hasImages(): boolean {
    return this.imageCount > 0;
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get isOwnListing(): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && !!this.annonce && user.publicId === this.annonce.sellerPublicId;
  }

  get displayRating(): string {
    const v = this.annonce?.viewCount ?? 0;
    return Math.min(5, 3.5 + Math.log10(v + 1) * 0.4).toFixed(1);
  }

  get reviewLabel(): string {
    const c = this.annonce?.contactCount ?? 0;
    const v = this.annonce?.viewCount ?? 0;
    const n = Math.max(c, Math.floor(v / 8));
    return `${n} avis`;
  }

  get fullStars(): number[] {
    const n = Math.round(Number(this.displayRating));
    return Array.from({ length: Math.min(5, Math.max(0, n)) }, (_, i) => i);
  }

  get emptyStars(): number[] {
    return Array.from({ length: 5 - this.fullStars.length }, (_, i) => i);
  }

  get detailRows(): InfoRow[] {
    if (!this.annonce) return [];
    const rows: InfoRow[] = [];
    if (this.annonce.brand) {
      rows.push({ icon: '⌁', label: 'Marque', value: this.annonce.brand });
    }
    if (this.annonce.size) {
      rows.push({ icon: '↕', label: 'Taille', value: this.annonce.size });
    }
    if (this.annonce.color) {
      rows.push({ icon: '◐', label: 'Couleur', value: this.annonce.color });
    }
    const pub = this.publishedRelative;
    if (pub) {
      rows.push({ icon: '▦', label: 'Publié', value: pub });
    }
    if (this.annonce.viewCount > 0) {
      rows.push({
        icon: '◎',
        label: 'Vues',
        value: this.annonce.viewCount.toLocaleString('fr-FR')
      });
    }
    if (this.annonce.code) {
      rows.push({ icon: '#', label: 'Réf.', value: this.annonce.code });
    }
    return rows;
  }

  get deliveryRows(): InfoRow[] {
    if (!this.annonce) return [];
    const rows: InfoRow[] = [];
    if (this.annonce.acceptPaymentOnDelivery) {
      rows.push({
        icon: '✓',
        label: 'Paiement',
        value: 'À la livraison',
        valueClass: 'fp-info__val--ok'
      });
    }
    rows.push({
      icon: '⌂',
      label: 'Retrait',
      value: 'Sur place',
      valueClass: this.annonce.location ? '' : 'fp-info__val--ok'
    });
    if (this.annonce.location) {
      rows.push({ icon: '⌖', label: 'Zone', value: this.annonce.location });
    }
    rows.push({
      icon: '⛨',
      label: 'Protection',
      value: 'Achat sécurisé',
      valueClass: 'fp-info__val--violet'
    });
    if (this.annonce.toutDoitPartir) {
      rows.push({ icon: '⚡', label: 'Promo', value: 'Tout doit partir' });
    }
    return rows;
  }

  get descriptionPills(): string[] {
    if (!this.annonce) return [];
    const pills = new Set<string>();
    if (this.annonce.categoryName) pills.add(this.annonce.categoryName);
    if (this.annonce.brand) pills.add(this.annonce.brand);
    if (this.annonce.color) pills.add(this.annonce.color);
    if (this.annonce.condition) pills.add(this.getConditionLabel(this.annonce.condition));
    if (this.annonce.isLot) pills.add('Lot');
    return [...pills];
  }

  get publishedRelative(): string {
    const iso = this.annonce?.publishedAt || this.annonce?.createdAt;
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Il y a 1 jour';
    if (days < 30) return `Il y a ${days} jours`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get sessionBadgeLabel(): string {
    if (!this.isAuthenticated) {
      return `Invité #${1000 + ((this.annonce?.publicId?.length ?? 0) % 8999)}`;
    }
    const u = this.authService.getCurrentUser();
    const name = u?.firstName || u?.email?.split('@')[0] || 'Moi';
    return name.length > 12 ? name.slice(0, 11) + '…' : name;
  }

  get chatMessages(): MessageDTO[] {
    return this.conversation?.messages ?? [];
  }

  thumbStyle(index: number): { bg: string; icon: string } {
    return this.placeholderPalettes[index % this.placeholderPalettes.length];
  }

  private loadAdSense(): void {
    if (typeof document === 'undefined') return;
    const id = 'adsbygoogle-script';
    if (document.getElementById(id)) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ignore */
      }
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
      } catch {
        /* ignore */
      }
    };
    document.head.appendChild(script);
  }

  loadAnnonce(publicId: string): void {
    this.loading = true;
    this.annonceService.getAnnonceById(publicId).subscribe({
      next: (annonce) => {
        this.annonce = annonce;
        this.selectedImageIndex = 0;
        const user = this.authService.getCurrentUser();
        this.canAddToCart =
          this.authService.isAuthenticated() &&
          !!user &&
          user.publicId !== annonce.sellerPublicId &&
          annonce.status !== 'SOLD';
        if (this.canAddToCart) {
          this.cartService.getCart().subscribe({
            next: (items) => {
              this.inCart = (items ?? []).some((a) => a.publicId === annonce.publicId);
            },
            error: () => {}
          });
        }
        this.loading = false;
        if (this.adClientId && this.adSlotId) {
          setTimeout(() => this.loadAdSense(), 100);
        }
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/catalogue']);
      }
    });
  }

  selectImage(index: number): void {
    if (index >= 0 && index < this.imageCount) {
      this.selectedImageIndex = index;
    }
  }

  toggleLike(): void {
    this.liked = !this.liked;
  }

  placeholderStyle(): { bg: string; icon: string } {
    const seed = this.annonce?.categoryId ?? this.annonce?.title?.length ?? 0;
    return this.placeholderPalettes[seed % this.placeholderPalettes.length];
  }

  sellerStyle(): { bg: string; text: string } {
    const seed = this.annonce?.sellerName?.length ?? 0;
    return this.sellerPalettes[seed % this.sellerPalettes.length];
  }

  sellerInitials(): string {
    const name = (this.annonce?.sellerName || 'V').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  sellerSubtitle(): string {
    const loc = this.annonce?.location;
    const contacts = this.annonce?.contactCount ?? 0;
    const parts: string[] = [];
    if (contacts > 0) parts.push(`${contacts} contact${contacts > 1 ? 's' : ''}`);
    parts.push(`Note ${this.displayRating}`);
    if (loc) parts.push(loc);
    return parts.join(' · ');
  }

  addToCart(): void {
    if (!this.annonce) return;
    this.cartService.addToCart(this.annonce.publicId).subscribe({
      next: () => {
        this.addedToCart = true;
        this.inCart = true;
      },
      error: (err) => alert(err.error?.message ?? "Impossible d'ajouter au panier.")
    });
  }

  openChatPanel(): void {
    if (!this.annonce || this.isOwnListing) return;
    this.chatOpen = true;
    setTimeout(() => {
      document.getElementById('fp-chat-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    if (!this.isAuthenticated) {
      return;
    }
    if (this.conversation) {
      this.scrollChatToBottom();
      return;
    }
    this.chatLoading = true;
    this.conversationService.getOrCreate(this.annonce.publicId).subscribe({
      next: (conv) => {
        this.conversation = conv;
        this.chatLoading = false;
        this.contactSeller();
        setTimeout(() => this.scrollChatToBottom(), 50);
      },
      error: (err) => {
        this.chatLoading = false;
        alert(err.error?.message ?? "Impossible d'ouvrir la messagerie.");
      }
    });
  }

  closeChatPanel(): void {
    this.chatOpen = false;
  }

  goToLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  sendChatMessage(): void {
    if (!this.conversation || !this.newMessage.trim() || this.sending) return;
    const content = this.newMessage.trim();
    this.sending = true;
    this.conversationService
      .sendMessage({
        conversationPublicId: this.conversation.publicId,
        content
      })
      .subscribe({
        next: (msg) => {
          this.conversation!.messages = [...(this.conversation!.messages || []), msg];
          this.newMessage = '';
          this.sending = false;
          setTimeout(() => this.scrollChatToBottom(), 30);
        },
        error: (err) => {
          this.sending = false;
          alert(err.error?.message ?? "Erreur lors de l'envoi.");
        }
      });
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  isMine(msg: MessageDTO): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && msg.senderPublicId === user.publicId;
  }

  messageMeta(msg: MessageDTO): string {
    const name = msg.senderName?.split(' ')[0] || '…';
    const d = new Date(msg.createdAt);
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${name} · ${time}`;
  }

  contactSeller(): void {
    if (this.annonce) {
      this.annonceService.contactSeller(this.annonce.publicId).subscribe();
    }
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}/${image}`;
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

  conditionBadgeClass(condition?: string): string {
    switch (condition) {
      case 'NEUF':
        return 'fp-badge--neuf';
      case 'TRES_BON_ETAT':
        return 'fp-badge--tresbon';
      case 'BON_ETAT':
        return 'fp-badge--bon';
      case 'OCCASION':
        return 'fp-badge--occ';
      default:
        return 'fp-badge--default';
    }
  }

  private scrollChatToBottom(): void {
    const el = this.chatMessagesEl?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
