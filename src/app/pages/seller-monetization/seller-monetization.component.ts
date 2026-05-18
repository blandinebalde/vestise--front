import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CreditConfig,
  CreditLedgerEntry,
  CreditService
} from '../../services/credit.service';
import {
  CommissionBreakdown,
  SaleCommission,
  SellerPlanCatalogItem,
  SellerPlanService,
  SellerSubscriptionStatus,
  SubscriptionCheckout,
  SubscriptionQuote
} from '../../services/seller-plan.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

export type MonetizationTab = 'credits' | 'abonnement';

const CREDITS_LOW_THRESHOLD = 5;

@Component({
  selector: 'app-seller-monetization',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './seller-monetization.component.html',
  styleUrls: ['./seller-monetization.component.css']
})
export class SellerMonetizationComponent implements OnInit {
  activeTab: MonetizationTab = 'credits';
  pageLoading = true;

  config: CreditConfig | null = null;
  balance = 0;
  ledger: CreditLedgerEntry[] = [];
  ledgerLoading = false;

  credits = 10;
  paymentMethod: 'STRIPE' | 'WAVE' | 'CARD' = 'STRIPE';
  purchaseLoading = false;
  purchaseError = '';
  amountFcfa = 0;

  status: SellerSubscriptionStatus | null = null;
  catalog: SellerPlanCatalogItem[] = [];
  billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  subscribing = false;

  /** Parcours souscription : choose → recap → payment → done */
  subStep: 'choose' | 'recap' | 'payment' | 'done' = 'choose';
  selectedPlan: string | null = null;
  subQuote: SubscriptionQuote | null = null;
  subCheckout: SubscriptionCheckout | null = null;
  subIdempotencyKey = '';
  quoteLoading = false;

  commissions: SaleCommission[] = [];
  commissionsPage = 0;
  commissionsTotalPages = 0;
  commissionsTotal = 0;
  readonly commissionsPageSize = 10;
  loadingCommissions = false;

  previewAmount = 10000;
  commissionPreview: CommissionBreakdown | null = null;

  readonly creditsLowThreshold = CREDITS_LOW_THRESHOLD;

