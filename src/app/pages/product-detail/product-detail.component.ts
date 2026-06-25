import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import {
  cloneConversation,
  ConversationService,
  ConversationDTO,
  MessageDTO,
  CONVERSATION_POLL_MS,
  samePublicId
} from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { imageUrlFor } from '../../config/api.config';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const MAX_CHAT_MESSAGE_LENGTH = 2000;

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chatMessagesEl') chatMessagesEl?: ElementRef<HTMLElement>;

  annonce: Annonce | null = null;
  similarAnnonces: Annonce[] = [];
  sellerAnnonces: Annonce[] = [];
  loading = true;
  selectedImageIndex = 0;
  mainImageFailed = false;
  liked = false;
  canAddToCart = false;
  inCart = false;
  addedToCart = false;

  chatOpen = false;
  chatLoading = false;
  chatError = '';
  conversation: ConversationDTO | null = null;
  newMessage = '';
  sending = false;
  readonly maxChatMessageLength = MAX_CHAT_MESSAGE_LENGTH;

  adClientId = '';
  adSlotId = '';

  lightboxOpen = false;
  lightboxZoom = 1;
  readonly lightboxMinZoom = 1;
  readonly lightboxMaxZoom = 3;
  readonly lightboxZoomStep = 0.25;

  offerOpen = false;
  offerAmount: number | null = null;
  offerError = '';

  private readonly destroy$ = new Subject<void>();
  private pollSub?: Subscription;
  private openChatWhenReady = false;
  private openOfferWhenReady = false;

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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.openChatWhenReady = params['openChat'] === '1' || params['openChat'] === 'true';
      this.openOfferWhenReady = params['openOffer'] === '1' || params['openOffer'] === 'true';
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnnonce(id);
    } else {
      this.loading = false;
      this.router.navigate(['/catalogue']);
    }
  }

  ngOnDestroy(): void {
    this.stopMessagePolling();
    document.body.style.overflow = '';
    this.destroy$.next();
    this.destroy$.complete();
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

  get isReserved(): boolean {
    return this.annonce?.status === 'RESERVED';
  }

  get isReservedByMe(): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && !!this.annonce?.buyerPublicId && user.publicId === this.annonce.buyerPublicId;
  }

  /** Masque achat / panier (article vendu ou déjà réservé). */
  get isPurchaseBlocked(): boolean {
    return this.isSold || this.isReserved;
  }

  /** Assombrit la galerie pour les visiteurs qui ne peuvent plus acheter. */
  get isGalleryUnavailable(): boolean {
    if (this.isSold) return true;
    return this.isReserved && !this.isOwnListing && !this.isReservedByMe;
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

  get showMainImage(): boolean {
    return this.hasImages && !this.mainImageFailed;
  }

  get lightboxZoomPercent(): number {
    return Math.round(this.lightboxZoom * 100);
  }

  get showAdConfigured(): boolean {
    return !!this.adClientId && !!this.adSlotId;
  }

  get suggestedOfferAmount(): number {
    const price = this.annonce?.price ?? 0;
    return Math.max(1, Math.round(price * 0.9));
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.offerOpen) {
        this.closeOfferModal();
        return;
      }
      if (this.lightboxOpen) {
        this.closeLightbox();
      }
      return;
    }
    if (!this.lightboxOpen) return;
    switch (event.key) {
      case 'ArrowLeft':
        this.lightboxPrev();
        break;
      case 'ArrowRight':
        this.lightboxNext();
        break;
      case '+':
      case '=':
        this.zoomIn();
        break;
      case '-':
        this.zoomOut();
        break;
      case '0':
        this.resetZoom();
        break;
    }
  }

  get summaryMetaLine(): string {
    if (!this.annonce) return '';
    const parts: string[] = [];
    if (this.annonce.size) parts.push(this.annonce.size);
    if (this.annonce.condition) parts.push(this.getConditionLabel(this.annonce.condition));
    const pub = this.publishedRelativeShort;
    if (pub) parts.push(pub);
    return parts.join(' · ');
  }

  get publishedRelativeShort(): string {
    const iso = this.annonce?.publishedAt || this.annonce?.createdAt;
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ajouté à l\'instant';
    if (mins < 60) return `Ajouté il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Ajouté il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ajouté il y a 1 jour';
    if (days < 30) return `Ajouté il y a ${days} jours`;
    return this.publishedRelative;
  }

  get deliverySummary(): string {
    if (!this.annonce) return '';
    const parts: string[] = [];
    if (this.annonce.location) {
      parts.push(`Retrait sur place · ${this.annonce.location}`);
    } else {
      parts.push('Retrait sur place');
    }
    if (this.annonce.acceptPaymentOnDelivery) {
      parts.push('Paiement à la livraison possible');
    }
    return parts.join(' · ');
  }

  get sellerMetaLine(): string {
    if (!this.annonce) return '';
    const parts: string[] = [];
    const contacts = this.annonce.contactCount ?? 0;
    if (contacts > 0) parts.push(`${contacts} contact${contacts > 1 ? 's' : ''}`);
    if (this.annonce.location) parts.push(this.annonce.location);
    if (this.annonce.viewCount > 0) {
      parts.push(`${this.annonce.viewCount} vue${this.annonce.viewCount > 1 ? 's' : ''}`);
    }
    return parts.join(' · ') || 'Membre Vestisen';
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

  get canUseChat(): boolean {
    if (!this.annonce || this.isOwnListing || this.isSold) return false;
    if (this.isReserved && !this.isReservedByMe) return false;
    return true;
  }

  get chatContactLabel(): string {
    const n = this.chatMessages.length;
    if (n > 0) {
      return `Contacter le vendeur (${n} message${n > 1 ? 's' : ''})`;
    }
    return 'Contacter le vendeur';
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
        this.mainImageFailed = false;
        this.similarAnnonces = [];
        this.sellerAnnonces = [];
        this.loadRelatedAnnonces(annonce);
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
        if (this.canUseChat && this.isAuthenticated) {
          this.prefetchConversation();
        }
        if (this.openChatWhenReady && this.canUseChat) {
          setTimeout(() => this.openChatPanel(), 200);
        }
        if (this.openOfferWhenReady && this.canUseChat) {
          setTimeout(() => this.openOfferModal(), 200);
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
      this.mainImageFailed = false;
    }
  }

  openLightbox(index?: number): void {
    if (index !== undefined) {
      this.selectImage(index);
    }
    if (!this.hasImages) return;
    this.lightboxOpen = true;
    this.lightboxZoom = 1;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    this.lightboxZoom = 1;
    document.body.style.overflow = '';
  }

  lightboxPrev(event?: Event): void {
    event?.stopPropagation();
    if (this.imageCount <= 1) return;
    this.prevImage();
  }

  lightboxNext(event?: Event): void {
    event?.stopPropagation();
    if (this.imageCount <= 1) return;
    this.nextImage();
  }

  zoomIn(event?: Event): void {
    event?.stopPropagation();
    this.lightboxZoom = Math.min(
      this.lightboxMaxZoom,
      +(this.lightboxZoom + this.lightboxZoomStep).toFixed(2)
    );
  }

  zoomOut(event?: Event): void {
    event?.stopPropagation();
    this.lightboxZoom = Math.max(
      this.lightboxMinZoom,
      +(this.lightboxZoom - this.lightboxZoomStep).toFixed(2)
    );
  }

  resetZoom(event?: Event): void {
    event?.stopPropagation();
    this.lightboxZoom = 1;
  }

  onLightboxWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  onGalleryClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.pd-gallery__nav, .pd-gallery__like, .pd-badge')) {
      return;
    }
    if (this.showMainImage) {
      this.openLightbox();
    }
  }

  prevImage(): void {
    if (this.imageCount <= 1) return;
    this.selectedImageIndex =
      this.selectedImageIndex <= 0 ? this.imageCount - 1 : this.selectedImageIndex - 1;
    this.mainImageFailed = false;
  }

  nextImage(): void {
    if (this.imageCount <= 1) return;
    this.selectedImageIndex =
      this.selectedImageIndex >= this.imageCount - 1 ? 0 : this.selectedImageIndex + 1;
    this.mainImageFailed = false;
  }

  onMainImageError(): void {
    this.mainImageFailed = true;
  }

  formatPrice(price: number): string {
    return (price ?? 0).toLocaleString('fr-FR');
  }

  cardImageUrl(item: Annonce): string {
    const img = item.images?.[0];
    return img ? imageUrlFor(img) : '';
  }

  cardPlaceholder(item: Annonce): { bg: string; icon: string } {
    const seed = item.categoryId ?? item.title?.length ?? 0;
    return this.placeholderPalettes[seed % this.placeholderPalettes.length];
  }

  private loadRelatedAnnonces(annonce: Annonce): void {
    if (annonce.categoryId) {
      this.annonceService
        .getAnnonces({ categoryId: annonce.categoryId, page: 0, pageSize: 12 })
        .subscribe({
          next: (response) => {
            this.similarAnnonces = response.content
              .filter((a) => a.publicId !== annonce.publicId)
              .slice(0, 6);
          },
          error: () => {}
        });
    }

    this.annonceService.getAnnonces({ page: 0, pageSize: 24 }).subscribe({
      next: (response) => {
        this.sellerAnnonces = response.content
          .filter((a) => a.sellerPublicId === annonce.sellerPublicId && a.publicId !== annonce.publicId)
          .slice(0, 6);
      },
      error: () => {}
    });
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

  openOfferModal(): void {
    if (!this.canUseChat) return;
    if (!this.isAuthenticated) {
      this.goToLogin(false, true);
      return;
    }
    this.offerError = '';
    this.offerAmount = this.suggestedOfferAmount;
    this.offerOpen = true;
  }

  closeOfferModal(): void {
    this.offerOpen = false;
    this.offerError = '';
  }

  submitOffer(): void {
    if (!this.annonce) return;
    const amount = Number(this.offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.offerError = 'Indiquez un montant valide.';
      return;
    }
    if (amount > this.annonce.price) {
      this.offerError = "L'offre ne peut pas dépasser le prix affiché.";
      return;
    }
    this.offerError = '';
    this.closeOfferModal();
    this.newMessage =
      `Bonjour, je vous propose ${this.formatPrice(amount)} FCFA pour « ${this.annonce.title} ».`;
    this.openChatPanel();
  }

  openChatPanel(): void {
    if (!this.canUseChat) return;
    this.chatOpen = true;
    this.chatError = '';
    setTimeout(() => {
      document.getElementById('pd-chat-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    if (!this.isAuthenticated) {
      return;
    }
    if (this.conversation) {
      this.refreshConversation(true);
      this.startMessagePolling();
      setTimeout(() => this.scrollChatToBottom(), 50);
      return;
    }
    this.loadConversation(true);
  }

  closeChatPanel(): void {
    this.chatOpen = false;
    this.stopMessagePolling();
  }

  goToLogin(openChat = false, openOffer = false): void {
    const annonceId = this.annonce?.publicId ?? this.route.snapshot.paramMap.get('id');
    let returnUrl = annonceId ? `/produit/${annonceId}` : this.router.url;
    if (openChat) {
      returnUrl += '?openChat=1';
    } else if (openOffer) {
      returnUrl += '?openOffer=1';
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  openFullChatPage(): void {
    if (!this.isAuthenticated) {
      this.goToLogin(true);
      return;
    }
    const navigate = (publicId: string) => {
      this.router.navigate(['/chat', publicId]);
    };
    if (this.conversation?.publicId) {
      navigate(String(this.conversation.publicId));
      return;
    }
    if (!this.annonce) return;
    this.chatLoading = true;
    this.conversationService.getOrCreate(this.annonce.publicId).subscribe({
      next: (conv) => {
        this.conversation = conv;
        this.chatLoading = false;
        navigate(String(conv.publicId));
      },
      error: (err) => {
        this.chatLoading = false;
        this.chatError = this.getChatErrorMessage(err);
        this.chatOpen = true;
      }
    });
  }

  retryLoadConversation(): void {
    this.chatError = '';
    this.conversation = null;
    this.loadConversation(true);
  }

  private prefetchConversation(): void {
    if (!this.annonce || this.conversation) return;
    this.conversationService.getOrCreate(this.annonce.publicId).subscribe({
      next: (conv) => {
        this.conversation = conv;
      },
      error: () => {
        /* silencieux — nouvel essai à l'ouverture */
      }
    });
  }

  private loadConversation(trackContact: boolean): void {
    if (!this.annonce || !this.isAuthenticated) return;
    this.chatLoading = true;
    this.chatError = '';
    this.conversationService
      .getOrCreate(this.annonce.publicId)
      .pipe(switchMap((conv) => this.conversationService.get(String(conv.publicId))))
      .subscribe({
        next: (conv) => {
          this.conversation = cloneConversation(conv);
          this.chatLoading = false;
          if (trackContact) {
            this.contactSeller();
          }
          this.startMessagePolling();
          this.cdr.markForCheck();
          setTimeout(() => this.scrollChatToBottom(), 50);
        },
        error: (err) => {
          this.chatLoading = false;
          this.chatError = this.getChatErrorMessage(err);
          this.stopMessagePolling();
        }
      });
  }

  private refreshConversation(scrollIfNew = false): void {
    const publicId = this.conversation?.publicId;
    if (!publicId) return;
    const prevCount = this.conversation?.messages?.length ?? 0;
    this.conversationService.get(String(publicId)).subscribe({
      next: (conv) => {
        this.conversation = cloneConversation(conv);
        this.cdr.markForCheck();
        if (scrollIfNew && (conv.messages?.length ?? 0) > prevCount) {
          setTimeout(() => this.scrollChatToBottom(), 30);
        }
      },
      error: () => {
        /* ignore poll errors */
      }
    });
  }

  private startMessagePolling(): void {
    this.stopMessagePolling();
    if (!this.isAuthenticated || !this.conversation) return;
    this.pollSub = timer(0, CONVERSATION_POLL_MS).subscribe(() => {
      if (this.chatOpen && this.conversation && !this.sending) {
        this.refreshConversation(true);
      }
    });
  }

  private stopMessagePolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  sendChatMessage(): void {
    if (!this.conversation || !this.newMessage.trim() || this.sending || this.chatLoading) return;
    const content = this.newMessage.trim();
    if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
      this.chatError = `Message trop long (max ${MAX_CHAT_MESSAGE_LENGTH} caractères).`;
      return;
    }
    this.chatError = '';
    this.sending = true;
    this.conversationService
      .sendMessage({
        conversationPublicId: String(this.conversation.publicId),
        content
      })
      .subscribe({
        next: (msg) => {
          const msgs = this.conversation!.messages ?? [];
          if (!msgs.some((m) => m.id === msg.id)) {
            this.conversation = cloneConversation({
              ...this.conversation!,
              messages: [...msgs, msg]
            });
          }
          this.newMessage = '';
          this.sending = false;
          this.cdr.markForCheck();
          this.conversationService.refreshUnreadCounts();
          setTimeout(() => this.scrollChatToBottom(), 30);
        },
        error: (err) => {
          this.sending = false;
          this.chatError = this.getChatErrorMessage(err);
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
    return !!user && samePublicId(msg.senderPublicId, user.publicId);
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
    return imageUrlFor(image);
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

  private scrollChatToBottom(): void {
    const el = this.chatMessagesEl?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private getChatErrorMessage(err: unknown): string {
    const msg = this.authService.getErrorMessage(err);
    if (msg?.toLowerCase().includes('cannot chat with yourself')) {
      return 'Vous ne pouvez pas vous envoyer de messages sur votre propre annonce.';
    }
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status;
      if (status === 401 || status === 403) {
        return 'Connectez-vous pour échanger avec le vendeur.';
      }
    }
    return msg || "Impossible d'utiliser la messagerie.";
  }
}
