import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, DashboardStats } from '../../../../services/admin.service';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-admin-stats-content',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './admin-stats-content.component.html',
  styleUrls: ['./admin-stats-content.component.css']
})
export class AdminStatsContentComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;

  chartCreditsByMonth: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartCreditsByYear: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartCreditsByUser: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartAnnoncesByMonth: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartAnnoncesByYear: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartAnnoncesByCategory: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  chartAnnoncesByStatus: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };

  private readonly colorViolet = 'rgba(127, 119, 221, 0.78)';
  private readonly colorCoral = 'rgba(216, 90, 48, 0.78)';
  private readonly colorMuted = 'rgba(107, 102, 128, 0.65)';
  private readonly colorOk = 'rgba(46, 125, 50, 0.78)';
  private readonly palette = [
    '#7f77dd',
    '#d85a30',
    '#534ab7',
    '#2e7d32',
    '#afa9ec',
    '#6b6580',
    '#c62828',
    '#b45309'
  ];

  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(228, 223, 245, 0.8)' },
        ticks: { color: '#6b6580', font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6b6580', font: { size: 11 } }
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: { color: '#1f1c2e', font: { size: 12 }, boxWidth: 12, padding: 14 }
      }
    }
  };

  barOptionsHorizontal: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(228, 223, 245, 0.8)' },
        ticks: { color: '#6b6580', font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#6b6580', font: { size: 11 } }
      }
    },
    plugins: { legend: { display: false } }
  };

  doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#1f1c2e', font: { size: 11 }, boxWidth: 10, padding: 10 }
      }
    }
  };

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadStats();
  }

  get utilizationPercent(): number {
    if (!this.stats || this.stats.creditsPurchased <= 0) {
      return 0;
    }
    return Math.round((this.stats.creditsSpent / this.stats.creditsPurchased) * 100);
  }

  loadStats() {
    this.loading = true;
    this.error = null;
    this.adminService.getDashboardStats().subscribe({
      next: (res) => {
        this.stats = res;
        this.buildCharts(res);
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les statistiques.';
        this.loading = false;
      }
    });
  }

  private buildCharts(s: DashboardStats) {
    const byMonth = s.creditsByMonth || [];
    this.chartCreditsByMonth = {
      labels: byMonth.map((x) => x.label),
      datasets: [
        { label: 'Crédits achetés', data: byMonth.map((x) => x.creditsPurchased), backgroundColor: this.colorViolet },
        { label: 'Crédits dépensés', data: byMonth.map((x) => x.creditsSpent), backgroundColor: this.colorCoral }
      ]
    };

    const byYear = s.creditsByYear || [];
    this.chartCreditsByYear = {
      labels: byYear.map((x) => String(x.year)),
      datasets: [
        { label: 'Crédits achetés', data: byYear.map((x) => x.creditsPurchased), backgroundColor: this.colorViolet },
        { label: 'Crédits dépensés', data: byYear.map((x) => x.creditsSpent), backgroundColor: this.colorCoral }
      ]
    };

    const byUser = s.creditsByUser || [];
    this.chartCreditsByUser = {
      labels: byUser.map((x) => x.userEmail || '?'),
      datasets: [{ label: 'Crédits achetés', data: byUser.map((x) => x.creditsPurchased), backgroundColor: this.colorViolet }]
    };

    const annoncesMonth = s.annoncesByMonth || [];
    this.chartAnnoncesByMonth = {
      labels: annoncesMonth.map((x) => x.label),
      datasets: [
        { label: 'Créées', data: annoncesMonth.map((x) => x.created), backgroundColor: this.colorMuted },
        { label: 'Approuvées', data: annoncesMonth.map((x) => x.approved), backgroundColor: this.colorViolet },
        { label: 'Vendues', data: annoncesMonth.map((x) => x.sold), backgroundColor: this.colorOk }
      ]
    };

    const annoncesYear = s.annoncesByYear || [];
    this.chartAnnoncesByYear = {
      labels: annoncesYear.map((x) => String(x.year)),
      datasets: [
        { label: 'Créées', data: annoncesYear.map((x) => x.created), backgroundColor: this.colorMuted },
        { label: 'Approuvées', data: annoncesYear.map((x) => x.approved), backgroundColor: this.colorViolet },
        { label: 'Vendues', data: annoncesYear.map((x) => x.sold), backgroundColor: this.colorOk }
      ]
    };

    const byCat = s.annoncesByCategory || [];
    this.chartAnnoncesByCategory = {
      labels: byCat.map((x) => x.categoryName),
      datasets: [{ data: byCat.map((x) => x.count), backgroundColor: byCat.map((_, i) => this.palette[i % this.palette.length]) }]
    };

    const byStatus = s.annoncesByStatus || [];
    const statusColors: Record<string, string> = {
      PENDING: '#6b6580',
      APPROVED: '#7f77dd',
      REJECTED: '#c62828',
      SOLD: '#2e7d32',
      RESERVED: '#534ab7',
      EXPIRED: '#afa9ec'
    };
    const statusLabels: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'Approuvée',
      REJECTED: 'Refusée',
      SOLD: 'Vendue',
      RESERVED: 'Réservée',
      EXPIRED: 'Expirée'
    };
    this.chartAnnoncesByStatus = {
      labels: byStatus.map((x) => statusLabels[x.status] || x.status),
      datasets: [{ data: byStatus.map((x) => x.count), backgroundColor: byStatus.map((x) => statusColors[x.status] || '#6b6580') }]
    };
  }
}
