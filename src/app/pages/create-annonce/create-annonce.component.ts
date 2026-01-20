import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnnonceService } from '../../services/annonce.service';
import { TarifService, PublicationTarif } from '../../services/tarif.service';
import { PaymentService } from '../../services/payment.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-annonce',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-annonce.component.html',
  styleUrls: ['./create-annonce.component.css']
})
export class CreateAnnonceComponent implements OnInit {
  annonce: any = {
    title: '',
    description: '',
    price: null,
    category: 'FEMME',
    publicationType: 'STANDARD',
    condition: '',
    size: '',
    brand: '',
    location: '',
    images: []
  };
  tarifs: PublicationTarif[] = [];
  selectedTarif: PublicationTarif | null = null;
  error = '';
  loading = false;
  showPaymentStep = false;
  createdAnnonceId: number | null = null;

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private paymentService: PaymentService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadTarifs();
  }

  loadTarifs() {
    this.tarifService.getTarifs().subscribe({
      next: (tarifs) => {
        this.tarifs = tarifs.filter(t => t.active);
        this.updateSelectedTarif();
      },
      error: (err) => {
        console.error('Error loading tarifs:', err);
      }
    });
  }

  updateSelectedTarif() {
    this.selectedTarif = this.tarifs.find(t => t.publicationType === this.annonce.publicationType) || null;
  }

  onPublicationTypeChange() {
    this.updateSelectedTarif();
  }

  onSubmit() {
    this.error = '';
    this.loading = true;

    // Étape 1 : Créer l'annonce (statut PENDING)
    this.annonceService.createAnnonce(this.annonce).subscribe({
      next: (createdAnnonce) => {
        this.createdAnnonceId = createdAnnonce.id;
        this.loading = false;
        this.showPaymentStep = true;
        
        // Afficher les informations de paiement
        Swal.fire({
          icon: 'info',
          title: 'Paiement requis',
          html: `
            <p>Votre annonce a été créée avec succès !</p>
            <p><strong>Type de publication :</strong> ${this.getPublicationTypeLabel(this.annonce.publicationType)}</p>
            <p><strong>Montant à payer :</strong> ${this.selectedTarif?.price.toLocaleString()} FCFA</p>
            <p><strong>Durée :</strong> ${this.selectedTarif?.durationDays} jours</p>
            <p>Veuillez procéder au paiement pour publier votre annonce.</p>
          `,
          confirmButtonText: 'Procéder au paiement',
          confirmButtonColor: '#007bff'
        }).then(() => {
          this.initiatePayment();
        });
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création de l\'annonce. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  initiatePayment() {
    if (!this.createdAnnonceId) {
      this.error = 'Erreur : ID de l\'annonce manquant';
      return;
    }

    this.loading = true;

    // Pour l'instant, on utilise STRIPE par défaut
    // TODO: Ajouter un sélecteur de méthode de paiement
    this.paymentService.createPayment({
      annonceId: this.createdAnnonceId,
      paymentMethod: 'STRIPE'
    }).subscribe({
      next: (payment) => {
        this.loading = false;
        
        if (payment.paymentMethod === 'STRIPE' && payment.transactionId) {
          // Rediriger vers Stripe Checkout ou afficher le formulaire de paiement
          Swal.fire({
            icon: 'success',
            title: 'Paiement initié',
            html: `
              <p>Votre paiement a été initié avec succès.</p>
              <p>Une fois le paiement confirmé, votre annonce sera automatiquement publiée.</p>
            `,
            confirmButtonText: 'Voir mes annonces',
            confirmButtonColor: '#007bff'
          }).then(() => {
            this.router.navigate(['/dashboard']);
          });
        } else {
          // Pour Orange Money ou Wave, afficher les instructions
          Swal.fire({
            icon: 'info',
            title: 'Instructions de paiement',
            html: `
              <p>Veuillez effectuer le paiement via ${this.getPaymentMethodLabel(payment.paymentMethod)}.</p>
              <p><strong>Montant :</strong> ${payment.amount.toLocaleString()} FCFA</p>
              <p>Une fois le paiement effectué, votre annonce sera automatiquement publiée.</p>
            `,
            confirmButtonText: 'Compris',
            confirmButtonColor: '#007bff'
          }).then(() => {
            this.router.navigate(['/dashboard']);
          });
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l\'initialisation du paiement. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  getPublicationTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'STANDARD': 'Standard - Visibilité normale',
      'PREMIUM': 'Premium - Visibilité prioritaire dans la catégorie',
      'TOP_PUB': 'Top Pub - Mise en avant sur la page d\'accueil et newsletter'
    };
    return labels[type] || type;
  }

  getPaymentMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'STRIPE': 'Carte bancaire (Stripe)',
      'ORANGE_MONEY': 'Orange Money',
      'WAVE': 'Wave'
    };
    return labels[method] || method;
  }

  cancel() {
    this.router.navigate(['/dashboard']);
  }
}
