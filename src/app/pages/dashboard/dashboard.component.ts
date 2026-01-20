import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import { AuthService, User } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { TarifService, PublicationTarif } from '../../services/tarif.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  userRole: 'ADMIN' | 'VENDEUR' | 'USER' = 'USER';
  
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
  
  // Client - Recent & Suggestions
  recentAnnonces: Annonce[] = [];
  suggestedAnnonces: Annonce[] = [];
  
  // Tarifs (for display)
  tarifs: PublicationTarif[] = [];

  constructor(
    private annonceService: AnnonceService,
    private authService: AuthService,
    private adminService: AdminService,
    private tarifService: TarifService
  ) {}

  ngOnInit() {
    this.loadUser();
    this.loadTarifs();
  }

  loadUser() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.userRole = user.role;
        this.loadDashboardData();
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
  }

  loadClientDashboard() {
    // Load recent annonces (top viewed) - fallback to top annonces if endpoint doesn't exist
    this.annonceService.getTopAnnonces(undefined, 6).subscribe({
      next: (annonces) => {
        this.recentAnnonces = annonces;
      },
      error: (err) => {
        console.error('Error loading recent annonces:', err);
        // Fallback: load top annonces without type filter
        this.annonceService.getTopAnnonces(undefined, 6).subscribe({
          next: (annonces) => this.recentAnnonces = annonces
        });
      }
    });

    // Load suggested annonces (top pub)
    this.annonceService.getTopAnnonces('TOP_PUB', 6).subscribe({
      next: (annonces) => {
        this.suggestedAnnonces = annonces;
      },
      error: (err) => console.error('Error loading suggested annonces:', err)
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
      categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
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
}
