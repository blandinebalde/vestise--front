import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TarifService, PublicationTarif } from '../../../../services/tarif.service';
import { AdminService } from '../../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-tarifs-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-tarifs-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminTarifsContentComponent implements OnInit {
  tarifs: PublicationTarif[] = [];
  tarifForm!: FormGroup;
  editingTarif: PublicationTarif | null = null;
  showTarifForm = false;

  constructor(
    private tarifService: TarifService,
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.tarifForm = this.fb.group({
      typeName: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      durationDays: [30, [Validators.required, Validators.min(0)]],
      active: [true]
    });
    this.loadTarifs();
  }

  loadTarifs() {
    this.tarifService.getAdminTarifs(0, 100).subscribe({
      next: (response) => { this.tarifs = response.content; },
      error: () => {
        this.tarifService.getTarifs().subscribe({ next: (t) => { this.tarifs = t; } });
      }
    });
  }

  openTarifForm(tarif?: PublicationTarif) {
    this.editingTarif = tarif ?? null;
    if (tarif) {
      this.tarifForm.patchValue({
        typeName: tarif.typeName,
        price: tarif.price,
        durationDays: tarif.durationDays ?? 0,
        active: tarif.active
      });
    } else {
      this.tarifForm.reset({
        typeName: '',
        price: 0,
        durationDays: 30,
        active: true
      });
    }
    this.showTarifForm = true;
  }

  updateTarif(tarif: PublicationTarif) {
    this.tarifService.updateTarif(tarif.id, tarif.price, tarif.durationDays, tarif.active, tarif.typeName).subscribe({
      next: (updated) => {
        const index = this.tarifs.findIndex(t => t.id === tarif.id);
        if (index !== -1) this.tarifs[index] = updated;
      },
      error: () => alert('Erreur lors de la mise à jour du tarif')
    });
  }

  saveTarif() {
    if (this.tarifForm.invalid) {
      this.tarifForm.markAllAsTouched();
      return;
    }
    const tarifData = this.tarifForm.value;
    const durationDays = tarifData.durationDays != null && tarifData.durationDays <= 0 ? 0 : (tarifData.durationDays ?? 30);
    if (this.editingTarif) {
      this.tarifService.updateTarif(this.editingTarif.id, tarifData.price, durationDays, tarifData.active, tarifData.typeName).subscribe({
        next: () => {
          Swal.fire('Succès', 'Tarif mis à jour', 'success');
          this.loadTarifs();
          this.showTarifForm = false;
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      this.adminService.createTarif({
        typeName: tarifData.typeName,
        price: tarifData.price,
        durationDays: durationDays <= 0 ? null : durationDays,
        active: tarifData.active
      }).subscribe({
        next: () => {
          Swal.fire('Succès', 'Tarif créé', 'success');
          this.loadTarifs();
          this.showTarifForm = false;
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteTarif(id: number) {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.deleteTarif(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Tarif supprimé', 'success');
            this.loadTarifs();
          },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer le tarif', 'error')
        });
      }
    });
  }

  getDurationLabel(days: number | null | undefined): string {
    if (days == null || days === 0) return 'Illimité';
    return days + ' jour' + (days > 1 ? 's' : '');
  }
}
