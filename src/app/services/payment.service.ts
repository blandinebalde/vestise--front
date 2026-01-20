import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Payment {
  id: number;
  annonceId: number;
  amount: number;
  paymentMethod: 'STRIPE' | 'ORANGE_MONEY' | 'WAVE';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  paymentProviderId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentRequest {
  annonceId: number;
  paymentMethod: 'STRIPE' | 'ORANGE_MONEY' | 'WAVE';
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  createPayment(request: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/payments`, request);
  }

  confirmPayment(paymentId: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/payments/${paymentId}/confirm`, {});
  }
}
