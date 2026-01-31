import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Category } from '../../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-categories-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-categories-content.component.html',
  styleUrls: ['../../admin-dashboard/admin-dashboard.component.css']
})
export class AdminCategoriesContentComponent implements OnInit {
  categories: Category[] = [];
  categoryForm!: FormGroup;
  editingCategory: Category | null = null;
  showCategoryForm = false;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      icon: [''],
      active: [true]
    });
    this.loadCategories();
  }

  loadCategories() {
    this.adminService.getCategories(0, 100).subscribe({
      next: (response) => { this.categories = response.content; },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  openCategoryForm(category?: Category) {
    this.editingCategory = category ?? null;
    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        active: category.active
      });
    } else {
      this.categoryForm.reset({ active: true });
    }
    this.showCategoryForm = true;
  }

  saveCategory() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const categoryData = this.categoryForm.value;
    if (this.editingCategory) {
      this.adminService.updateCategory(this.editingCategory.id, categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie mise à jour', 'success');
          this.loadCategories();
          this.showCategoryForm = false;
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la mise à jour', 'error')
      });
    } else {
      this.adminService.createCategory(categoryData).subscribe({
        next: () => {
          Swal.fire('Succès', 'Catégorie créée', 'success');
          this.loadCategories();
          this.showCategoryForm = false;
        },
        error: () => Swal.fire('Erreur', 'Erreur lors de la création', 'error')
      });
    }
  }

  deleteCategory(id: number) {
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
        this.adminService.deleteCategory(id).subscribe({
          next: () => {
            Swal.fire('Supprimé !', 'Catégorie supprimée', 'success');
            this.loadCategories();
          },
          error: () => Swal.fire('Erreur', 'Impossible de supprimer la catégorie', 'error')
        });
      }
    });
  }
}
