import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CreditService, CreditConfig } from '../../services/credit.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-buy-credits',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './buy-credits.component.html',
  styleUrls: ['./buy-credits.component.css']
})
export class BuyCreditsComponent implements OnInit {
  config: CreditConfig | null = null;
  balance = 0;
  credits = 10;
  paymentMethod: 'STRIPE' | 'WAVE' | 'CARD' = 'STRIPE';
  loading = false;
  error = '';
  pendingTransactionId: number | null = null;
  amountFcfa = 0;

  constructor(
    private creditService: CreditService,
    private authService: AuthService,
    private router: Router
  ) {}

  cancel() {
    this.router.navigate(['/dashboard']);
  }

  ngOnInit() {
    this.creditService.getConfig().subscribe({
      next: (c) => {
        this.config = c;
        this.updateAmount();
      },
      error: () => {}
    });
    this.creditService.getBalance().subscribe({
      next: (b) => { this.balance = b; },
      error: () => {}
    });
  }

  updateAmount() {
    if (this.config) {
      this.amountFcfa = this.credits * this.config.pricePerCreditFcfa;
    }
  }

  onCreditsChange() {
    this.updateAmount();
  }

  buyCredits() {
    this.error = '';
    if (this.credits < 1) {
      this.error = 'Choisissez au moins 1 crédit.';
      return;
    }
    this.loading = true;
    this.creditService.purchaseCredits({
      credits: this.credits,
      paymentMethod: this.paymentMethod
    }).subscribe({
      next: (res) => {
        this.pendingTransactionId = res.transactionId;
        this.amountFcfa = res.amountFcfa;
        // Paiement réel non intégré : on laisse passer en confirmant tout de suite (prévu pour Stripe/Wave plus tard)
        const stripeSecret = res.clientSecret && String(res.clientSecret).includes('_secret_');
        const useRealStripe = this.paymentMethod === 'STRIPE' && stripeSecret;
        if (useRealStripe) {
          this.loading = false;
          Swal.fire({
            icon: 'info',
            title: 'Paiement Stripe',
            html: `
              <p>Montant : <strong>${res.amountFcfa?.toLocaleString?.() ?? res.amountFcfa} FCFA</strong> (${res.creditsAdded} crédits)</p>
              <p>L'intégration Stripe Elements sera disponible prochainement. En test, confirmez pour créditer le compte.</p>
            `,
            confirmButtonText: 'Confirmer (test)',
            confirmButtonColor: '#B8956B'
          }).then(() => this.confirmPurchase(res.transactionId));
        } else {
          // Carte / Wave sans Stripe : confirmation immédiate (achat qui passe)
          this.confirmPurchase(res.transactionId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de l\'achat de crédits.';
      }
    });
  }

  confirmPurchase(transactionId: number) {
    this.loading = true;
    this.creditService.confirmPurchase(transactionId).subscribe({
      next: (tx) => {
        this.pendingTransactionId = null;
        const added = typeof tx.creditsAdded === 'number' ? tx.creditsAdded : (tx as any).creditsAdded;
        this.creditService.getBalance().subscribe({
          next: (newBalance) => {
            this.balance = newBalance;
            this.authService.refreshCreditBalance(newBalance);
          }
        });
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: 'Crédits ajoutés',
          text: `${added ?? this.credits} crédit${(added ?? this.credits) > 1 ? 's' : ''} ont été ajoutés à votre compte.`,
          confirmButtonColor: '#7D9B76'
        }).then(() => this.router.navigate(['/dashboard']));
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de la confirmation.';
      }
    });
  }
}
