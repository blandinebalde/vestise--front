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

  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true },
      x: {}
    },
    plugins: { legend: { display: true } }
  };

  barOptionsHorizontal: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: { beginAtZero: true },
      y: {}
    },
    plugins: { legend: { display: false } }
  };

  doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadStats();
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
      labels: byMonth.map(x => x.label),
      datasets: [
        { label: 'Crédits achetés', data: byMonth.map(x => x.creditsPurchased), backgroundColor: 'rgba(13, 148, 136, 0.7)' },
        { label: 'Crédits dépensés', data: byMonth.map(x => x.creditsSpent), backgroundColor: 'rgba(37, 99, 235, 0.7)' }
      ]
    };

    const byYear = s.creditsByYear || [];
    this.chartCreditsByYear = {
      labels: byYear.map(x => String(x.year)),
      datasets: [
        { label: 'Crédits achetés', data: byYear.map(x => x.creditsPurchased), backgroundColor: 'rgba(13, 148, 136, 0.7)' },
        { label: 'Crédits dépensés', data: byYear.map(x => x.creditsSpent), backgroundColor: 'rgba(37, 99, 235, 0.7)' }
      ]
    };

    const byUser = s.creditsByUser || [];
    this.chartCreditsByUser = {
      labels: byUser.map(x => x.userEmail || '?'),
      datasets: [{ label: 'Crédits achetés', data: byUser.map(x => x.creditsPurchased), backgroundColor: 'rgba(13, 148, 136, 0.7)' }]
    };

    const annoncesMonth = s.annoncesByMonth || [];
    this.chartAnnoncesByMonth = {
      labels: annoncesMonth.map(x => x.label),
      datasets: [
        { label: 'Créées', data: annoncesMonth.map(x => x.created), backgroundColor: 'rgba(100, 116, 139, 0.7)' },
        { label: 'Approuvées', data: annoncesMonth.map(x => x.approved), backgroundColor: 'rgba(37, 99, 235, 0.7)' },
        { label: 'Vendues', data: annoncesMonth.map(x => x.sold), backgroundColor: 'rgba(13, 148, 136, 0.7)' }
      ]
    };

    const annoncesYear = s.annoncesByYear || [];
    this.chartAnnoncesByYear = {
      labels: annoncesYear.map(x => String(x.year)),
      datasets: [
        { label: 'Créées', data: annoncesYear.map(x => x.created), backgroundColor: 'rgba(100, 116, 139, 0.7)' },
        { label: 'Approuvées', data: annoncesYear.map(x => x.approved), backgroundColor: 'rgba(37, 99, 235, 0.7)' },
        { label: 'Vendues', data: annoncesYear.map(x => x.sold), backgroundColor: 'rgba(13, 148, 136, 0.7)' }
      ]
    };

    const byCat = s.annoncesByCategory || [];
    const colors = ['#0d9488', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#65a30d', '#0891b2', '#4f46e5'];
    this.chartAnnoncesByCategory = {
      labels: byCat.map(x => x.categoryName),
      datasets: [{ data: byCat.map(x => x.count), backgroundColor: byCat.map((_, i) => colors[i % colors.length]) }]
    };

    const byStatus = s.annoncesByStatus || [];
    const statusColors: Record<string, string> = {
      PENDING: '#94a3b8',
      APPROVED: '#2563eb',
      REJECTED: '#dc2626',
      SOLD: '#0d9488',
      EXPIRED: '#64748b'
    };
    this.chartAnnoncesByStatus = {
      labels: byStatus.map(x => x.status),
      datasets: [{ data: byStatus.map(x => x.count), backgroundColor: byStatus.map(x => statusColors[x.status] || '#94a3b8') }]
    };
  }
}
