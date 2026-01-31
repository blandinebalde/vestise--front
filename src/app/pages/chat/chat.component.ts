import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConversationService, ConversationDTO, MessageDTO } from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="chat-page">
      <div class="container">
        <a routerLink="/dashboard" class="back-link">← Retour</a>
        <div class="chat-header" *ngIf="conversation">
          <h1>💬 {{ conversation.annonceTitle }}</h1>
          <p class="chat-with">
            Avec {{ isSeller ? conversation.buyerName : conversation.sellerName }}
          </p>
        </div>
        
        <div class="chat-box" *ngIf="conversation">
          <div class="messages" #messagesContainer>
            <div *ngFor="let msg of conversation.messages" 
                 class="message" 
                 [class.mine]="isMine(msg)">
              <span class="message-sender">{{ msg.senderName }}</span>
              <p class="message-content">{{ msg.content }}</p>
              <span class="message-date">{{ msg.createdAt | date:'short' }}</span>
            </div>
          </div>
          <form class="send-form" (ngSubmit)="sendMessage()">
            <textarea [(ngModel)]="newMessage" name="newMessage" rows="2" 
                      placeholder="Écrivez votre message..." required></textarea>
            <button type="submit" class="btn btn-primary" [disabled]="!newMessage.trim() || sending">
              Envoyer
            </button>
          </form>
        </div>
        
        <div class="loading" *ngIf="!conversation && !error">
          <p>Chargement de la conversation...</p>
        </div>
        <div class="error" *ngIf="error">
          <p>{{ error }}</p>
          <a routerLink="/dashboard" class="btn btn-outline">Retour au tableau de bord</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-page { padding: 2rem 0; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: var(--primary-color); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .chat-header { margin-bottom: 1.5rem; }
    .chat-header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .chat-with { color: var(--text-light); font-size: 0.95rem; }
    .chat-box {
      background: var(--background-white);
      border-radius: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
      max-width: 700px;
    }
    .messages {
      padding: 1rem;
      max-height: 400px;
      overflow-y: auto;
    }
    .message {
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: var(--background-light);
      max-width: 85%;
    }
    .message.mine {
      margin-left: auto;
      background: var(--primary-light);
      color: var(--text-dark);
    }
    .message-sender { font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 0.25rem; }
    .message-content { margin: 0 0 0.25rem 0; white-space: pre-wrap; }
    .message-date { font-size: 0.8rem; color: var(--text-light); }
    .send-form {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .send-form textarea {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      resize: none;
    }
    .loading, .error { text-align: center; padding: 2rem; }
    .error p { color: var(--error-color); margin-bottom: 1rem; }
  `]
})
export class ChatComponent implements OnInit {
  conversation: ConversationDTO | null = null;
  newMessage = '';
  sending = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conversationService: ConversationService,
    public authService: AuthService
  ) {}

  get isSeller(): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && !!this.conversation && user.id === this.conversation.sellerId;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadConversation(Number(id));
    } else {
      this.error = 'Conversation introuvable.';
    }
  }

  loadConversation(id: number) {
    this.conversationService.get(id).subscribe({
      next: (conv) => this.conversation = conv,
      error: (err) => {
        this.error = err.error?.message || 'Impossible de charger la conversation.';
      }
    });
  }

  isMine(msg: MessageDTO): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && msg.senderId === user.id;
  }

  sendMessage() {
    if (!this.conversation || !this.newMessage.trim()) return;
    this.sending = true;
    this.conversationService.sendMessage({
      conversationId: this.conversation.id,
      content: this.newMessage.trim()
    }).subscribe({
      next: (msg) => {
        this.conversation!.messages = [...(this.conversation!.messages || []), msg];
        this.newMessage = '';
        this.sending = false;
      },
      error: (err) => {
        this.sending = false;
        alert(err.error?.message || 'Erreur lors de l\'envoi.');
      }
    });
  }
}
