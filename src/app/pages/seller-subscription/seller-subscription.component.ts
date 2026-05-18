import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CommissionBreakdown,
  SaleCommission,
  SellerPlanCatalogItem,
  SellerPlanService,
  SellerSubscriptionStatus
} from '../../services/seller-plan.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seller-subscription',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './seller-subscription.component.html',
  styleUrls: ['./seller-subscription.component.css']
})
export class SellerSubscriptionComponent implements OnInit {
  loading = true;
  status: SellerSubscriptionStatus | null = null;
  catalog: SellerPlanCatalogItem[] = [];
  billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  subscribing = false;

  commissions: SaleCommission[] = [];
  commissionsPage = 0;
  commissionsTotalPages = 0;
  commissionsTotal = 0;
  readonly commissionsPageSize = 10;
  loadingCommissions = false;

  previewAmount = 10000;
  commissionPreview: CommissionBreakdown | null = null;

  constructor(
    private sellerPlanService: SellerPlanService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.sellerPlanService.getCatalog().subscribe({
      next: (c) => {
        this.catalog = c ?? [];
      },
      error: () => {
        this.catalog = [];
      }
    });
    this.sellerPlanService.getStatus().subscribe({
      next: (s) => {
        this.status = s;
        this.syncAuthPlan(s);
        this.loading = false;
        this.loadCommissions(0);
        this.refreshCommissionPreview();
      },
      error: () => {
        this.status = null;
        this.loading = false;
      }
    });
  }

  get publicationsLimitReached(): boolean {
    const s = this.status;
    if (!s || s.unlimitedPublications) {
      return false;
    }
    return s.activePublicationsCount >= s.maxActivePublications;
  }

  planPrice(item: SellerPlanCatalogItem): number {
    return this.billingCycle === 'ANNUAL' ? item.annualPriceFcfa : item.monthlyPriceFcfa;
  }

  billingLabel(): string {
    return this.billingCycle === 'ANNUAL' ? 'an' : 'mois';
  }

  subscribe(plan: string): void {
    if (this.subscribing || !this.status) {
      return;
    }
    const item = this.catalog.find((p) => p.plan === plan);
    const label = item?.label ?? plan;
    const price = item ? this.planPrice(item) : 0;
    Swal.fire({
      title: `Passer au plan ${label} ?`,
      html:
        plan === 'FREE'
          ? 'Retour au plan Gratuit : commission 15 %, 5 publications actives.'
          : `Facturation ${this.billingCycle === 'ANNUAL' ? 'annuelle' : 'mensuelle'} — <strong>${price.toLocaleString('fr-FR')}</strong> FCFA (démo locale si Stripe non configuré).`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmer'
    }).then((r) => {
      if (!r.isConfirmed) {
        return;
      }
      this.subscribing = true;
      this.sellerPlanService.subscribe(plan, this.billingCycle).subscribe({
        next: (s) => {
          this.status = s;
          this.syncAuthPlan(s);
          this.subscribing = false;
          Swal.fire('Plan mis à jour', `Vous êtes sur le plan ${s.planLabel}.`, 'success');
        },
        error: (err) => {
          this.subscribing = false;
          const msg = err?.error?.message ?? err?.error ?? 'Impossible de changer de plan.';
          Swal.fire('Erreur', String(msg), 'error');
        }
      });
    });
  }

  loadCommissions(page: number): void {
    this.loadingCommissions = true;
    this.commissionsPage = page;
    this.sellerPlanService.getCommissions(page, this.commissionsPageSize).subscribe({
      next: (res) => {
        this.commissions = res.content ?? [];
        this.commissionsTotalPages = res.totalPages;
        this.commissionsTotal = res.totalElements;
        this.loadingCommissions = false;
      },
      error: () => {
        this.commissions = [];
        this.loadingCommissions = false;
      }
    });
  }

  onPreviewAmountChange(): void {
    this.refreshCommissionPreview();
  }

  private refreshCommissionPreview(): void {
    const amount = Number(this.previewAmount);
    if (!amount || amount <= 0) {
      this.commissionPreview = null;
      return;
    }
    this.sellerPlanService.previewCommission(amount).subscribe({
      next: (p) => {
        this.commissionPreview = p;
      },
      error: () => {
        this.commissionPreview = null;
      }
    });
  }

  private syncAuthPlan(s: SellerSubscriptionStatus): void {
    this.authService.patchSessionUser({
      sellerPlan: s.currentPlan,
      sellerPlanLabel: s.planLabel,
      creditBalance: s.creditBalance
    });
  }
}
