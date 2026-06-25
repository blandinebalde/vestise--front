import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Subscription, catchError, interval, of } from 'rxjs';
import Swal from 'sweetalert2';
import { API_URL } from '../config/api.config';
import { AuthService } from './auth.service';

export type NotificationSeverity = 'info' | 'warning' | 'urgent';

export interface AppNotification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  count: number;
  linkPath: string;
  linkLabel: string;
  occurredAt?: string;
}

export interface NotificationsState {
  items: AppNotification[];
  totalCount: number;
  unreadCount: number;
}

interface AckSnapshot {
  counts: Record<string, number>;
  ackAt: number;
}

const STORAGE_KEY = 'vestisen_notif_ack';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private readonly pollMs = 30_000;
  private pollSub?: Subscription;
  private initialized = false;
  private lastAdminPending = 0;
  private lastAdminUrgent = 0;
  private sellerInitialized = false;
  private lastSellerApproved = 0;
  private lastSellerRejected = 0;

  private readonly state$ = new BehaviorSubject<NotificationsState>({
    items: [],
    totalCount: 0,
    unreadCount: 0
  });

  readonly notifications$ = this.state$.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  startPolling(): void {
    if (this.pollSub || !this.authService.isAuthenticated()) {
      return;
    }
    this.refresh();
    this.pollSub = interval(this.pollMs).subscribe(() => this.refresh());
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.initialized = false;
    this.lastAdminPending = 0;
    this.lastAdminUrgent = 0;
    this.sellerInitialized = false;
    this.lastSellerApproved = 0;
    this.lastSellerRejected = 0;
    this.state$.next({ items: [], totalCount: 0, unreadCount: 0 });
  }

  refresh(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    this.http
      .get<{ items: AppNotification[]; totalCount: number }>(`${API_URL}/notifications`)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) {
          return;
        }
        const items = res.items ?? [];
        const ack = this.loadAck();
        const unreadCount = this.computeUnread(items, ack);
        this.state$.next({
          items,
          totalCount: res.totalCount ?? items.reduce((s, i) => s + i.count, 0),
          unreadCount
        });
        if (this.authService.isAdmin()) {
          this.handleAdminToasts(items);
        } else if (this.authService.isVendeur()) {
          this.handleSellerToasts(items);
        }
      });
  }

  markAllRead(): void {
    const current = this.state$.value.items;
    const counts: Record<string, number> = {};
    for (const item of current) {
      counts[item.id] = item.count;
    }
    this.saveAck({ counts, ackAt: Date.now() });
    this.state$.next({
      ...this.state$.value,
      unreadCount: 0
    });
  }

  navigateTo(item: AppNotification): void {
    const [path, query] = item.linkPath.split('?');
    const queryParams: Record<string, string> = {};
    if (query) {
      for (const part of query.split('&')) {
        const [k, v] = part.split('=');
        if (k) {
          queryParams[k] = v ?? '';
        }
      }
    }
    void this.router.navigate([path], { queryParams: Object.keys(queryParams).length ? queryParams : undefined });
    const ack = this.loadAck();
    ack.counts[item.id] = item.count;
    ack.ackAt = Date.now();
    this.saveAck(ack);
    const unreadCount = this.computeUnread(this.state$.value.items, ack);
    this.state$.next({ ...this.state$.value, unreadCount });
  }

  get snapshot(): NotificationsState {
    return this.state$.value;
  }

  /** Compatibilité admin dashboard (badges modération). */
  get adminModerationSnapshot(): { pendingCount: number; urgentCount: number } {
    const items = this.state$.value.items;
    return {
      pendingCount: items.find((i) => i.id === 'ANNONCE_PENDING')?.count ?? 0,
      urgentCount: items.find((i) => i.id === 'ANNONCE_URGENT')?.count ?? 0
    };
  }

  severityIcon(severity: NotificationSeverity): string {
    switch (severity) {
      case 'urgent':
        return '🔴';
      case 'warning':
        return '🟠';
      default:
        return '🔵';
    }
  }

  private handleAdminToasts(items: AppNotification[]): void {
    const pending = items.find((i) => i.id === 'ANNONCE_PENDING')?.count ?? 0;
    const urgent = items.find((i) => i.id === 'ANNONCE_URGENT')?.count ?? 0;

    if (!this.initialized) {
      this.initialized = true;
      this.lastAdminPending = pending;
      this.lastAdminUrgent = urgent;
      return;
    }

    if (pending > this.lastAdminPending) {
      const delta = pending - this.lastAdminPending;
      this.notifyToast(
        `${delta} nouvelle${delta > 1 ? 's' : ''} annonce${delta > 1 ? 's' : ''} à modérer`,
        'Des annonces attendent votre validation.',
        '/admin?tab=annonces'
      );
    } else if (urgent > this.lastAdminUrgent && urgent > 0) {
      this.notifyToast(
        `${urgent} annonce${urgent > 1 ? 's' : ''} en attente depuis plus de 7 jours`,
        'Modération urgente recommandée.',
        '/admin?tab=annonces'
      );
    }

    this.lastAdminPending = pending;
    this.lastAdminUrgent = urgent;
  }

  private handleSellerToasts(items: AppNotification[]): void {
    const approved = items.find((i) => i.id === 'ANNONCE_APPROVED')?.count ?? 0;
    const rejected = items.find((i) => i.id === 'ANNONCE_REJECTED')?.count ?? 0;

    if (!this.sellerInitialized) {
      this.sellerInitialized = true;
      this.lastSellerApproved = approved;
      this.lastSellerRejected = rejected;
      return;
    }

    if (approved > this.lastSellerApproved) {
      const delta = approved - this.lastSellerApproved;
      this.notifyToast(
        `${delta} annonce${delta > 1 ? 's' : ''} approuvée${delta > 1 ? 's' : ''}`,
        'Elle est désormais en ligne dans le catalogue.',
        '/vendeur/annonces?status=APPROVED',
        'success'
      );
    }
    if (rejected > this.lastSellerRejected) {
      const delta = rejected - this.lastSellerRejected;
      this.notifyToast(
        `${delta} annonce${delta > 1 ? 's' : ''} rejetée${delta > 1 ? 's' : ''}`,
        'Consultez le motif pour corriger et republier.',
        '/vendeur/annonces?status=REJECTED',
        'warning'
      );
    }

    this.lastSellerApproved = approved;
    this.lastSellerRejected = rejected;
  }

  private notifyToast(
    title: string,
    text: string,
    linkPath: string,
    icon: 'success' | 'warning' | 'info' | 'error' = 'warning'
  ): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      text,
      showConfirmButton: true,
      confirmButtonText: 'Voir',
      timer: 10000,
      timerProgressBar: true
    }).then((result) => {
      if (result.isConfirmed) {
        const [path, query] = linkPath.split('?');
        const queryParams: Record<string, string> = {};
        if (query) {
          for (const part of query.split('&')) {
            const [k, v] = part.split('=');
            if (k) {
              queryParams[k] = v ?? '';
            }
          }
        }
        void this.router.navigate([path], { queryParams: Object.keys(queryParams).length ? queryParams : undefined });
      }
    });
  }

  private computeUnread(items: AppNotification[], ack: AckSnapshot): number {
    return items.reduce((sum, item) => {
      const seen = ack.counts[item.id] ?? 0;
      return sum + Math.max(0, item.count - seen);
    }, 0);
  }

  private loadAck(): AckSnapshot {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as AckSnapshot;
      }
    } catch {
      /* ignore */
    }
    return { counts: {}, ackAt: 0 };
  }

  private saveAck(ack: AckSnapshot): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ack));
    } catch {
      /* ignore */
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
