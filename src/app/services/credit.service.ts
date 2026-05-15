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
  transactionPublicId: string;
  code?: string;
  clientSecret: string;
  amountFcfa: number;
  creditsAdded: number;
  paymentMethod: string;
}

export interface CreditTransactionDTO {
  publicId: string;
  code: string;
  amountFcfa: number;
  creditsAdded: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

/** Ligne du grand livre (achat confirmé, débit publication). */
export interface CreditLedgerEntry {
  publicId?: string | null;
  movementType: string;
  amountDelta: number;
  balanceAfter: number;
  annoncePublicId?: string | null;
  referenceCode?: string | null;
  creditTransactionCode?: string | null;
  creditTransactionPublicId?: string | null;
  createdAt: string;
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

  confirmPurchase(transactionPublicId: string): Observable<CreditTransactionDTO> {
    return this.http.post<CreditTransactionDTO>(`${this.apiUrl}/confirm/${transactionPublicId}`, {});
  }

  getTransactions(): Observable<CreditTransactionDTO[]> {
    return this.http.get<CreditTransactionDTO[]>(`${this.apiUrl}/transactions`);
  }

  getLedger(): Observable<CreditLedgerEntry[]> {
    return this.http.get<CreditLedgerEntry[]>(`${this.apiUrl}/ledger`);
  }
}
