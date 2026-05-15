import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface ReviewDTO {
  id: number;
  annoncePublicId: string;
  reviewerPublicId: string;
  reviewerName: string;
  revieweePublicId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface ReviewCreateRequest {
  annoncePublicId: string;
  rating: number;
  comment?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  /** Créer un avis (acheteur sur vendeur) */
  create(request: ReviewCreateRequest): Observable<ReviewDTO> {
    return this.http.post<ReviewDTO>(`${this.apiUrl}/reviews`, request);
  }

  /** Avis reçus par un vendeur */
  getBySeller(sellerPublicId: string, limit: number = 20): Observable<ReviewDTO[]> {
    return this.http.get<ReviewDTO[]>(`${this.apiUrl}/reviews/seller/${sellerPublicId}`, {
      params: { limit: limit.toString() }
    });
  }
}
