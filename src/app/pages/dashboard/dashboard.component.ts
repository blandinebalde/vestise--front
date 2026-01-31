import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import { AuthService, User } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { TarifService, PublicationTarif } from '../../services/tarif.service';
import { CreditService, CreditTransactionDTO } from '../../services/credit.service';
import { CartService } from '../../services/cart.service';
import { API_BASE_URL } from '../../config/api.config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  userRole: 'ADMIN' | 'VENDEUR' | 'USER' = 'USER';
  private destroy$ = new Subject<void>();
  
  // Vendeur & Admin - Annonces
  annonces: Annonce[] = [];
  totalViews = 0;
  totalContacts = 0;
  pendingAnnonces = 0;
  approvedAnnonces = 0;
  rejectedAnnonces = 0;
  
  // Admin - Global Stats
  totalAnnoncesGlobal = 0;
  totalUsersGlobal = 0;
  totalVendeurs = 0;
  totalClients = 0;
  dailyRevenue = 0;
  weeklyRevenue = 0;
  monthlyRevenue = 0;
  topCategories: { name: string; count: number }[] = [];
  
  // Client - Panier & Historique achats
  cartItems: Annonce[] = [];
  myPurchases: Annonce[] = [];
  // Client - Recent & Suggestions (fallback)
  recentAnnonces: Annonce[] = [];
  suggestedAnnonces: Annonce[] = [];
  // Vendeur - Historique crédits
  creditTransactions: CreditTransactionDTO[] = [];
  
  // Tarifs (for display)
  tarifs: PublicationTarif[] = [];

  constructor(
    private annonceService: AnnonceService,
    private authService: AuthService,
    private adminService: AdminService,
    private tarifService: TarifService,
    private creditService: CreditService,
    private cartService: CartService
  ) {}

  ngOnInit() {
    this.loadUser();
    this.loadTarifs();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUser() {
    this.authService.currentUser$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id && a?.role === b?.role),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.userRole = user.role;
          this.loadDashboardData();
          if (user.role === 'VENDEUR' || user.role === 'ADMIN') {
            this.creditService.getBalance().subscribe({
              next: (b) => this.authService.refreshCreditBalance(b)
            });
          }
        }
      });
  }

  loadDashboardData() {
    switch (this.userRole) {
      case 'ADMIN':
        this.loadAdminDashboard();
        break;
      case 'VENDEUR':
        this.loadVendeurDashboard();
        break;
      case 'USER':
        this.loadClientDashboard();
        break;
    }
  }

  loadAdminDashboard() {
    // Load all annonces
    this.annonceService.getAllAnnoncesForAdmin(0, 100).subscribe({
      next: (response) => {
        this.annonces = response.content;
        this.totalAnnoncesGlobal = response.totalElements;
        this.pendingAnnonces = this.annonces.filter(a => a.status === 'PENDING').length;
        this.approvedAnnonces = this.annonces.filter(a => a.status === 'APPROVED').length;
        this.rejectedAnnonces = this.annonces.filter(a => a.status === 'REJECTED').length;
        this.calculateTopCategories();
        this.calculateRevenue();
      },
      error: (err) => console.error('Error loading admin annonces:', err)
    });

    // Load users
    this.adminService.getAllUsers(0, 100).subscribe({
      next: (response) => {
        this.totalUsersGlobal = response.totalElements;
        this.totalVendeurs = response.content.filter(u => u.role === 'VENDEUR').length;
        this.totalClients = response.content.filter(u => u.role === 'USER').length;
      },
      error: (err) => console.error('Error loading users:', err)
    });
  }

  loadVendeurDashboard() {
    this.annonceService.getMyAnnonces(0, 100).subscribe({
      next: (response) => {
        this.annonces = response.content;
        this.totalViews = this.annonces.reduce((sum, a) => sum + a.viewCount, 0);
        this.totalContacts = this.annonces.reduce((sum, a) => sum + a.contactCount, 0);
        this.pendingAnnonces = this.annonces.filter(a => a.status === 'PENDING').length;
        this.approvedAnnonces = this.annonces.filter(a => a.status === 'APPROVED').length;
        this.rejectedAnnonces = this.annonces.filter(a => a.status === 'REJECTED').length;
      },
      error: (err) => console.error('Error loading vendeur annonces:', err)
    });
    this.creditService.getTransactions().subscribe({
      next: (list) => { this.creditTransactions = list ?? []; },
      error: () => { this.creditTransactions = []; }
    });
  }

  loadClientDashboard() {
    this.cartService.getCart().subscribe({
      next: (items) => { this.cartItems = items ?? []; },
      error: () => { this.cartItems = []; }
    });
    this.annonceService.getMyPurchases().subscribe({
      next: (list) => { this.myPurchases = list ?? []; },
      error: () => { this.myPurchases = []; }
    });
  }

  loadTarifs() {
    this.tarifService.getTarifs().subscribe({
      next: (tarifs) => {
        this.tarifs = tarifs;
      },
      error: (err) => console.error('Error loading tarifs:', err)
    });
  }

  calculateTopCategories() {
    const categoryCount: { [key: string]: number } = {};
    this.annonces.forEach(a => {
      const key = a.categoryName ?? String(a.categoryId ?? '');
      categoryCount[key] = (categoryCount[key] || 0) + 1;
    });
    this.topCategories = Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  calculateRevenue() {
    // Calculate revenue from approved annonces with payment
    // This is a simplified calculation - in real app, you'd query payments
    this.monthlyRevenue = this.approvedAnnonces * 5000; // Placeholder
    this.weeklyRevenue = Math.floor(this.monthlyRevenue / 4);
    this.dailyRevenue = Math.floor(this.monthlyRevenue / 30);
  }

  getImageUrl(image: string | undefined): string {
    if (image == null || image === '') return '';
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

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PENDING': 'En attente',
      'APPROVED': 'Approuvée',
      'REJECTED': 'Rejetée',
      'SOLD': 'Vendue',
      'EXPIRED': 'Expirée'
    };
    return labels[status] || status;
  }

  removeFromCart(annonceId: number) {
    this.cartService.removeFromCart(annonceId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(a => a.id !== annonceId);
      },
      error: (err) => console.error('Error removing from cart:', err)
    });
  }

  confirmPurchase(annonceId: number) {
    this.annonceService.buyAnnonce(annonceId).subscribe({
      next: (purchased) => {
        this.cartItems = this.cartItems.filter(a => a.id !== annonceId);
        this.myPurchases = [purchased, ...this.myPurchases];
      },
      error: (err) => {
        console.error('Error confirming purchase:', err);
        alert(err.error?.message || 'Impossible de confirmer l\'achat.');
      }
    });
  }
}
