import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface Payment {
  id: number;
  annonceId: number;
  amount: number;
  paymentMethod: 'STRIPE' | 'ORANGE_MONEY' | 'WAVE' | 'PAIEMENT_LIVRAISON';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  paymentProviderId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentRequest {
  annonceId: number;
  paymentMethod: 'STRIPE' | 'ORANGE_MONEY' | 'WAVE' | 'PAIEMENT_LIVRAISON';
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  createPayment(request: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/payments`, request);
  }

  confirmPayment(paymentId: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/payments/${paymentId}/confirm`, {});
  }
}
