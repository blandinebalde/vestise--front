import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import { AuthService } from '../../services/auth.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  topAnnonces: Annonce[] = [];
  currentSlide = 0;

  constructor(
    private annonceService: AnnonceService,
    public authService: AuthService,
    public navigationService: NavigationService
  ) {}

  ngOnInit() {
    this.loadTopAnnonces();
    this.startCarousel();
  }

  loadTopAnnonces() {
    this.annonceService.getTopAnnonces('TOP_PUB', 8).subscribe({
      next: (annonces) => {
        this.topAnnonces = annonces;
      },
      error: (err) => console.error('Error loading top annonces:', err)
    });
  }

  startCarousel() {
    setInterval(() => {
      if (this.topAnnonces.length > 0) {
        this.currentSlide = (this.currentSlide + 1) % Math.min(3, this.topAnnonces.length);
      }
    }, 5000);
  }

  nextSlide() {
    if (this.topAnnonces.length > 0) {
      this.currentSlide = (this.currentSlide + 1) % Math.min(3, this.topAnnonces.length);
    }
  }

  prevSlide() {
    if (this.topAnnonces.length > 0) {
      this.currentSlide = this.currentSlide === 0 ? Math.min(2, this.topAnnonces.length - 1) : this.currentSlide - 1;
    }
  }

  contactSeller(id: number) {
    this.annonceService.contactSeller(id).subscribe();
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
}
