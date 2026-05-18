import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { NavigationService, NavLink } from '../../services/navigation.service';
import { imageUrlFor } from '../../config/api.config';
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
    // Client (USER) : profil, tableau de bord, panier
    if (this.currentUser?.role === 'USER') {
      this.userLinks = [
        { path: this.navigationService.PROFILE, label: 'Mon profil', requiresAuth: true },
        { path: this.navigationService.DASHBOARD, label: 'Mon Tableau de bord', requiresAuth: true },
        { path: this.navigationService.CART, label: 'Mon panier', requiresAuth: true }
      ];
      return;
    }
    // Vendeur et Admin : profil, tableau de bord, vendre, etc.
    this.userLinks = [
      { path: this.navigationService.PROFILE, label: 'Mon profil', requiresAuth: true },
      { path: this.navigationService.DASHBOARD, label: 'Mon Tableau de bord', requiresAuth: true },
      { path: this.navigationService.VENDRE, label: 'Vendre un article', requiresAuth: true },
      { path: this.navigationService.MONETISATION, label: 'Crédits & abonnement', requiresAuth: true },
      { path: this.navigationService.HISTORY, label: 'Mon historique', requiresAuth: true },
      { path: this.navigationService.ANNOUNCE_HISTORY, label: 'Mon historique d\'annonces', requiresAuth: true }
    ];
    if (this.authService.isAdmin()) {
      this.userLinks.push({ path: this.navigationService.ADMIN, label: 'Administration', requiresAdmin: true });
    }
  }

  /** URL de l'avatar ou chaîne vide */
  getAvatarUrl(user: User | null): string {
    if (!user?.avatarPath) return '';
    return imageUrlFor(user.avatarPath) ?? '';
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
