import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { filter, distinctUntilChanged } from 'rxjs';
import { AdminAnnoncesContentComponent } from '../admin-content/annonces/admin-annonces-content.component';
import { AdminUsersContentComponent } from '../admin-content/users/admin-users-content.component';
import { AdminCategoriesContentComponent } from '../admin-content/categories/admin-categories-content.component';
import { AdminTarifsContentComponent } from '../admin-content/tarifs/admin-tarifs-content.component';
import { AdminMonetisationContentComponent } from '../admin-content/monetisation/admin-monetisation-content.component';
import { AdminStatsContentComponent } from '../admin-content/stats/admin-stats-content.component';
import { AdminLogsContentComponent } from '../admin-content/logs/admin-logs-content.component';

const VALID_TABS = ['annonces', 'users', 'categories', 'tarifs', 'monetisation', 'stats', 'logs'] as const;
const LEGACY_TAB_REDIRECT: Record<string, string> = {
  credits: 'monetisation',
  'seller-plans': 'monetisation'
};
const ALL_TABS = [...VALID_TABS, 'credits', 'seller-plans'] as const;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminAnnoncesContentComponent,
    AdminUsersContentComponent,
    AdminCategoriesContentComponent,
    AdminTarifsContentComponent,
    AdminMonetisationContentComponent,
    AdminStatsContentComponent,
    AdminLogsContentComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab = 'annonces';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.pipe(
      filter(params => {
        const tab = params['tab'];
        return !!tab && (ALL_TABS as readonly string[]).includes(tab);
      }),
      distinctUntilChanged((a, b) => a['tab'] === b['tab'])
    ).subscribe(params => {
      const tab = params['tab'] as string;
      this.activeTab = LEGACY_TAB_REDIRECT[tab] ?? tab;
    });
  }
}
