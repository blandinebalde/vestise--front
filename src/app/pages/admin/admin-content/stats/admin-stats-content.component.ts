import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-stats-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-stats-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminStatsContentComponent implements OnInit {
  dailyRevenue = 0;
  weeklyRevenue = 0;
  monthlyRevenue = 0;
  topViewedCount = 0;

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    // TODO: Implémenter les vraies statistiques depuis l'API
    this.monthlyRevenue = 150000;
    this.weeklyRevenue = 37500;
    this.dailyRevenue = 5000;
    this.topViewedCount = 25;
  }
}
