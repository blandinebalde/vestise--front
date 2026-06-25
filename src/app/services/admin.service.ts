import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';
import { Annonce } from './annonce.service';

export interface User {
  publicId: string;
  code?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  whatsapp?: string;
  role: 'ADMIN' | 'VENDEUR' | 'USER';
  enabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  annoncesCount?: number;
  creditBalance?: number;
  sellerPlan?: string;
  sellerPlanLabel?: string;
  sellerCommissionPercent?: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  annoncesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategoriesOverview {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  totalAnnoncesInCategories: number;
  topCategories: StatsAnnoncesByCategory[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ActionLog {
  id: number;
  userId?: number;
  username?: string;
  userRole?: string;
  httpMethod?: string;
  requestUri?: string;
  resourceType?: string;
  resourceId?: number;
  actionLabel?: string;
  queryString?: string;
  responseStatus?: number;
  success?: boolean;
  clientIp?: string;
  userAgent?: string;
  errorMessage?: string;
  createdAt?: string;
}

export interface ActionLogFilter {
  search?: string;
  username?: string;
  userRole?: string;
  resourceType?: string;
  actionLabel?: string;
  dateFrom?: string;
  dateTo?: string;
  success?: boolean;
  httpMethod?: string;
  page?: number;
  size?: number;
}

export interface StatsCreditsByMonth {
  year: number;
  month: number;
  label: string;
  creditsPurchased: number;
  creditsSpent: number;
}

export interface StatsCreditsByYear {
  year: number;
  creditsPurchased: number;
  creditsSpent: number;
}

export interface StatsCreditsByUser {
  userId: number;
  userEmail: string;
  creditsPurchased: number;
}

export interface StatsAnnoncesByMonth {
  year: number;
  month: number;
  label: string;
  created: number;
  approved: number;
  sold: number;
}

export interface StatsAnnoncesByYear {
  year: number;
  created: number;
  approved: number;
  sold: number;
}

export interface StatsAnnoncesByCategory {
  categoryId: number;
  categoryName: string;
  count: number;
}

export interface StatsAnnoncesByStatus {
  status: string;
  count: number;
}

export interface StatsEngagement {
  totalAnnonces: number;
  totalViews: number;
  totalContacts: number;
  avgViewsPerAnnonce: number;
  avgContactsPerAnnonce: number;
}

export interface AdminPendingAnnonce {
  publicId: string;
  title: string;
  sellerEmail?: string;
  categoryName?: string;
  publicationType?: string;
  createdAt?: string;
}

export interface AdminOverview {
  annoncesPending: number;
  annoncesPendingOlderThan7Days: number;
  annoncesApproved: number;
  annoncesRejected: number;
  annoncesSold: number;
  annoncesExpired: number;
  totalAnnonces: number;
  annoncesCreatedThisMonth: number;
  usersTotal: number;
  usersVendeurs: number;
  usersClients: number;
  usersAdmins: number;
  usersDisabled: number;
  usersEmailUnverified: number;
  creditsPurchased: number;
  creditsSpent: number;
  revenueFcfaTotal: number;
  revenueFcfaThisMonth: number;
  pendingCreditTransactions: number;
  engagementTotalApproved: number;
  totalViews: number;
  totalContacts: number;
  contactRatePercent: number;
  topCategories: StatsAnnoncesByCategory[];
  oldestPendingAnnonces: AdminPendingAnnonce[];
}

export interface DashboardStats {
  creditsPurchased: number;
  creditsSpent: number;
  creditsByMonth: StatsCreditsByMonth[];
  creditsByYear: StatsCreditsByYear[];
  creditsByUser: StatsCreditsByUser[];
  annoncesByMonth: StatsAnnoncesByMonth[];
  annoncesByYear: StatsAnnoncesByYear[];
  annoncesByCategory: StatsAnnoncesByCategory[];
  annoncesByStatus: StatsAnnoncesByStatus[];
  engagement: StatsEngagement;
}

export interface SellerPlanConfigAdmin {
  plan: string;
  label: string;
  monthlyPriceFcfa: number;
  annualPriceFcfa?: number;
  commissionPercent: number;
  maxActivePublications: number;
  unlimitedPublications: boolean;
  monthlyBoostsIncluded: number;
  active: boolean;
  displayOrder: number;
}

export interface PlanSubscriberCount {
  plan: string;
  label: string;
  count: number;
}

export interface SubscriptionStatusCount {
  status: string;
  label: string;
  count: number;
}

export interface SubscriptionPlanStats {
  totalVendeurs: number;
  paidSubscribers: number;
  pastDueCount: number;
  scheduledDowngrades: number;
  publishedPlansCount: number;
  estimatedMrrFcfa: number;
  byPlan: PlanSubscriberCount[];
  byStatus: SubscriptionStatusCount[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${API_URL}/admin`;

  constructor(private http: HttpClient) {}

  // ========== USERS CRUD ==========
  getUsers(page: number = 0, size: number = 20): Observable<PageResponse<User>> {
    return this.getAdminUsers(page, size);
  }

  getAdminUsers(
    page = 0,
    size = 15,
    role?: string,
    enabled?: string,
    search?: string
  ): Observable<PageResponse<User>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    if (role && role !== 'ALL') {
      params = params.set('role', role);
    }
    if (enabled && enabled !== 'ALL') {
      params = params.set('enabled', enabled);
    }
    const q = search?.trim();
    if (q) {
      params = params.set('search', q);
    }
    return this.http.get<PageResponse<User>>(`${this.apiUrl}/users`, { params });
  }

  getAllUsers(page: number = 0, size: number = 20): Observable<PageResponse<User>> {
    return this.getAdminUsers(page, size);
  }

  getUserById(publicId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${publicId}`);
  }

  createUser(user: Partial<User> & { password: string }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  updateUser(publicId: string, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${publicId}`, user);
  }

  deleteUser(publicId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${publicId}`);
  }

  setUserSellerPlan(
    publicId: string,
    plan: string,
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
  ): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/${publicId}/seller-plan`, { plan, billingCycle });
  }

  activateUser(publicId: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/${publicId}/activate`, {});
  }

