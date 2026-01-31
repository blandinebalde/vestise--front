import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export interface NavLink {
  path: string;
  label: string;
  icon?: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  readonly CART = '/cart';
  readonly HISTORY = '/history';
  readonly ANNOUNCE_HISTORY = '/announce-history';
  // Routes principales
  readonly HOME = '/';
  readonly CATALOGUE = '/catalogue';
  readonly VENDRE = '/vendre';
  readonly DASHBOARD = '/dashboard';
  readonly ADMIN = '/admin';
  readonly CREDITS = '/credits';
  readonly LOGIN = '/login';
  readonly REGISTER = '/register';
  readonly CONTACT = '/contact';
  readonly PRODUCT_DETAIL = '/produit';


  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  /**
   * Liste des liens de navigation publics
   */
  getPublicLinks(): NavLink[] {
    return [
      { path: this.HOME, label: 'Accueil' },
      { path: this.CATALOGUE, label: 'Annonces' }
    ];
  }

  /**
   * Liste des liens de navigation pour utilisateurs authentifiés
   */
  getAuthenticatedLinks(): NavLink[] {
    return [
      { path: this.HOME, label: 'Accueil' },
      { path: this.CATALOGUE, label: 'Annonces' },
      { path: this.VENDRE, label: 'Vendre', requiresAuth: true },
      { path: this.DASHBOARD, label: 'Mon compte', requiresAuth: true },
      { path: this.CART, label: 'Mon panier', requiresAuth: true },
      { path: this.HISTORY, label: 'Mon historique', requiresAuth: true },
      { path: this.ANNOUNCE_HISTORY, label: 'Mon historique d\'annonces', requiresAuth: true }
    ];
  }

  /**
   * Liste des liens de navigation pour administrateurs
   */
  getAdminLinks(): NavLink[] {
    return [
      { path: this.HOME, label: 'Accueil' },
      { path: this.CATALOGUE, label: 'Annonces' },
      { path: this.VENDRE, label: 'Vendre', requiresAuth: true },
      { path: this.DASHBOARD, label: 'Mon compte', requiresAuth: true },
      { path: this.CART, label: 'Mon panier', requiresAuth: true },
      { path: this.HISTORY, label: 'Mon historique', requiresAuth: true },
      { path: this.ANNOUNCE_HISTORY, label: 'Mon historique d\'annonces', requiresAuth: true },
      { path: this.ADMIN, label: 'Admin', requiresAdmin: true }
    ];
  }

  /**
   * Obtenir tous les liens de navigation selon le statut de l'utilisateur
   * Filtre automatiquement les liens selon les permissions
   */
  getNavLinks(): NavLink[] {
    let links: NavLink[] = [];
    
    if (this.authService.isAdmin()) {
      links = this.getAdminLinks();
    } else if (this.authService.isAuthenticated()) {
      links = this.getAuthenticatedLinks();
    } else {
      links = this.getPublicLinks();
    }
    
    // Filtrer les liens selon les permissions
    return links.filter(link => this.shouldShowLink(link));
  }

  /**
   * Vérifier si un lien doit être affiché
   */
  shouldShowLink(link: NavLink): boolean {
    if (link.requiresAdmin && !this.authService.isAdmin()) {
      return false;
    }
    if (link.requiresAuth && !this.authService.isAuthenticated()) {
      return false;
    }
    return true;
  }

  /**
   * Navigation vers la page d'accueil
   */
  navigateToHome(): void {
    this.router.navigate([this.HOME]);
  }

  /**
   * Navigation vers le catalogue
   */
  navigateToCatalogue(searchQuery?: string): void {
    if (searchQuery) {
      this.router.navigate([this.CATALOGUE], { 
        queryParams: { search: searchQuery } 
      });
    } else {
      this.router.navigate([this.CATALOGUE]);
    }
  }

  /**
   * Navigation vers la page de vente
   */
  navigateToVendre(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.VENDRE]);
    } else {
      this.router.navigate([this.LOGIN], { 
        queryParams: { returnUrl: this.VENDRE } 
      });
    }
  }

  /**
   * Navigation vers le tableau de bord
   */
  navigateToDashboard(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.DASHBOARD]);
    } else {
      this.router.navigate([this.LOGIN], { 
        queryParams: { returnUrl: this.DASHBOARD } 
      });
    }
  }

  /**
   * Navigation vers l'administration
   */
  navigateToAdmin(): void {
    if (this.authService.isAdmin()) {
      this.router.navigate([this.ADMIN]);
    } else {
      this.router.navigate([this.HOME]);
    }
  }

  /**
   * Navigation vers la page de connexion
   */
  navigateToLogin(returnUrl?: string): void {
    const queryParams = returnUrl ? { returnUrl } : {};
    this.router.navigate([this.LOGIN], { queryParams });
  }

  /**
   * Navigation vers la page d'inscription
   */
  navigateToRegister(): void {
    this.router.navigate([this.REGISTER]);
  }

  /**
   * Navigation vers la page de contact
   */
  navigateToContact(): void {
    this.router.navigate([this.CONTACT]);
  }

  /**
   * Navigation vers les détails d'un produit
   */
  navigateToProductDetail(productId: number | string): void {
    this.router.navigate([this.PRODUCT_DETAIL, productId]);
  }

  /**
   * Navigation générique
   */
  navigate(path: string, queryParams?: any): void {
    if (queryParams) {
      this.router.navigate([path], { queryParams });
    } else {
      this.router.navigate([path]);
    }
  }
}
