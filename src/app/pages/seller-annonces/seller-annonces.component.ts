import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnnonceService, MyAnnoncesSummary } from '../../services/annonce.service';
import { CreditLedgerEntry, CreditService } from '../../services/credit.service';
import { DashboardMyAnnoncesComponent } from '../dashboard/dashboard-my-annonces/dashboard-my-annonces.component';

@Component({
  selector: 'app-seller-annonces',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardMyAnnoncesComponent],
  templateUrl: './seller-annonces.component.html',
  styleUrls: ['./seller-annonces.component.css']
})
export class SellerAnnoncesComponent implements OnInit, OnDestroy {
  mySummary: MyAnnoncesSummary | null = null;
  creditLedger: CreditLedgerEntry[] = [];
  initialStatusFilter: string | null = null;

  private querySub?: Subscription;

  constructor(
    private annonceService: AnnonceService,
    private creditService: CreditService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.applyStatusFromRoute(this.route.snapshot.queryParamMap.get('status'));
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.applyStatusFromRoute(params.get('status'));
    });
    this.loadSummary();
    this.loadLedger();
  }

  private applyStatusFromRoute(status: string | null): void {
    this.initialStatusFilter = status && status !== 'ALL' ? status : null;
  }

  /** Bandeau contextuel selon le statut filtré (arrivée depuis une notification). */
  get contextBanner(): { icon: string; text: string; klass: string } | null {
    switch (this.initialStatusFilter) {
      case 'APPROVED':
        return {
          icon: '✓',
          text: 'Voici vos annonces approuvées, désormais en ligne dans le catalogue.',
          klass: 'sa-banner--ok'
        };
      case 'REJECTED':
        return {
          icon: '⚠',
          text: 'Voici vos annonces rejetées. Consultez le motif sous chaque annonce pour corriger et republier.',
          klass: 'sa-banner--warn'
        };
      case 'PENDING':
        return {
          icon: '⏳',
          text: 'Voici vos annonces en attente de validation par un administrateur.',
          klass: 'sa-banner--info'
        };
      default:
        return null;
    }
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  onListChanged(): void {
    this.loadSummary();
    this.loadLedger();
  }

  private loadSummary(): void {
    this.annonceService.getMyAnnoncesSummary().subscribe({
      next: (summary) => (this.mySummary = summary),
      error: () => (this.mySummary = null)
    });
  }

  private loadLedger(): void {
    this.creditService.getLedger().subscribe({
      next: (list) => (this.creditLedger = list ?? []),
      error: () => (this.creditLedger = [])
    });
  }
}
