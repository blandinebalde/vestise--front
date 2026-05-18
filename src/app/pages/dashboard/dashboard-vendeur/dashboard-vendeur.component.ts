import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnnonceService, Annonce, MyAnnoncesSummary } from '../../../services/annonce.service';
import { User } from '../../../services/auth.service';
import { TarifService, PublicationTarif } from '../../../services/tarif.service';
import { CreditLedgerEntry, CreditService } from '../../../services/credit.service';
import { SellerPlanService, SellerSubscriptionStatus } from '../../../services/seller-plan.service';
import { DashboardMyAnnoncesComponent } from '../dashboard-my-annonces/dashboard-my-annonces.component';

/** Seuil crédits : alerte recharge. */
const CREDITS_LOW_THRESHOLD = 5;
/** Vues mini pour signaler « beaucoup de vues, 0 contact ». */
const LOW_CONVERSION_MIN_VIEWS = 8;

@Component({
  selector: 'app-dashboard-vendeur',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardMyAnnoncesComponent],
  templateUrl: './dashboard-vendeur.component.html',
  styleUrls: ['./dashboard-vendeur.component.css']
})
export class DashboardVendeurComponent implements OnChanges {
  @Input({ required: true }) user!: User;

  mySummary: MyAnnoncesSummary | null = null;
  /** Échantillon approuvé pour blocs « insights » (max 100 côté API). */
  insightsApproved: Annonce[] = [];

  totalViews = 0;
  totalContacts = 0;
  pendingAnnonces = 0;
  approvedAnnonces = 0;
  rejectedAnnonces = 0;
  soldAnnonces = 0;
  expiredAnnonces = 0;
  tarifs: PublicationTarif[] = [];
  creditLedger: CreditLedgerEntry[] = [];
  planStatus: SellerSubscriptionStatus | null = null;

  /** Annonces en ligne avec vues mais sans contact — à revoir (prix, photos, titre). */
  lowEngagement: Annonce[] = [];
  /** Annonces qui convertissent le mieux (contacts). */
  topByContacts: Annonce[] = [];
  contactRatePercent = 0;
  avgViewsPerLive = 0;

  readonly creditsLowThreshold = CREDITS_LOW_THRESHOLD;

  constructor(
    private annonceService: AnnonceService,
    private tarifService: TarifService,
    private creditService: CreditService,
    private sellerPlanService: SellerPlanService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']?.currentValue) {
      this.load();
    }
  }

  get creditsLow(): boolean {
    const b = this.planStatus?.creditBalance ?? this.user?.creditBalance;
    return b != null && b < CREDITS_LOW_THRESHOLD;
  }

  get publicationsLimitReached(): boolean {
    const s = this.planStatus;
    if (!s || s.unlimitedPublications) {
      return false;
    }
    return s.activePublicationsCount >= s.maxActivePublications;
  }

  get totalAnnoncesCount(): number {
    return this.mySummary?.totalCount ?? 0;
  }

  onMyAnnoncesListChanged(): void {
    this.loadSummaryAndInsights();
  }

  private loadSummaryAndInsights(): void {
    forkJoin({
      summary: this.annonceService.getMyAnnoncesSummary(),
      approved: this.annonceService.getMyAnnonces(0, 100, { status: 'APPROVED' })
    }).subscribe({
      next: ({ summary, approved }) => {
        this.mySummary = summary;
        this.pendingAnnonces = summary.pendingCount;
        this.approvedAnnonces = summary.approvedCount;
        this.rejectedAnnonces = summary.rejectedCount;
        this.soldAnnonces = summary.soldCount;
        this.expiredAnnonces = summary.expiredCount;
        this.totalViews = summary.totalViews;
        this.totalContacts = summary.totalContacts;
        this.insightsApproved = approved.content ?? [];
        this.recomputeInsights();
      },
      error: () => {
        this.mySummary = null;
        this.insightsApproved = [];
        this.recomputeInsights();
      }
    });
  }

  private load(): void {
    this.loadSummaryAndInsights();

    this.creditService.getLedger().subscribe({
      next: (list) => {
        this.creditLedger = list ?? [];
      },
      error: () => {
        this.creditLedger = [];
      }
    });

    this.tarifService.getTarifs().subscribe({
      next: (tarifs) => {
        this.tarifs = tarifs;
      },
      error: (err) => console.error('Error loading tarifs:', err)
    });

    this.sellerPlanService.getStatus().subscribe({
      next: (status) => {
        this.planStatus = status;
      },
      error: () => {
        this.planStatus = null;
      }
    });

  }

  private recomputeInsights(): void {
    this.contactRatePercent =
      this.totalViews > 0 ? Math.round((this.totalContacts / this.totalViews) * 1000) / 10 : 0;

    const live = this.insightsApproved;
    const liveCount = live.length;
    this.avgViewsPerLive =
      liveCount > 0 ? Math.round((live.reduce((s, a) => s + a.viewCount, 0) / liveCount) * 10) / 10 : 0;

    this.lowEngagement = live
      .filter(a => a.viewCount >= LOW_CONVERSION_MIN_VIEWS && a.contactCount === 0)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 4);

    this.topByContacts = [...live]
      .filter(a => a.contactCount > 0 || a.viewCount > 0)
      .sort((a, b) => b.contactCount - a.contactCount || b.viewCount - a.viewCount)
      .slice(0, 3);
  }
}
