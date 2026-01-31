import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Annonce } from './annonce.service';
import { API_URL } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = `${API_URL}/cart`;

  constructor(private http: HttpClient) {}

  getCart(): Observable<Annonce[]> {
    return this.http.get<Annonce[]>(this.apiUrl);
  }

  addToCart(annonceId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/annonce/${annonceId}`, {});
  }

  removeFromCart(annonceId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/annonce/${annonceId}`);
  }
}
