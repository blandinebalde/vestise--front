import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../../services/annonce.service';
import { User } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { getDashboardImageUrl } from '../dashboard-view.utils';

@Component({
  selector: 'app-dashboard-user',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['../dashboard.component.css']
})
export class DashboardUserComponent implements OnChanges {
  @Input({ required: true }) user!: User;

  cartItems: Annonce[] = [];
  myPurchases: Annonce[] = [];

  getImageUrl = getDashboardImageUrl;

  constructor(
    private annonceService: AnnonceService,
    private cartService: CartService
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
  }

  removeFromCart(annoncePublicId: string): void {
    this.cartService.removeFromCart(annoncePublicId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(a => a.publicId !== annoncePublicId);
      },
      error: (err) => console.error('Error removing from cart:', err)
    });
  }

  confirmPurchase(annoncePublicId: string): void {
    this.annonceService.buyAnnonce(annoncePublicId).subscribe({
      next: (purchased) => {
        this.cartItems = this.cartItems.filter(a => a.publicId !== annoncePublicId);
        this.myPurchases = [purchased, ...this.myPurchases];
      },
      error: (err) => {
        console.error('Error confirming purchase:', err);
        alert(err.error?.message || 'Impossible de confirmer l\'achat.');
      }
    });
  }
}
