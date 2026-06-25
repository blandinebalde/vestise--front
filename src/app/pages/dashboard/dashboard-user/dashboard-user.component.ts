import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../../services/annonce.service';
import { User } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { ConversationService } from '../../../services/conversation.service';
import { getDashboardImageUrl } from '../dashboard-view.utils';

@Component({
  selector: 'app-dashboard-user',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['./dashboard-user.component.css']
})
export class DashboardUserComponent implements OnChanges {
  @Input({ required: true }) user!: User;

  cartItems: Annonce[] = [];
  myPurchases: Annonce[] = [];
  messageThreadCount = 0;
  messageUnreadCount = 0;

  getImageUrl = getDashboardImageUrl;

  get cartTotal(): number {
    return this.cartItems.reduce((sum, a) => sum + (a.price ?? 0), 0);
  }

  get pendingPurchasesCount(): number {
    return this.myPurchases.filter((a) => a.status === 'RESERVED').length;
  }

  get soldPurchasesCount(): number {
    return this.myPurchases.filter((a) => a.status === 'SOLD').length;
  }

  get userInitial(): string {
    const n = (this.user?.firstName || this.user?.email || '?').trim();
    return n.charAt(0).toUpperCase();
  }

  constructor(
    private annonceService: AnnonceService,
    private cartService: CartService,
    private conversationService: ConversationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']?.currentValue) {
      this.load();
    }
  }

  private load(): void {
    this.cartService.getCart().subscribe({
      next: (items) => {
        this.cartItems = items ?? [];
      },
      error: () => {
        this.cartItems = [];
      }
    });
    this.annonceService.getMyPurchases().subscribe({
      next: (list) => {
        this.myPurchases = list ?? [];
      },
      error: () => {
        this.myPurchases = [];
      }
    });
    this.loadMessageSummary();
  }

  private loadMessageSummary(): void {
    this.conversationService.listMine().subscribe({
      next: (list) => {
        const buyerId = this.user?.publicId;
        const buyerConvs = (list ?? []).filter((c) => c.buyerPublicId === buyerId);
        this.messageThreadCount = buyerConvs.length;
        this.messageUnreadCount = ConversationService.countUnread(buyerConvs, buyerId);
        this.conversationService.refreshUnreadCounts();
      },
      error: () => {
        this.messageThreadCount = 0;
        this.messageUnreadCount = 0;
      }
    });
  }

  removeFromCart(annoncePublicId: string): void {
    this.cartService.removeFromCart(annoncePublicId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(a => a.publicId !== annoncePublicId);
      },
      error: (err) => console.error('Error removing from cart:', err)
    });
  }

  reservePurchase(annoncePublicId: string): void {
    this.annonceService.buyAnnonce(annoncePublicId).subscribe({
      next: (purchased) => {
        this.cartItems = this.cartItems.filter(a => a.publicId !== annoncePublicId);
        this.myPurchases = [purchased, ...this.myPurchases];
      },
      error: (err) => {
        console.error('Error reserving purchase:', err);
        alert(err.error?.message || 'Impossible de réserver cet achat.');
      }
    });
  }

  purchaseStatusLabel(annonce: Annonce): string {
    if (annonce.status === 'RESERVED') return 'En attente vendeur';
    if (annonce.status === 'SOLD') return 'Vendu';
    return annonce.status;
  }

  purchaseStatusClass(annonce: Annonce): string {
    if (annonce.status === 'RESERVED') return 'cu-purchase-row__badge--pending';
    if (annonce.status === 'SOLD') return 'cu-purchase-row__badge--sold';
    return '';
  }
}
