import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  showFAQ(event: Event) {
    event.preventDefault();
    // TODO: Implémenter modal FAQ ou navigation vers page FAQ
    alert('FAQ - Questions fréquentes\n\n1. Comment publier une annonce ?\n2. Quels sont les tarifs ?\n3. Comment contacter un vendeur ?\n4. Puis-je modifier mon annonce ?');
  }
}
