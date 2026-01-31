import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface CreditConfig {
  id: number;
  pricePerCreditFcfa: number;
}

export interface CreditPurchaseRequest {
  credits: number;
  paymentMethod: 'STRIPE' | 'WAVE' | 'ORANGE_MONEY' | 'CARD';
}

export interface CreditPurchaseResponse {
  transactionId: number;
  code?: string;
  clientSecret: string;
  amountFcfa: number;
  creditsAdded: number;
  paymentMethod: string;
}

export interface CreditTransactionDTO {
  id: number;
  code: string;
  amountFcfa: number;
  creditsAdded: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CreditService {
  private apiUrl = `${API_URL}/credits`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<CreditConfig> {
    return this.http.get<CreditConfig>(`${this.apiUrl}/config`);
  }

  getBalance(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/balance`);
  }

  purchaseCredits(request: CreditPurchaseRequest): Observable<CreditPurchaseResponse> {
    return this.http.post<CreditPurchaseResponse>(`${this.apiUrl}/purchase`, request);
  }

  confirmPurchase(transactionId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/confirm/${transactionId}`, {});
  }

  getTransactions(): Observable<CreditTransactionDTO[]> {
    return this.http.get<CreditTransactionDTO[]>(`${this.apiUrl}/transactions`);
  }
}
