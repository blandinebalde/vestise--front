import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface Annonce {
  /** Identifiant public (UUID) — URLs API. */
  publicId: string;
  /** Code unique de l'annonce (18 caractères). */
  code?: string;
  title: string;
  description: string;
  price: number;
  categoryId?: number;
  categoryName?: string;
  publicationType: string;
  condition?: 'NEUF' | 'OCCASION' | 'TRES_BON_ETAT' | 'BON_ETAT';
  size?: string;
  brand?: string;
  color?: string;
  location?: string;
  images: string[];
  sellerPublicId: string;
  sellerName: string;
  sellerPhone: string;
  status: string;
  viewCount: number;
  contactCount: number;
  createdAt: string;
  publishedAt?: string;
  expiresAt?: string;
  toutDoitPartir?: boolean;
  originalPrice?: number;
  isLot?: boolean;
  acceptPaymentOnDelivery?: boolean;
  latitude?: number;
  longitude?: number;
}

/** DTO catalogue : champs nécessaires pour l'affichage liste/cartes (pagination 20 par page). */
export interface CatalogueAnnonce {
  publicId: string;
  title: string;
  price: number;
  images: string[];
  publicationType: string;
  toutDoitPartir?: boolean;
  originalPrice?: number;
  location?: string;
  categoryName?: string;
}

export interface AnnonceFilter {
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  brand?: string;
  condition?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  toutDoitPartir?: boolean;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/** Réponse de `GET /annonces/my-annonces/summary` */
export interface MyAnnoncesSummary {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  soldCount: number;
  expiredCount: number;
  totalViews: number;
  totalContacts: number;
}

/** Corps PUT `/annonces/mine/{publicId}` — champs optionnels côté API. */
export interface AnnonceSellerUpdate {
  title?: string;
  description?: string;
  price?: number;
  categoryId?: number;
  condition?: string;
  size?: string;
  brand?: string;
  color?: string;
  location?: string;
  images?: string[];
  toutDoitPartir?: boolean;
  originalPrice?: number | null;
  isLot?: boolean;
  acceptPaymentOnDelivery?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AnnonceService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  /** Liste paginée pour le catalogue (20 par page). */
  getAnnonces(filter?: AnnonceFilter): Observable<PageResponse<Annonce>> {
    let params = new HttpParams();
    if (filter) {
      Object.keys(filter).forEach(key => {
        const value = filter[key as keyof AnnonceFilter];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/annonces/public`, { params });
  }

  getAnnonceById(publicId: string): Observable<Annonce> {
    return this.http.get<Annonce>(`${this.apiUrl}/annonces/public/${publicId}`);
  }

  getTopAnnonces(type?: string, limit: number = 10): Observable<Annonce[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<Annonce[]>(`${this.apiUrl}/annonces/public/top`, { params });
  }

  createAnnonce(annonce: any): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/annonces`, annonce);
  }

  contactSeller(publicId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/annonces/contact/${publicId}`, {});
  }

  getMyAnnonces(
    page: number = 0,
    size: number = 20,
    opts?: { status?: string; search?: string }
  ): Observable<PageResponse<Annonce>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    if (opts?.status && opts.status !== 'ALL') {
      params = params.set('status', opts.status);
    }
    if (opts?.search?.trim()) {
      params = params.set('search', opts.search.trim());
    }
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/annonces/my-annonces`, { params });
  }

  /** Agrégats pour le tableau de bord vendeur (compteurs, vues, contacts). */
  getMyAnnoncesSummary(): Observable<MyAnnoncesSummary> {
    return this.http.get<MyAnnoncesSummary>(`${this.apiUrl}/annonces/my-annonces/summary`);
  }

  /** Détail d’une annonce pour le vendeur connecté (tous statuts). */
  getMyAnnonce(publicId: string): Observable<Annonce> {
    return this.http.get<Annonce>(`${this.apiUrl}/annonces/mine/${publicId}`);
  }

  updateMyAnnonce(publicId: string, body: AnnonceSellerUpdate): Observable<Annonce> {
    return this.http.put<Annonce>(`${this.apiUrl}/annonces/mine/${publicId}`, body);
  }

  deleteMyAnnonce(publicId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/annonces/mine/${publicId}`);
  }

  /** Historique d'achats du client (annonces achetées). */
  getMyPurchases(): Observable<Annonce[]> {
    return this.http.get<Annonce[]>(`${this.apiUrl}/annonces/my-purchases`);
  }

  /** Confirmer l'achat d'une annonce (marque comme vendue, retire du panier). */
  buyAnnonce(annoncePublicId: string): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/annonces/${annoncePublicId}/buy`, {});
  }

  /** Upload des photos pour une annonce (stockage annonce/user/codeAnnonce). */
  uploadPhotos(annoncePublicId: string, files: File[]): Observable<Annonce> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return this.http.post<Annonce>(`${this.apiUrl}/annonces/${annoncePublicId}/photos`, formData);
  }

  approveAnnonce(publicId: string): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/admin/annonces/${publicId}/approve`, {});
  }

  rejectAnnonce(publicId: string): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/admin/annonces/${publicId}/reject`, {});
  }

  getAllAnnoncesForAdmin(page: number = 0, size: number = 20): Observable<PageResponse<Annonce>> {
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/admin/annonces`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getTopViewedAnnonces(limit: number = 10): Observable<Annonce[]> {
    return this.http.get<Annonce[]>(`${this.apiUrl}/annonces/public/top-viewed`, {
      params: { limit: limit.toString() }
    });
  }
}