  constructor(
    private creditService: CreditService,
    private sellerPlanService: SellerPlanService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.resolveInitialTab();
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'abonnement' || tab === 'credits') {
        this.activeTab = tab;
      }
    });
    this.reloadAll();
  }

  private resolveInitialTab(): void {
    const dataTab = this.route.snapshot.data['tab'] as MonetizationTab | undefined;
    const queryTab = this.route.snapshot.queryParamMap.get('tab') as MonetizationTab | null;
    if (queryTab === 'abonnement' || queryTab === 'credits') {
      this.activeTab = queryTab;
    } else if (dataTab === 'abonnement' || dataTab === 'credits') {
      this.activeTab = dataTab;
    } else if (this.router.url.includes('/abonnement')) {
      this.activeTab = 'abonnement';
    }
  }

  setTab(tab: MonetizationTab): void {
    if (tab !== 'abonnement') {
      this.resetSubscriptionFlow();
    }
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  reloadAll(): void {
    this.pageLoading = true;
    forkJoin({
      config: this.creditService.getConfig(),
      balance: this.creditService.getBalance(),
      catalog: this.sellerPlanService.getCatalog(),
      status: this.sellerPlanService.getStatus()
    }).subscribe({
      next: ({ config, balance, catalog, status }) => {
        this.config = config;
        this.balance = balance;
        this.updateAmount();
        this.catalog = catalog ?? [];
        this.status = status;
        this.syncAuth(status);
        this.pageLoading = false;
        this.loadLedger();
        this.loadCommissions(0);
        this.refreshCommissionPreview();
      },
      error: () => {
        this.pageLoading = false;
        Swal.fire('Erreur', 'Impossible de charger vos informations.', 'error');
      }
    });
  }

  get creditsLow(): boolean {
    return this.balance < CREDITS_LOW_THRESHOLD;
  }

  get publicationsLimitReached(): boolean {
    const s = this.status;
    if (!s || s.unlimitedPublications) {
      return false;
    }
    return s.activePublicationsCount >= s.maxActivePublications;
  }

  get canPayWithSubscription(): boolean {
    return !!this.status?.canPayWithSubscription;
  }

  get subscriptionActive(): boolean {
    return !!this.status?.subscriptionPeriodActive;
  }

  planPrice(item: SellerPlanCatalogItem): number {
    return this.billingCycle === 'ANNUAL' ? item.annualPriceFcfa : item.monthlyPriceFcfa;
  }

  billingLabel(): string {
    return this.billingCycle === 'ANNUAL' ? 'an' : 'mois';
  }

  planRank(planCode: string): number {
    const code = planCode?.toUpperCase() ?? '';
    if (code === 'PREMIUM') {
      return 2;
    }
    if (code === 'PRO') {
      return 1;
    }
    return 0;
  }

  isUpgrade(planCode: string): boolean {
    if (!this.status) {
      return planCode !== 'FREE';
    }
    return this.planRank(planCode) > this.planRank(this.status.currentPlan);
  }

  isDowngrade(planCode: string): boolean {
    if (!this.status) {
      return false;
    }
    return this.planRank(planCode) < this.planRank(this.status.currentPlan);
  }

  planSelectable(planCode: string): boolean {
    if (this.status?.currentPlan === planCode) {
      return false;
    }
    return this.isUpgrade(planCode) || (this.isDowngrade(planCode) && !!this.status?.downgradeLocked);
  }

  planDisabledReason(planCode: string): string {
    if (this.status?.currentPlan === planCode) {
      return 'Plan actuel';
    }
    if (this.isDowngrade(planCode) && !this.status?.downgradeLocked) {
      return 'Downgrade non disponible en cours de cycle';
    }
    if (this.isDowngrade(planCode)) {
      return 'Planifiable en fin de cycle';
    }
    return '';
  }

  resetSubscriptionFlow(): void {
    this.subStep = 'choose';
    this.selectedPlan = null;
    this.subQuote = null;
    this.subCheckout = null;
    this.subIdempotencyKey = '';
  }

  startPlanChange(plan: string): void {
    if (!this.planSelectable(plan) && !this.isDowngrade(plan)) {
      return;
    }
    if (this.isDowngrade(plan)) {
      this.confirmScheduleDowngrade(plan);
      return;
    }
    this.selectedPlan = plan;
    this.quoteLoading = true;
    this.sellerPlanService.getQuote(plan, this.billingCycle).subscribe({
      next: (q) => {
        this.subQuote = q;
        this.subStep = 'recap';
        this.quoteLoading = false;
      },
      error: (err) => {
        this.quoteLoading = false;
        Swal.fire('Erreur', err?.error?.message ?? 'Impossible de calculer le montant.', 'error');
      }
    });
  }

  proceedToPayment(): void {
    if (!this.selectedPlan) {
      return;
    }
    this.subIdempotencyKey = crypto.randomUUID?.() ?? `idem-${Date.now()}`;
    this.subscribing = true;
    this.sellerPlanService.startCheckout(this.selectedPlan, this.billingCycle, this.subIdempotencyKey).subscribe({
      next: (c) => {
        this.subCheckout = c;
        this.subStep = 'payment';
        this.subscribing = false;
      },
      error: (err) => {
        this.subscribing = false;
        Swal.fire('Erreur', err?.error?.message ?? 'Paiement indisponible.', 'error');
      }
    });
  }

  confirmSubscriptionPayment(): void {
    if (!this.subCheckout) {
      return;
    }
    this.subscribing = true;
    this.sellerPlanService
      .confirmCheckout(this.subCheckout.checkoutId, this.subIdempotencyKey)
      .subscribe({
        next: (s) => {
          this.status = s;
          this.syncAuth(s);
          this.subStep = 'done';
          this.subscribing = false;
        },
        error: (err) => {
          this.subscribing = false;
          Swal.fire('Erreur', err?.error?.message ?? 'Confirmation impossible.', 'error');
        }
      });
  }

  confirmScheduleDowngrade(plan: string): void {
    const item = this.catalog.find((p) => p.plan === plan);
    Swal.fire({
      title: `Planifier le passage au plan ${item?.label ?? plan} ?`,
      html: `<p class="vm-muted">Le changement prendra effet à la fin de votre cycle. Vous conservez tous vos avantages jusqu'à cette date.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Planifier'
    }).then((r) => {
      if (!r.isConfirmed) {
        return;
      }
      this.subscribing = true;
      this.sellerPlanService
        .scheduleDowngrade(plan, this.status?.subscriptionVersion)
        .subscribe({
          next: (s) => {
            this.status = s;
            this.syncAuth(s);
            this.subscribing = false;
            Swal.fire(
              'Downgrade planifié',
              `Passage au plan ${s.scheduledDowngradeLabel ?? plan} à la fin de la période.`,
              'success'
            );
          },
          error: (err) => {
            this.subscribing = false;
            Swal.fire('Erreur', err?.error?.message ?? 'Impossible de planifier.', 'error');
          }
        });
    });
  }

  cancelScheduledDowngrade(): void {
    this.subscribing = true;
    this.sellerPlanService.cancelScheduledDowngrade(this.status?.subscriptionVersion).subscribe({
      next: (s) => {
        this.status = s;
        this.syncAuth(s);
        this.subscribing = false;
        Swal.fire('Annulé', 'Le downgrade planifié a été annulé.', 'success');
      },
      error: (err) => {
        this.subscribing = false;
        Swal.fire('Erreur', err?.error?.message ?? 'Impossible d\'annuler.', 'error');
      }
    });
  }

  publicationsPercent(): number {
    const s = this.status;
    if (!s || s.unlimitedPublications || s.maxActivePublications <= 0) {
      return 0;
    }
    return Math.min(100, (s.activePublicationsCount / s.maxActivePublications) * 100);
  }

  boostsPercent(): number {
    const s = this.status;
    if (!s || s.monthlyBoostsIncluded <= 0) {
      return 0;
    }
    const used = s.monthlyBoostsIncluded - s.boostsRemaining;
    return Math.min(100, (used / s.monthlyBoostsIncluded) * 100);
  }

  subscriptionStatusKind(): 'active' | 'grace' | 'past_due' | 'inactive' {
    const s = this.status;
    if (!s) {
      return 'inactive';
    }
    if (s.inGracePeriod) {
      return 'grace';
    }
    if (s.subscriptionStatus === 'PAST_DUE') {
      return 'past_due';
    }
    if (s.subscriptionPeriodActive) {
      return 'active';
    }
    return 'inactive';
  }

  subscriptionStatusLabel(): string {
    const kind = this.subscriptionStatusKind();
    if (kind === 'grace') {
      return 'Période de grâce';
    }
    if (kind === 'past_due') {
      return 'Paiement en retard';
    }
    if (kind === 'active') {
      return 'Abonnement actif';
    }
    return 'Sans abonnement payant';
  }

  setBillingCycle(cycle: 'MONTHLY' | 'ANNUAL'): void {
    this.billingCycle = cycle;
  }

  subStepNumber(): number {
    const steps: Record<typeof this.subStep, number> = {
      choose: 1,
      recap: 2,
      payment: 3,
      done: 4
    };
    return steps[this.subStep];
  }

  planAccent(planCode: string): 'free' | 'pro' | 'gold' {
    const code = planCode?.toUpperCase() ?? '';
    if (code === 'PREMIUM') {
      return 'gold';
    }
    if (code === 'PRO') {
      return 'pro';
    }
    return 'free';
  }

  updateAmount(): void {
    if (this.config) {
      this.amountFcfa = this.credits * this.config.pricePerCreditFcfa;
    }
  }

  onCreditsChange(): void {
    this.updateAmount();
  }

  loadLedger(): void {
    this.ledgerLoading = true;
    this.creditService.getLedger().subscribe({
      next: (list) => {
        this.ledger = (list ?? []).slice(0, 20);
        this.ledgerLoading = false;
      },
      error: () => {
        this.ledger = [];
        this.ledgerLoading = false;
      }
    });
  }

  buyCredits(): void {
    this.purchaseError = '';
    if (this.credits < 1) {
      this.purchaseError = 'Choisissez au moins 1 crédit.';
      return;
    }
    this.purchaseLoading = true;
    this.creditService
      .purchaseCredits({ credits: this.credits, paymentMethod: this.paymentMethod })
      .subscribe({
        next: (res) => {
          const stripeSecret = res.clientSecret && String(res.clientSecret).includes('_secret_');
          const useRealStripe = this.paymentMethod === 'STRIPE' && stripeSecret;
          if (useRealStripe) {
            this.purchaseLoading = false;
            Swal.fire({
              icon: 'info',
              title: 'Paiement Stripe',
              html: `<p>Montant : <strong>${res.amountFcfa?.toLocaleString?.() ?? res.amountFcfa} FCFA</strong></p>`,
              confirmButtonText: 'Confirmer (test)',
              confirmButtonColor: '#B8956B'
            }).then(() => this.confirmPurchase(res.transactionPublicId));
          } else {
            this.confirmPurchase(res.transactionPublicId);
          }
        },
        error: (err) => {
          this.purchaseLoading = false;
          this.purchaseError = err.error?.message || "Erreur lors de l'achat de crédits.";
        }
      });
  }

  confirmPurchase(transactionPublicId: string): void {
    this.purchaseLoading = true;
    this.creditService.confirmPurchase(transactionPublicId).subscribe({
      next: (tx) => {
        const added = typeof tx.creditsAdded === 'number' ? tx.creditsAdded : this.credits;
        this.creditService.getBalance().subscribe({
          next: (newBalance) => {
            this.balance = newBalance;
            this.authService.refreshCreditBalance(newBalance);
            if (this.status) {
              this.status = { ...this.status, creditBalance: newBalance };
            }
          }
        });
        this.purchaseLoading = false;
        this.loadLedger();
        Swal.fire({
          icon: 'success',
          title: 'Crédits ajoutés',
          text: `${added} crédit${added > 1 ? 's' : ''} ajouté(s) à votre compte.`,
          confirmButtonColor: '#7D9B76'
        });
      },
      error: (err) => {
        this.purchaseLoading = false;
        this.purchaseError = err.error?.message || 'Erreur lors de la confirmation.';
      }
    });
  }

  subscribe(plan: string): void {
    this.startPlanChange(plan);
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

  ledgerLabel(entry: CreditLedgerEntry): string {
    if (entry.movementType === 'PURCHASE') {
      return 'Achat';
    }
    if (entry.movementType === 'PUBLICATION') {
      return 'Publication';
    }
    return entry.movementType;
  }

  private syncAuth(s: SellerSubscriptionStatus): void {
    this.authService.patchSessionUser({
      sellerPlan: s.currentPlan,
      sellerPlanLabel: s.planLabel,
      creditBalance: s.creditBalance
    });
  }
}
