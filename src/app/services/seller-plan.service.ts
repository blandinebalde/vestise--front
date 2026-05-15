import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface SellerPlanCatalogItem {
  plan: string;
  label: string;
  monthlyPriceFcfa: number;
  annualPriceFcfa: number;
  commissionPercent: number;
  maxActivePublications: number;
  unlimitedPublications: boolean;
  monthlyBoostsIncluded: number;
}

export interface SellerSubscriptionStatus {
  currentPlan: string;
  planLabel: string;
  commissionPercent: number;
  maxActivePublications: number;
  unlimitedPublications: boolean;
  activePublicationsCount: number;
  boostsRemaining: number;
  monthlyBoostsIncluded: number;
  billingCycle?: string;
  planPeriodStart?: string;
  planPeriodEnd?: string;
  planGraceUntil?: string;
  inGracePeriod: boolean;
  creditBalance: number;
}

export interface CommissionBreakdown {
  saleAmountFcfa: number;
  commissionPercent: number;
  commissionAmountFcfa: number;
  sellerNetFcfa: number;
  sellerPlan: string;
}

export interface SaleCommission {
  publicId: string;
  annoncePublicId: string;
  annonceTitle: string;
  saleAmountFcfa: number;
  commissionPercent: number;
  commissionAmountFcfa: number;
  sellerNetFcfa: number;
  sellerPlanAtSale: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class SellerPlanService {
  private readonly apiUrl = `${API_URL}/seller/plan`;

  constructor(private http: HttpClient) {}

  getCatalog(): Observable<SellerPlanCatalogItem[]> {
    return this.http.get<SellerPlanCatalogItem[]>(`${this.apiUrl}/catalog`);
  }

  getStatus(): Observable<SellerSubscriptionStatus> {
    return this.http.get<SellerSubscriptionStatus>(`${this.apiUrl}/status`);
  }

  previewCommission(amount: number): Observable<CommissionBreakdown> {
    const params = new HttpParams().set('amount', String(amount));
    return this.http.get<CommissionBreakdown>(`${this.apiUrl}/commission-preview`, { params });
  }

  subscribe(plan: string, billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'): Observable<SellerSubscriptionStatus> {
    return this.http.post<SellerSubscriptionStatus>(`${this.apiUrl}/subscribe`, { plan, billingCycle });
  }

  getCommissions(page = 0, size = 10): Observable<PageResponse<SaleCommission>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<PageResponse<SaleCommission>>(`${this.apiUrl}/commissions`, { params });
  }
}
