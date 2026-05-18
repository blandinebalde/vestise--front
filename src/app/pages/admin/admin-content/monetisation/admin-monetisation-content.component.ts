import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AdminService,
  SellerPlanConfigAdmin,
  SubscriptionPlanStats
} from '../../../../services/admin.service';
import Swal from 'sweetalert2';

export type AdminMonetisationSection = 'credits' | 'plans' | 'tarifs';

export type PlanWizardStep = 1 | 2 | 3 | 4;

export interface PlanWizardStepInfo {
  id: PlanWizardStep;
  label: string;
  short: string;
}

@Component({
  selector: 'app-admin-monetisation-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-monetisation-content.component.html',
  styleUrls: ['./admin-monetisation-content.component.css']
})
export class AdminMonetisationContentComponent implements OnInit {
  activeSection: AdminMonetisationSection = 'credits';

  pageLoading = true;
  creditStats: { creditsPurchased: number; creditsSpent: number } | null = null;

  pricePerCreditFcfa = 100;
  creditsSaving = false;

  plans: SellerPlanConfigAdmin[] = [];
  planStats: SubscriptionPlanStats | null = null;
  savingPlan: string | null = null;

  /** Assistant configuration d'un plan */
  editingPlan: SellerPlanConfigAdmin | null = null;
  planWizardStep: PlanWizardStep = 1;

  readonly wizardSteps: PlanWizardStepInfo[] = [
    { id: 1, label: 'Visibilité', short: '1' },
    { id: 2, label: 'Tarification', short: '2' },
    { id: 3, label: 'Avantages vendeur', short: '3' },
    { id: 4, label: 'Publication', short: '4' }
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.pageLoading = true;
    forkJoin({
      stats: this.adminService.getCreditStats(),
      config: this.adminService.getCreditsConfig(),
      plans: this.adminService.getSellerPlanConfigs(),
      planStats: this.adminService.getSubscriptionPlanStats()
    }).subscribe({
      next: ({ stats, config, plans, planStats }) => {
        this.creditStats = stats;
        this.pricePerCreditFcfa = config.pricePerCreditFcfa ?? 100;
        this.plans = (plans ?? []).sort((a, b) => a.displayOrder - b.displayOrder);
        this.planStats = planStats;
        this.pageLoading = false;
        if (this.editingPlan) {
          const fresh = this.plans.find((p) => p.plan === this.editingPlan!.plan);
          if (fresh) {
            this.editingPlan = { ...fresh };
          }
        }
      },
      error: () => {
        this.pageLoading = false;
        Swal.fire('Erreur', 'Impossible de charger la configuration monétisation.', 'error');
      }
    });
  }

  get creditsInCirculation(): number {
    if (!this.creditStats) {
      return 0;
    }
    return Math.max(0, this.creditStats.creditsPurchased - this.creditStats.creditsSpent);
  }

  get utilizationPercent(): number {
    if (!this.creditStats || this.creditStats.creditsPurchased <= 0) {
      return 0;
    }
    return Math.round((this.creditStats.creditsSpent / this.creditStats.creditsPurchased) * 100);
  }

  get activePlansCount(): number {
    return this.plans.filter((p) => p.active).length;
  }

  planBarPercent(count: number): number {
    if (!this.planStats?.byPlan?.length) {
      return 0;
    }
    const max = Math.max(...this.planStats.byPlan.map((r) => r.count), 1);
    return Math.round((count / max) * 100);
  }

  private refreshPlanStats(): void {
    this.adminService.getSubscriptionPlanStats().subscribe({
      next: (s) => {
        this.planStats = s;
      }
    });
  }

  setActiveTab(section: AdminMonetisationSection): void {
    if (section !== 'plans') {
      this.closePlanEditor();
    }
    this.activeSection = section;
  }

  saveCreditsConfig(): void {
    if (this.pricePerCreditFcfa < 1) {
      Swal.fire('Erreur', 'Le prix par crédit doit être au moins 1 FCFA.', 'error');
      return;
    }
    this.creditsSaving = true;
    this.adminService.updateCreditsConfig(this.pricePerCreditFcfa).subscribe({
      next: () => {
        this.creditsSaving = false;
        Swal.fire('Enregistré', 'Prix des crédits mis à jour.', 'success');
      },
      error: () => {
        this.creditsSaving = false;
        Swal.fire('Erreur', 'Impossible d\'enregistrer la configuration.', 'error');
      }
    });
  }

  openPlanEditor(plan: SellerPlanConfigAdmin): void {
    this.activeSection = 'plans';
    this.editingPlan = { ...plan };
    this.planWizardStep = 1;
  }

  closePlanEditor(): void {
    this.editingPlan = null;
    this.planWizardStep = 1;
  }

  wizardGoTo(step: PlanWizardStep): void {
    if (step < this.planWizardStep || this.canAdvanceFromStep(this.planWizardStep)) {
      this.planWizardStep = step;
    }
  }

