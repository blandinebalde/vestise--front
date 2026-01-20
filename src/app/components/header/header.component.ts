import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { NavigationService, NavLink } from '../../services/navigation.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  searchQuery = '';
  mobileMenuOpen = false;
  sidebarOpen = false;
  currentUser: User | null = null;
  navLinks: NavLink[] = [];
  
  private userSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    public navigationService: NavigationService
  ) {}
  
  ngOnInit() {
    // S'abonner aux changements de l'utilisateur
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateNavLinks();
    });
    
    // Initialiser les liens de navigation
    this.updateNavLinks();
  }
  
  ngOnDestroy() {
    // Nettoyer l'abonnement
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  /**
   * Mettre à jour les liens de navigation selon le statut de l'utilisateur
   */
  private updateNavLinks(): void {
    // Pour le header, on affiche seulement les liens publics
    this.navLinks = this.navigationService.getPublicLinks();
  }
  
  onSearch() {
    if (this.searchQuery.trim()) {
      this.navigationService.navigateToCatalogue(this.searchQuery);
      this.searchQuery = ''; // Réinitialiser la recherche après navigation
    }
  }
  
  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
  
  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }
  
  logout() {
    this.authService.logout();
    this.navigationService.navigateToHome();
    this.closeMobileMenu();
    this.closeSidebar();
  }
}
