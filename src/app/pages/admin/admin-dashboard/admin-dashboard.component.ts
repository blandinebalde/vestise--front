import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { filter, distinctUntilChanged } from 'rxjs';
import { AdminAnnoncesContentComponent } from '../admin-content/annonces/admin-annonces-content.component';
import { AdminUsersContentComponent } from '../admin-content/users/admin-users-content.component';
import { AdminCategoriesContentComponent } from '../admin-content/categories/admin-categories-content.component';
import { AdminTarifsContentComponent } from '../admin-content/tarifs/admin-tarifs-content.component';
import { AdminCreditsContentComponent } from '../admin-content/credits/admin-credits-content.component';
import { AdminStatsContentComponent } from '../admin-content/stats/admin-stats-content.component';
import { AdminLogsContentComponent } from '../admin-content/logs/admin-logs-content.component';

const VALID_TABS = ['annonces', 'users', 'categories', 'tarifs', 'credits', 'stats', 'logs'] as const;

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
    AdminCreditsContentComponent,
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
        return !!tab && VALID_TABS.includes(tab as typeof VALID_TABS[number]);
      }),
      distinctUntilChanged((a, b) => a['tab'] === b['tab'])
    ).subscribe(params => {
      this.activeTab = params['tab'];
    });
  }
}
