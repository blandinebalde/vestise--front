import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { NavigationService, NavLink } from '../../services/navigation.service';
import { ConversationService } from '../../services/conversation.service';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { CategoryService, Category } from '../../services/category.service';
import { imageUrlFor } from '../../config/api.config';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Subscription } from 'rxjs';

/** Liens affichés dans la barre principale (hors menu compte). */
const HEADER_NAV_LINKS: NavLink[] = [
  { path: '/', label: 'Accueil' },
  { path: '/catalogue', label: 'Catalogue' }
];

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
  notifOpen = false;
  currentUser: User | null = null;
  quickCategories: Category[] = [];
  readonly navLinks = HEADER_NAV_LINKS;

  private userSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    public navigationService: NavigationService,
    public conversationService: ConversationService,
    public notificationService: NotificationService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadQuickCategories();
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.conversationService.refreshUnreadCounts();
      }
    });
    if (this.authService.isAuthenticated()) {
      this.conversationService.refreshUnreadCounts();
    }
  }

  private loadQuickCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.quickCategories = (categories || []).filter((cat) => cat.active !== false).slice(0, 10);
      },
      error: () => (this.quickCategories = [])
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  get showVendre(): boolean {
    return this.authService.isVendeur();
  }

  get showMessages(): boolean {
    return this.authService.isAuthenticated();
  }

  get showNotifications(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Barre de catégories (second niveau) : visible pour les visiteurs non connectés
   * et les clients (USER). Masquée pour vendeur et admin.
   */
  get showQuickCategories(): boolean {
    if (!this.authService.isAuthenticated()) {
      return true;
    }
    return this.currentUser?.role === 'USER';
  }

  get messagesPath(): string {
    return this.currentUser?.role === 'USER'
      ? this.navigationService.MY_MESSAGES
      : this.navigationService.SELLER_MESSAGES;
  }

  onSearch(): void {
    const q = this.searchQuery.trim();
    if (q) {
      this.navigationService.navigateToCatalogue(q);
      this.searchQuery = '';
      this.closeMobileMenu();
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) {
      this.notificationService.refresh();
    }
  }

  closeNotifications(): void {
    this.notifOpen = false;
  }

  markNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  openNotification(item: AppNotification): void {
    this.notificationService.navigateTo(item);
    this.closeNotifications();
    this.closeMobileMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.notifOpen = false;
  }

  getAvatarUrl(user: User | null): string {
    if (!user?.avatarPath) return '';
    return imageUrlFor(user.avatarPath) ?? '';
  }

  getInitials(user: User | null): string {
    if (!user) return '?';
    const f = (user.firstName?.charAt(0) || '?').toUpperCase();
    const l = (user.lastName?.charAt(0) || '?').toUpperCase();
    return f + l;
  }
}
