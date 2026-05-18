import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../../services/auth.service';
import { AdminOverview, AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-admin.component.html',
  styleUrls: ['./dashboard-admin.component.css']
})
export class DashboardAdminComponent implements OnChanges {
  @Input({ required: true }) user!: User;

  overview: AdminOverview | null = null;
  loading = true;
  loadError = '';

  constructor(private adminService: AdminService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']?.currentValue) {
      this.load();
    }
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.loadError = '';
    this.adminService.getAdminOverview().subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
      },
      error: (err) => {
        if (err?.status === 401) {
          this.loadError = 'Session expirée ou non autorisée. Reconnectez-vous avec un compte administrateur.';
        } else if (err?.status === 403) {
          this.loadError = 'Accès refusé : droits administrateur requis.';
        } else {
          this.loadError = 'Impossible de charger les indicateurs. Vérifiez que le serveur est démarré.';
        }
        this.loading = false;
      }
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'En ligne',
      REJECTED: 'Rejetées',
      SOLD: 'Vendues',
      EXPIRED: 'Expirées'
    };
    return map[status] ?? status;
  }
}
