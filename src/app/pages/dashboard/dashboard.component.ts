import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth.service';
import { CreditService } from '../../services/credit.service';
import { DashboardAdminComponent } from './dashboard-admin/dashboard-admin.component';
import { DashboardVendeurComponent } from './dashboard-vendeur/dashboard-vendeur.component';
import { DashboardUserComponent } from './dashboard-user/dashboard-user.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardAdminComponent,
    DashboardVendeurComponent,
    DashboardUserComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  userRole: 'ADMIN' | 'VENDEUR' | 'USER' = 'USER';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private creditService: CreditService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(
        distinctUntilChanged((a, b) => a?.publicId === b?.publicId && a?.role === b?.role),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.userRole = user.role;
          if (user.role === 'VENDEUR') {
            this.creditService.getBalance().subscribe({
              next: (b) => this.authService.refreshCreditBalance(b),
              error: () => {}
            });
          } else if (user.role === 'ADMIN' && user.creditBalance == null) {
            this.creditService.getBalance().subscribe({
              next: (b) => this.authService.refreshCreditBalance(b),
              error: () => {}
            });
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