  wizardNext(): void {
    if (!this.canAdvanceFromStep(this.planWizardStep)) {
      return;
    }
    if (this.planWizardStep < 4) {
      this.planWizardStep = (this.planWizardStep + 1) as PlanWizardStep;
    }
  }

  wizardPrev(): void {
    if (this.planWizardStep > 1) {
      this.planWizardStep = (this.planWizardStep - 1) as PlanWizardStep;
    }
  }

  canAdvanceFromStep(step: PlanWizardStep): boolean {
    const p = this.editingPlan;
    if (!p) {
      return false;
    }
    if (step === 1) {
      return !!(p.label?.trim());
    }
    if (step === 2) {
      return p.monthlyPriceFcfa >= 0;
    }
    if (step === 3) {
      if (p.commissionPercent < 0 || p.commissionPercent > 100) {
        return false;
      }
      if (!p.unlimitedPublications && (p.maxActivePublications == null || p.maxActivePublications < 1)) {
        return false;
      }
      return p.monthlyBoostsIncluded >= 0;
    }
    return true;
  }

  wizardStepError(step: PlanWizardStep): string | null {
    const p = this.editingPlan;
    if (!p) {
      return null;
    }
    if (step === 1 && !p.label?.trim()) {
      return 'Indiquez un nom affiché pour le plan.';
    }
    if (step === 2 && p.monthlyPriceFcfa < 0) {
      return 'Le prix ne peut pas être négatif.';
    }
    if (step === 3) {
      if (p.commissionPercent < 0 || p.commissionPercent > 100) {
        return 'Commission entre 0 et 100 %.';
      }
      if (!p.unlimitedPublications && p.maxActivePublications < 1) {
        return 'Quota minimum : 1 publication active.';
      }
    }
    return null;
  }

  onUnlimitedToggle(): void {
    if (this.editingPlan?.unlimitedPublications) {
      this.editingPlan.maxActivePublications = -1;
    } else if (this.editingPlan && this.editingPlan.maxActivePublications < 1) {
      this.editingPlan.maxActivePublications = 5;
    }
  }

  estimatedAnnualFcfa(plan: SellerPlanConfigAdmin): number {
    if (plan.monthlyPriceFcfa <= 0) {
      return 0;
    }
    return Math.round(plan.monthlyPriceFcfa * 12 * 0.8);
  }

  publicationsLabel(plan: SellerPlanConfigAdmin): string {
    if (plan.unlimitedPublications) {
      return 'Illimitées';
    }
    return `${plan.maxActivePublications} max`;
  }

  async onActiveToggle(plan: SellerPlanConfigAdmin): Promise<void> {
    if (plan.active) {
      return;
    }
    const result = await Swal.fire({
      title: 'Masquer ce plan ?',
      html: `<p>Les vendeurs ne pourront plus le choisir à la souscription. Les abonnements en cours ne sont pas annulés.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Masquer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#b8956b'
    });
    if (!result.isConfirmed) {
      plan.active = true;
    }
  }

  savePlan(plan: SellerPlanConfigAdmin, closeAfter = false): void {
    if (!plan.label?.trim()) {
      Swal.fire('Erreur', 'Le nom du plan est requis.', 'error');
      return;
    }
    this.savingPlan = plan.plan;
    const body: Partial<SellerPlanConfigAdmin> = {
      label: plan.label.trim(),
      monthlyPriceFcfa: plan.monthlyPriceFcfa,
      commissionPercent: plan.commissionPercent,
      unlimitedPublications: plan.unlimitedPublications,
      maxActivePublications: plan.unlimitedPublications ? -1 : plan.maxActivePublications,
      monthlyBoostsIncluded: plan.monthlyBoostsIncluded,
      active: plan.active,
      displayOrder: plan.displayOrder
    };
    this.adminService.updateSellerPlanConfig(plan.plan, body).subscribe({
      next: (updated) => {
        const i = this.plans.findIndex((p) => p.plan === updated.plan);
        if (i >= 0) {
          this.plans[i] = updated;
        }
        this.savingPlan = null;
        this.refreshPlanStats();
        if (closeAfter) {
          this.closePlanEditor();
        }
        Swal.fire({
          icon: 'success',
          title: plan.active ? 'Plan publié' : 'Plan enregistré',
          text: `« ${updated.label} » est à jour${plan.active ? ' et visible pour les vendeurs.' : ' (masqué).'}`,
          timer: 2200,
          showConfirmButton: false
        });
      },
      error: () => {
        this.savingPlan = null;
        Swal.fire('Erreur', 'Échec de la mise à jour du plan.', 'error');
      }
    });
  }

  publishPlan(): void {
    if (!this.editingPlan) {
      return;
    }
    this.editingPlan.active = true;
    this.savePlan(this.editingPlan, true);
  }

  planAccent(planCode: string): string {
    const code = planCode?.toUpperCase() ?? '';
    if (code === 'PREMIUM') {
      return 'gold';
    }
    if (code === 'PRO') {
      return 'pro';
    }
    return 'free';
  }
}
