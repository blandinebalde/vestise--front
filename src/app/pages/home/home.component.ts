import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce } from '../../services/annonce.service';
import { CategoryService, Category } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';
import { API_BASE_URL } from '../../config/api.config';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  annonces: Annonce[] = [];
  categories: Category[] = [];

  constructor(
    private annonceService: AnnonceService,
    private categoryService: CategoryService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadAnnonces();
    this.loadCategories();
  }

  loadAnnonces() {
    this.annonceService.getTopAnnonces('Top Pub', 12).subscribe({
      next: (list) => {
        this.annonces = list?.length ? list : [];
        if (this.annonces.length === 0) {
          this.annonceService.getAnnonces({ page: 0, pageSize: 12 }).subscribe({
            next: (res) => this.annonces = res.content || [],
            error: () => {}
          });
        }
      },
      error: () => {
        this.annonceService.getAnnonces({ page: 0, pageSize: 12 }).subscribe({
          next: (res) => this.annonces = res.content || [],
          error: () => {}
        });
      }
    });
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (list) => this.categories = list || [],
      error: () => {}
    });
  }

  getImageUrl(image: string): string {
    if (!image) return '';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}/${image}`;
  }

  getConditionLabel(condition: string | undefined): string {
    if (!condition) return '';
    const labels: { [key: string]: string } = {
      'NEUF': 'Neuf',
      'OCCASION': 'Occasion',
      'TRES_BON_ETAT': 'Très bon état',
      'BON_ETAT': 'Bon état'
    };
    return labels[condition] || condition;
  }
}
