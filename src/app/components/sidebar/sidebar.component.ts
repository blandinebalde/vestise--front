import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { NavigationService, NavLink } from '../../services/navigation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();
  
  currentUser: User | null = null;
  userLinks: NavLink[] = [];
  
  private userSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateUserLinks();
    });
    this.updateUserLinks();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private updateUserLinks(): void {
    if (!this.authService.isAuthenticated()) {
      this.userLinks = [];
      return;
    }
    // Client (USER) : uniquement tableau de bord (panier + historique d'achat)
    if (this.currentUser?.role === 'USER') {
      this.userLinks = [
        { path: this.navigationService.DASHBOARD, label: 'Mon Tableau de bord', requiresAuth: true },
        { path: this.navigationService.CART, label: 'Mon panier', requiresAuth: true }
      ];
      return;
    }
    // Vendeur et Admin : tableau de bord, vendre, acheter des crédits
    this.userLinks = [
      { path: this.navigationService.DASHBOARD, label: 'Mon Tableau de bord', requiresAuth: true },
      { path: this.navigationService.VENDRE, label: 'Vendre un article', requiresAuth: true },
      { path: this.navigationService.CREDITS, label: 'Acheter des crédits', requiresAuth: true },
      { path: this.navigationService.HISTORY, label: 'Mon historique', requiresAuth: true },
      { path: this.navigationService.ANNOUNCE_HISTORY, label: 'Mon historique d\'annonces', requiresAuth: true }
    ];
    if (this.authService.isAdmin()) {
      this.userLinks.push({ path: this.navigationService.ADMIN, label: 'Administration', requiresAdmin: true });
    }
  }

  /** Libellé du rôle pour l'affichage */
  getRoleLabel(role: string | undefined): string {
    const labels: { [key: string]: string } = {
      'ADMIN': 'Administrateur',
      'VENDEUR': 'Vendeur',
      'USER': 'Client'
    };
    return role ? (labels[role] ?? role) : 'Utilisateur';
  }

  onClose() {
    this.closeSidebar.emit();
  }

  logout() {
    this.authService.logout();
    this.navigationService.navigateToHome();
    this.onClose();
  }
}
