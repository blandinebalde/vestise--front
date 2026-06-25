import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';

export interface AdminAlertsSnapshot {
  pendingCount: number;
  urgentCount: number;
}

/** Pont de compatibilité — délègue au service notifications unifié. */
@Injectable({
  providedIn: 'root'
})
export class AdminAlertsService implements OnDestroy {
  private readonly state$ = new BehaviorSubject<AdminAlertsSnapshot>({
    pendingCount: 0,
    urgentCount: 0
  });

  readonly alerts$ = this.state$.asObservable();
  private sub?: { unsubscribe(): void };

  constructor(private notifications: NotificationService) {
    this.sub = this.notifications.notifications$.subscribe(() => {
      this.state$.next(this.notifications.adminModerationSnapshot);
    });
  }

  startPolling(): void {
    this.notifications.startPolling();
  }

  stopPolling(): void {
    this.notifications.stopPolling();
  }

  refresh(): void {
    this.notifications.refresh();
  }

  get snapshot(): AdminAlertsSnapshot {
    return this.notifications.adminModerationSnapshot;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