  deactivateUser(publicId: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/${publicId}/deactivate`, {});
  }

  getUserActivity(publicId: string, page = 0, size = 15): Observable<PageResponse<ActionLog>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<PageResponse<ActionLog>>(`${this.apiUrl}/users/${publicId}/activity`, { params });
  }

  // ========== CATEGORIES CRUD ==========
  getAdminCategoriesOverview(): Observable<AdminCategoriesOverview> {
    return this.http.get<AdminCategoriesOverview>(`${this.apiUrl}/categories/overview`);
  }

  getAdminCategories(
    page = 0,
    size = 15,
    active?: string,
    search?: string
  ): Observable<PageResponse<Category>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    if (active && active !== 'ALL') {
      params = params.set('active', active);
    }
    const q = search?.trim();
    if (q) {
      params = params.set('search', q);
    }
    return this.http.get<PageResponse<Category>>(`${this.apiUrl}/categories`, { params });
  }

  getCategories(page: number = 0, size: number = 20): Observable<PageResponse<Category>> {
    return this.getAdminCategories(page, size);
  }

  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/categories/${id}`);
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, category);
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, category);
  }

  activateCategory(id: number): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories/${id}/activate`, {});
  }

  deactivateCategory(id: number): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories/${id}/deactivate`, {});
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`);
  }

  // ========== SELLER PLANS (admin) ==========
  getSellerPlanConfigs(): Observable<SellerPlanConfigAdmin[]> {
    return this.http.get<SellerPlanConfigAdmin[]>(`${this.apiUrl}/seller-plans`);
  }

  getSubscriptionPlanStats(): Observable<SubscriptionPlanStats> {
    return this.http.get<SubscriptionPlanStats>(`${this.apiUrl}/seller-plans/stats`);
  }

  updateSellerPlanConfig(plan: string, body: Partial<SellerPlanConfigAdmin>): Observable<SellerPlanConfigAdmin> {
    return this.http.put<SellerPlanConfigAdmin>(`${this.apiUrl}/seller-plans/${plan}`, body);
  }

  // ========== TARIFS CRUD ==========
  createTarif(tarif: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tarifs`, tarif);
  }

  deleteTarif(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tarifs/${id}`);
  }

  // ========== ANNONCES CRUD ==========
  createAnnonce(annonce: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/annonces`, annonce);
  }

  updateAnnonce(publicId: string, annonce: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/annonces/${publicId}`, annonce);
  }

  deleteAnnonce(publicId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/annonces/${publicId}`);
  }

  approveAnnonce(publicId: string): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/annonces/${publicId}/approve`, {});
  }

  rejectAnnonce(publicId: string, reason: string): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/annonces/${publicId}/reject`, { reason });
  }

  // ========== CREDITS CONFIG (admin) ==========
  getCreditsConfig(): Observable<{ id: number; pricePerCreditFcfa: number }> {
    return this.http.get<{ id: number; pricePerCreditFcfa: number }>(`${this.apiUrl}/credits/config`);
  }

  updateCreditsConfig(pricePerCreditFcfa: number): Observable<{ id: number; pricePerCreditFcfa: number }> {
    return this.http.put<{ id: number; pricePerCreditFcfa: number }>(`${this.apiUrl}/credits/config`, { pricePerCreditFcfa });
  }

  /** Statistiques crédits : total acheté et total dépensé. */
  getCreditStats(): Observable<{ creditsPurchased: number; creditsSpent: number }> {
    return this.http.get<{ creditsPurchased: number; creditsSpent: number }>(`${this.apiUrl}/stats/credits`);
  }

  /** Tableau de bord : crédits et annonces par mois, année, user, etc. */
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats/dashboard`);
  }

  /** Synthèse opérationnelle pour le tableau de bord admin. */
  getAdminOverview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${this.apiUrl}/overview`);
  }

  getAdminAnnonces(
    page = 0,
    size = 15,
    status?: string,
    search?: string
  ): Observable<PageResponse<Annonce>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    const q = search?.trim();
    if (q) {
      params = params.set('search', q);
    }
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/annonces`, { params });
  }

  // ========== LOGS (action_logs) ==========
  getLogs(filter: ActionLogFilter): Observable<PageResponse<ActionLog>> {
    let params = new HttpParams().set('page', String(filter.page ?? 0)).set('size', String(filter.size ?? 20));
    if (filter.search != null && filter.search !== '') params = params.set('search', filter.search);
    if (filter.username != null && filter.username !== '') params = params.set('username', filter.username);
    if (filter.userRole != null && filter.userRole !== '') params = params.set('userRole', filter.userRole);
    if (filter.resourceType != null && filter.resourceType !== '') params = params.set('resourceType', filter.resourceType);
    if (filter.actionLabel != null && filter.actionLabel !== '') params = params.set('actionLabel', filter.actionLabel);
    if (filter.dateFrom != null && filter.dateFrom !== '') params = params.set('dateFrom', filter.dateFrom);
    if (filter.dateTo != null && filter.dateTo !== '') params = params.set('dateTo', filter.dateTo);
    if (filter.success != null) params = params.set('success', String(filter.success));
    if (filter.httpMethod != null && filter.httpMethod !== '') params = params.set('httpMethod', filter.httpMethod);
    return this.http.get<PageResponse<ActionLog>>(`${this.apiUrl}/logs`, { params });
  }

  exportLogsExcel(filter: ActionLogFilter): Observable<Blob> {
    let params = new HttpParams();
    if (filter.search != null && filter.search !== '') params = params.set('search', filter.search);
    if (filter.username != null && filter.username !== '') params = params.set('username', filter.username);
    if (filter.userRole != null && filter.userRole !== '') params = params.set('userRole', filter.userRole);
    if (filter.resourceType != null && filter.resourceType !== '') params = params.set('resourceType', filter.resourceType);
    if (filter.actionLabel != null && filter.actionLabel !== '') params = params.set('actionLabel', filter.actionLabel);
    if (filter.dateFrom != null && filter.dateFrom !== '') params = params.set('dateFrom', filter.dateFrom);
    if (filter.dateTo != null && filter.dateTo !== '') params = params.set('dateTo', filter.dateTo);
    if (filter.success != null) params = params.set('success', String(filter.success));
    if (filter.httpMethod != null && filter.httpMethod !== '') params = params.set('httpMethod', filter.httpMethod);
    return this.http.get(`${this.apiUrl}/logs/export`, { params, responseType: 'blob' });
  }
}
