import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'VestiSen';
  currentRoute = '';

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
    });
  }

  showFloatingButton(): boolean {
    // Ne pas afficher sur les pages de création/vendre et admin
    return !this.currentRoute.includes('/vendre') && 
           !this.currentRoute.includes('/admin') &&
           !this.currentRoute.includes('/login') &&
           !this.currentRoute.includes('/register');
  }
}
