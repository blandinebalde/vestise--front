import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Annonce {
  id: number;
  title: string;
  description: string;
  price: number;
  category: 'FEMME' | 'HOMME' | 'ACCESSOIRE' | 'PROMOTION';
  publicationType: 'STANDARD' | 'PREMIUM' | 'TOP_PUB';
  condition?: 'NEUF' | 'OCCASION' | 'TRES_BON_ETAT' | 'BON_ETAT';
  size?: string;
  brand?: string;
  color?: string;
  location?: string;
  images: string[];
  sellerId: number;
  sellerName: string;
  sellerPhone: string;
  status: string;
  viewCount: number;
  contactCount: number;
  createdAt: string;
  publishedAt?: string;
  expiresAt?: string;
}

export interface AnnonceFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string; // Product size filter (e.g., "M", "L", "42")
  brand?: string;
  condition?: string;
  search?: string;
  page?: number;
  pageSize?: number; // Pagination size
  sortBy?: string;
  sortDir?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnnonceService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  getAnnonces(filter?: AnnonceFilter): Observable<PageResponse<Annonce>> {
    let params = new HttpParams();
    if (filter) {
      Object.keys(filter).forEach(key => {
        const value = filter[key as keyof AnnonceFilter];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/annonces/public`, { params });
  }

  getAnnonceById(id: number): Observable<Annonce> {
    return this.http.get<Annonce>(`${this.apiUrl}/annonces/public/${id}`);
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

  contactSeller(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/annonces/contact/${id}`, {});
  }

  getMyAnnonces(page: number = 0, size: number = 20): Observable<PageResponse<Annonce>> {
    return this.http.get<PageResponse<Annonce>>(`${this.apiUrl}/annonces/my-annonces`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  approveAnnonce(id: number): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/admin/annonces/${id}/approve`, {});
  }

  rejectAnnonce(id: number): Observable<Annonce> {
    return this.http.post<Annonce>(`${this.apiUrl}/admin/annonces/${id}/reject`, {});
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
