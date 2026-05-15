import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface MessageDTO {
  id: number;
  conversationPublicId: string;
  senderPublicId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readAt?: string;
}

export interface ConversationDTO {
  publicId: string;
  annoncePublicId: string;
  annonceTitle: string;
  buyerPublicId: string;
  buyerName: string;
  sellerPublicId: string;
  sellerName: string;
  createdAt: string;
  messages: MessageDTO[];
}

export interface MessageCreateRequest {
  conversationPublicId: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  /** Créer ou récupérer une conversation pour une annonce (en tant qu'acheteur) */
  getOrCreate(annoncePublicId: string): Observable<ConversationDTO> {
    return this.http.post<ConversationDTO>(`${this.apiUrl}/conversations/annonce/${annoncePublicId}`, {});
  }

  /** Liste de mes conversations */
  listMine(): Observable<ConversationDTO[]> {
    return this.http.get<ConversationDTO[]>(`${this.apiUrl}/conversations`);
  }

  /** Détail d'une conversation avec messages */
  get(publicId: string): Observable<ConversationDTO> {
    return this.http.get<ConversationDTO>(`${this.apiUrl}/conversations/${publicId}`);
  }

  /** Envoyer un message */
  sendMessage(request: MessageCreateRequest): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.apiUrl}/conversations/messages`, request);
  }
}
