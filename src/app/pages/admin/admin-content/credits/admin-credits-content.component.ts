import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-credits-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-credits-content.component.html',
  styleUrls: ['./admin-credits-content.component.css']
})
export class AdminCreditsContentComponent implements OnInit {
  pricePerCreditFcfa = 100;
  loading = false;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getCreditsConfig().subscribe({
      next: (c) => { this.pricePerCreditFcfa = c.pricePerCreditFcfa ?? 100; },
      error: () => {}
    });
  }

  saveConfig() {
    if (this.pricePerCreditFcfa < 1) {
      Swal.fire('Erreur', 'Le prix par crédit doit être au moins 1 FCFA.', 'error');
      return;
    }
    this.loading = true;
    this.adminService.updateCreditsConfig(this.pricePerCreditFcfa).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire('Succès', 'Configuration des crédits enregistrée.', 'success');
      },
      error: () => {
        this.loading = false;
        Swal.fire('Erreur', 'Impossible d\'enregistrer la configuration.', 'error');
      }
    });
  }
}
