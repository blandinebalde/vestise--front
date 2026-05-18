import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, SellerPlanConfigAdmin } from '../../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-seller-plans-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-seller-plans-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminSellerPlansContentComponent implements OnInit {
  plans: SellerPlanConfigAdmin[] = [];
  loading = true;
  savingPlan: string | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.adminService.getSellerPlanConfigs().subscribe({
      next: (list) => {
        this.plans = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        Swal.fire('Erreur', 'Impossible de charger les plans vendeur.', 'error');
      }
    });
  }

  savePlan(plan: SellerPlanConfigAdmin): void {
    this.savingPlan = plan.plan;
    const body: Partial<SellerPlanConfigAdmin> = {
      label: plan.label,
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
        Swal.fire('Enregistré', `Plan ${updated.label} mis à jour.`, 'success');
      },
      error: () => {
        this.savingPlan = null;
        Swal.fire('Erreur', 'Échec de la mise à jour du plan.', 'error');
      }
    });
  }

  publicationsLabel(plan: SellerPlanConfigAdmin): string {
    if (plan.unlimitedPublications) {
      return 'Illimité';
    }
    return String(plan.maxActivePublications);
  }
}
