import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, RouterLink } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService, User } from './services/auth.service';
import { AdminAlertsService } from './services/admin-alerts.service';
import { FooterUserComponent } from './components/footer/footer_user/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HeaderComponent, FooterComponent, CommonModule, FooterUserComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Vendit';
  currentRoute = '';
  currentUser: User | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private adminAlerts: AdminAlertsService
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
    });
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.adminAlerts.startPolling();
      } else {
        this.adminAlerts.stopPolling();
      }
    });
  }

  showFloatingButton(): boolean {
    const path = (this.currentRoute || '').split('?')[0];
    const isHome = path === '/' || path === '';
    // Accueil : CTA vendre déjà dans le hero + header ; pas de doublon flottant
    return !isHome &&
           !this.currentRoute.includes('/vendre') &&
           !this.currentRoute.includes('/admin') &&
           !this.currentRoute.includes('/login') &&
           !this.currentRoute.includes('/register');
  }
}
