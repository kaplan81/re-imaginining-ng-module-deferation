import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'cat-catalog-pager',
  imports: [DecimalPipe],
  templateUrl: './catalog-pager.component.html',
  styleUrl: './catalog-pager.component.scss',
})
export class CatalogPagerComponent {
  static pageSizes: readonly number[] = [12, 24, 48];

  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();

  pageChange = output<number>();
  pageSizeChange = output<number>();

  pageSizeOptions = CatalogPagerComponent.pageSizes;

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));

  rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  canGoPrev = computed(() => this.page() > 1);
  canGoNext = computed(() => this.page() < this.totalPages());

  onPrev(): void {
    if (this.canGoPrev()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  onNext(): void {
    if (this.canGoNext()) {
      this.pageChange.emit(this.page() + 1);
    }
  }

  onPageSizeChange(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
